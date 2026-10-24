"""Event-emitting investigation pipeline (TRD §5). Every event is stored as a TraceEvent and pushed to SSE."""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from dataclasses import asdict, fields
from datetime import date, datetime, timezone

from sqlmodel import delete, select

from .. import config
from ..adapters import ADAPTERS
from ..adapters.base import AdapterResult, query_hash
from ..adapters.gstin import check_gstin
from ..adapters.seed_store import norm_name, store
from ..models import (Claim, Edge, Entity, Evidence, Flag, Investigation, Partner, Sme, TraceEvent, session,
                      utcnow)
from . import claims as claims_mod
from . import report, scoring
from .graph import GraphState, address_id, company_id, person_id, short_hash
from .news_tone import classify_news
from .rules import Facts, evaluate

log = logging.getLogger("shinrai.orchestrator")

STEPS = [
    ("resolve", "Resolve identity", "法人照合"), ("company", "Company record", "法人情報"),
    ("gst", "GST registration", "GST登録"), ("directors", "Directors", "取締役"),
    ("expand", "Director network", "関連会社"), ("enrich", "Linked company status", "関連会社の状態"),
    ("legal", "Courts & insolvency", "訴訟・倒産"), ("news", "News scan", "報道"),
    ("document", "Partner document", "会社資料"), ("ground", "Ground truth", "現地確認"),
    ("claims", "Claim check", "主張検証"), ("analytics", "Graph analytics", "グラフ分析"),
    ("rules", "Rulebook", "ルール判定"), ("scoring", "Scoring", "スコア算出"),
    ("narrative", "Report writing", "レポート作成"), ("done", "Done", "完了"),
]
STEP_INDEX = {s[0]: i for i, s in enumerate(STEPS)}
SEVERITY_RISK = {"critical": "critical", "high": "high", "medium": "med", "low": "low"}


class Run:
    """Live fan-out of one investigation's events to SSE subscribers."""

    def __init__(self, inv_id: int, start_seq: int = 0) -> None:
        self.inv_id = inv_id
        self.seq = start_seq
        self.events: list[dict] = []
        self.queues: set[asyncio.Queue] = set()
        self.finished = False

    def subscribe(self) -> tuple[list[dict], asyncio.Queue]:
        q: asyncio.Queue = asyncio.Queue()
        self.queues.add(q)
        return list(self.events), q

    def publish(self, event: dict) -> None:
        self.events.append(event)
        for q in self.queues:
            q.put_nowait(event)

    def close(self) -> None:
        self.finished = True
        for q in self.queues:
            q.put_nowait(None)


RUNS: dict[int, Run] = {}


def _jsonable(obj):
    return json.loads(json.dumps(obj, default=str))


class Pipeline:
    def __init__(self, inv: Investigation, partner: Partner, sme: Sme, run: Run, speed: float = 1.0) -> None:
        self.inv, self.partner, self.sme, self.run = inv, partner, sme, run
        self.graph = GraphState()
        self.facts = Facts(input_label=partner.input_name or partner.cin or partner.gstin or "", today=date.today(),
                           graph=self.graph, input_gstin=partner.gstin)
        self.ev_n = 0
        self.q_n = 0
        self.coverage: dict[str, str] = {}
        self.modes_used: set[str] = set()
        self.claims_raw: list[dict] = []
        self.flags: list[dict] = []
        self.score: dict = {}
        self.is_demo = False
        self.speed = speed
        self.seed_file = self._seed_match()
        requested = inv.mode or "auto"
        self.adapter_mode = "seed" if self.seed_file and requested != "live" else requested
        self.pacing = speed > 0 and self.adapter_mode in ("seed", "cached")

    # ----- infrastructure -------------------------------------------------------------------------------
    def _seed_match(self) -> dict | None:
        s, p = store(), self.partner
        if p.cin and p.cin.upper() in s.companies:
            return s.seed_for(p.cin.upper())
        if p.gstin:
            c = s.find_by_gstin(p.gstin.upper())
            if c:
                return s.seed_for(c["cin"])
        if p.input_name:
            c, _ = s.find_by_name(p.input_name)
            if c:
                return s.seed_for(c["cin"])
        return None

    async def pause(self, ms: float) -> None:
        if self.pacing and ms > 0:
            await asyncio.sleep(ms / 1000 / self.speed)

    async def emit(self, type_: str, **payload) -> dict:
        self.run.seq += 1
        event = {"seq": self.run.seq, "ts": utcnow().isoformat(), "type": type_, **_jsonable(payload)}
        with session() as s:
            s.add(TraceEvent(inv_id=self.inv.id, seq=event["seq"], type=type_, payload=event))
            s.commit()
        self.run.publish(event)
        return event

    async def note(self, step: str, text: str, level: str = "info", icon: str | None = None) -> None:
        await self.emit("log.note", step=step, text=text, level=level, icon=icon)
        await self.pause(config.THEATER_DELAY_MS)

    async def begin(self, step: str) -> None:
        idx = STEP_INDEX[step]
        await self.emit("step.started", step=step, index=idx, total=len(STEPS), label_en=STEPS[idx][1],
                        label_ja=STEPS[idx][2])
        await self.pause(config.THEATER_DELAY_MS * 2)

    async def end(self, step: str, summary: str = "", skipped: bool = False) -> None:
        await self.emit("step.finished", step=step, index=STEP_INDEX[step], summary=summary, skipped=skipped)

    async def node(self, node_id: str, type_: str, label: str, key: str = "", risk: str = "none", **attrs) -> None:
        node, new = self.graph.add_node(node_id, type_, label, key, risk, **attrs)
        if new:
            await self.emit("node.added", node=node)
            await self.pause(config.NODE_DELAY_MS)
        elif attrs:
            await self.emit("node.updated", node={"id": node_id, "attrs": node["attrs"]})

    async def edge(self, src: str, dst: str, type_: str, **attrs) -> None:
        if src not in self.graph.nodes or dst not in self.graph.nodes:
            return
        edge, new = self.graph.add_edge(src, dst, type_, **attrs)
        if new:
            await self.emit("edge.added", edge=edge)
            await self.pause(config.EDGE_DELAY_MS)

    async def set_risk(self, node_id: str, risk: str, pulse: bool = False, **attrs) -> None:
        changed = self.graph.raise_risk(node_id, risk)
        if attrs and node_id in self.graph.nodes:
            self.graph.nodes[node_id]["attrs"].update(attrs)
        if changed or attrs:
            n = self.graph.nodes.get(node_id)
            if n:
                await self.emit("node.updated", node={"id": node_id, "risk": n["risk"], "attrs": n["attrs"]},
                                pulse=pulse)

    def evidence(self, adapter: str, source_name: str, query: dict, url: str, mode: str, payload, summary: str,
                 key: str | None) -> str:
        self.ev_n += 1
        ev_id = f"ev_{self.ev_n}"
        blob = json.dumps(payload, sort_keys=True, default=str, ensure_ascii=False)
        with session() as s:
            s.add(Evidence(inv_id=self.inv.id, ev_id=ev_id, adapter=adapter, source_name=source_name,
                           query=_jsonable(query), url=url, mode=mode, payload=_jsonable(payload), summary=summary,
                           sha256=hashlib.sha256(blob.encode()).hexdigest()))
            s.commit()
        if key:
            self.facts.ev.setdefault(key, []).append(ev_id)
        return ev_id

    async def query(self, step: str, adapter_name: str, query: dict, key: str, label: str = "",
                    icon: str | None = None) -> tuple[AdapterResult, str]:
        adapter = ADAPTERS[adapter_name]
        self.q_n += 1
        qid = f"q{self.q_n}"
        planned = adapter.mode_order(self.adapter_mode)[0]
        await self.emit("query.started", qid=qid, step=step, adapter=adapter_name, source=adapter.source_name,
                        query=query, label=label, mode=planned, icon=icon)
        result = await adapter.fetch(query, self.adapter_mode)
        await self.pause(260 + int(query_hash(adapter_name, query), 16) % 900)
        if result.mode_used in ("live", "cached", "seed"):
            self.modes_used.add(result.mode_used)
        ev_id = self.evidence(adapter_name, adapter.source_name, query, adapter.url, result.mode_used,
                              {"status": result.status, "records": result.records, "attempts": result.attempts},
                              result.summary, key)
        prev = self.coverage.get(adapter_name)
        if prev not in ("ok",):
            self.coverage[adapter_name] = result.status if prev != "empty" or result.status == "ok" else prev
        await self.emit("query.finished", qid=qid, step=step, adapter=adapter_name, source=adapter.source_name,
                        status=result.status, records=len(result.records), latency_ms=result.latency_ms,
                        evidence_id=ev_id, mode=result.mode_used, summary=result.summary, error=result.error[:240],
                        icon=icon)
        return result, ev_id

    # ----- steps ----------------------------------------------------------------------------------------
    async def step_resolve(self) -> None:
        await self.begin("resolve")
        p = self.partner
        if p.gstin:
            local = check_gstin(p.gstin)
            ev = self.evidence("gstin_local", "Local GSTIN check", {"gstin": p.gstin}, "", "local", local,
                               "structure, state code, PAN, checksum", "gst_local")
            self.facts.gst_local = local
            ok = "✓" if local["checksum_ok"] else "✗"
            await self.note("resolve", f"GSTIN {local['gstin']} · state {local['state_code']} {local['state'] or '?'} · "
                                       f"PAN {local['pan']} · checksum {ok} [{ev}]")
        if p.cin:
            q = {"cin": p.cin.upper()}
        elif p.input_name:
            q = {"name": p.input_name}
        elif self.seed_file:
            q = {"cin": self.seed_file["company"]["cin"]}
        else:
            r, _ = await self.query("resolve", "gst", {"gstin": p.gstin.upper()}, "gst_resolve", "GSTIN → legal name")
            name = r.records[0].get("legal_name") if r.records else None
            q = {"name": name} if name else None
        if q is None:
            self.facts.registry_checked = False
            await self.note("resolve", "Registry lookup not possible: no CIN or name, GST lookup unavailable.", "warn")
            await self.end("resolve", "not checked")
            return
        result, ev = await self.query("resolve", "mca_ogd", q, "resolve", "MCA master data")
        self.facts.registry_checked = result.checked
        self.facts.ev["company"] = [ev]
        company = None
        if result.records:
            if "cin" in q:
                company = next((r for r in result.records if r.get("cin") == q["cin"]), result.records[0])
            else:
                from rapidfuzz import fuzz
                scored = sorted(((fuzz.ratio(norm_name(q["name"]), norm_name(r["name"])), r) for r in result.records),
                                key=lambda t: -t[0])
                company = scored[0][1] if scored[0][0] >= 90 else None
        if company:
            self.facts.company = {k: v for k, v in company.items() if not k.startswith("_")}
            self.facts.company_node = company_id(company["cin"])
            self.is_demo = bool(self.seed_file and self.seed_file.get("demo"))
            await self.end("resolve", f"{company['cin']} · {company['name']}")
        else:
            msg = "no registry match" if result.checked else "registry unavailable: identity not checked"
            await self.note("resolve", msg.capitalize() + ".", "warn" if result.checked else "error")
            await self.end("resolve", msg)

    async def step_company(self) -> None:
        await self.begin("company")
        co, cid = self.facts.company, self.facts.company_node
        ev = self.facts.ev["company"][0]
        await self.node(cid, "company", co["name"], co["cin"], target=True, status=co.get("status"),
                        incorporated=co.get("date_of_incorporation"), state=co.get("state"), roc=co.get("roc"),
                        company_class=co.get("company_class"), paid_up_capital=co.get("paid_up_capital"),
                        authorized_capital=co.get("authorized_capital"), listed=co.get("listed"),
                        activity=co.get("activity"), evidence=[ev])
        if co.get("registered_address"):
            aid = address_id(co["registered_address"])
            await self.node(aid, "address", co["registered_address"].split(",")[0], aid, address=co["registered_address"],
                            role="registered", roles=["registered"], evidence=[ev])
            await self.edge(cid, aid, "registered_at")
        parent = (self.seed_file or {}).get("parent")
        if parent:
            pc = store().companies.get(parent["cin"], {})
            pid = company_id(parent["cin"])
            await self.node(pid, "company", pc.get("name", parent["cin"]), parent["cin"], status=pc.get("status"),
                            state=pc.get("state"), note=parent.get("holding"), evidence=[ev])
            await self.edge(cid, pid, "subsidiary_of")
        await self.end("company", f"{co.get('status')} · inc. {co.get('date_of_incorporation')}")

    async def step_gst(self) -> None:
        await self.begin("gst")
        co, cid = self.facts.company, self.facts.company_node
        q = {"gstin": self.partner.gstin.upper()} if self.partner.gstin and not self.seed_file else {"cin": co["cin"]}
        result, ev = await self.query("gst", "gst", q, "gst", "GST taxpayer search")
        for g in result.records:
            g = {**g, "cin": co["cin"]}
            self.facts.gst.append(g)
            gid = f"g_{g['gstin']}"
            status = str(g.get("status", "")).title()
            await self.node(gid, "gstin", g["gstin"], g["gstin"], status=status, state=g.get("state"),
                            registration_date=g.get("registration_date"), cancellation_date=g.get("cancellation_date"),
                            evidence=[ev])
            await self.edge(cid, gid, "has_gstin")
            local = check_gstin(g["gstin"])
            lev = self.evidence("gstin_local", "Local GSTIN check", {"gstin": g["gstin"]}, "", "local", local,
                                "structure, state code, PAN, checksum", "gst_local")
            if self.facts.gst_local is None:
                self.facts.gst_local = local
            pan_ok = "✓" if not co.get("pan") or local["pan"] == co.get("pan") else "✗"
            await self.note("gst", f"{g['gstin']} · state {local['state_code']} {local['state']} · PAN {local['pan']} "
                                   f"{pan_ok} · checksum {'✓' if local['checksum_ok'] else '✗'} → {status} [{lev}]",
                            "warn" if status in ("Cancelled", "Suspended") else "info")
            if status in ("Cancelled", "Suspended"):
                await self.set_risk(gid, "high")
            if g.get("address"):
                aid = address_id(g["address"])
                await self.node(aid, "address", g["address"].split(",")[0], aid, address=g["address"],
                                role="gst_ppob", evidence=[ev])
                self.graph.nodes[aid]["attrs"].setdefault("roles", [])
                if "gst_ppob" not in self.graph.nodes[aid]["attrs"]["roles"]:
                    self.graph.nodes[aid]["attrs"]["roles"].append("gst_ppob")
                await self.edge(cid, aid, "gst_place_of_business")
        if not result.checked and not self.partner.gstin:
            await self.note("gst", "Live GST search needs a GSTIN; add one to check tax status.", "warn")
        await self.end("gst", result.summary)

    async def step_directors(self) -> None:
        await self.begin("directors")
        cid = self.facts.company_node
        result, ev = await self.query("directors", "mca_directors", {"cin": self.facts.company["cin"]}, "directors",
                                      "Director master (DIN)")
        for d in result.records:
            pid = person_id(d.get("din"), d["name"])
            await self.node(pid, "person", d["name"], d.get("din") or "", din=d.get("din"), designation=d.get("designation"),
                            appointed_on=d.get("appointed_on"), evidence=[ev])
            await self.edge(pid, cid, "director_of")
            self.facts.directors.append({"node": pid, "din": d.get("din"), "name": d["name"],
                                         "designation": d.get("designation"), "appointed_on": d.get("appointed_on"),
                                         "companies": [self.facts.company["cin"]]})
        if not result.checked:
            await self.note("directors", "Director data needs a provider key (DIRECTOR_PROVIDER); network not checked.",
                            "warn")
        await self.end("directors", result.summary)

    async def step_expand(self) -> None:
        await self.begin("expand")
        target = self.facts.company["cin"]
        for d in self.facts.directors:
            key = f"expand:{d['din'] or d['name']}"
            result, ev = await self.query("expand", "mca_directors", {"din": d["din"], "name": d["name"]}, key,
                                          f"DIN {d['din'] or '—'} → other companies")
            cins = [r["cin"] for r in result.records][:26]
            d["companies"] = list(dict.fromkeys([target, *cins]))
            for r in result.records[:26]:
                if r["cin"] == target:
                    continue
                await self.node(company_id(r["cin"]), "company", r["name"], r["cin"], linked=True, evidence=[ev])
                await self.edge(d["node"], company_id(r["cin"]), "director_of")
        await self.end("expand", f"{len(self.linked_cins())} linked companies")

    def linked_cins(self) -> list[str]:
        target = self.facts.company["cin"]
        return list(dict.fromkeys(c for d in self.facts.directors for c in d["companies"] if c != target))

    async def step_enrich(self) -> None:
        await self.begin("enrich")
        cins = self.linked_cins()
        if not cins:
            await self.end("enrich", "no linked companies", skipped=True)
            return
        result, ev = await self.query("enrich", "mca_ogd", {"cins": cins}, "enrich", f"Status of {len(cins)} linked companies")
        for r in result.records:
            r = {k: v for k, v in r.items() if not k.startswith("_")}
            self.facts.linked[r["cin"]] = r
            nid = company_id(r["cin"])
            status = str(r.get("status", ""))
            await self.set_risk(nid, "none", status=status, incorporated=r.get("date_of_incorporation"),
                                state=r.get("state"))
            if r.get("registered_address"):
                aid = address_id(r["registered_address"])
                await self.node(aid, "address", r["registered_address"].split(",")[0], aid,
                                address=r["registered_address"], role="registered", evidence=[ev])
                await self.edge(nid, aid, "registered_at")
            if status.lower() in ("strike off", "struck off", "under cirp", "under liquidation"):
                await self.set_risk(nid, "high", pulse=True)
                await self.note("enrich", f"{r['name']} → {status}", "warn")
        so, sev = await self.query("enrich", "strikeoff", {"cins": cins + [self.facts.company["cin"]],
                                                           "dins": [d["din"] for d in self.facts.directors if d["din"]]},
                                   "strikeoff", "Sec 248 / 164(2) lists")
        for r in so.records:
            if r["kind"] == "struck_off":
                self.facts.struck[r["cin"]] = r
                await self.set_risk(company_id(r["cin"]), "high", struck_off_notice=r.get("notice_date"))
            else:
                self.facts.disqualified[r["din"]] = r
                await self.set_risk(person_id(r["din"], r["name"]), "critical", pulse=True)
        gst, gev = await self.query("enrich", "gst", {"cins": cins}, "enrich_gst", "GST of linked companies")
        for g in gst.records:
            gid = f"g_{g['gstin']}"
            status = str(g.get("status", "")).title()
            await self.node(gid, "gstin", g["gstin"], g["gstin"], status=status, state=g.get("state"), evidence=[gev])
            await self.edge(company_id(g["cin"]), gid, "has_gstin")
            if status in ("Cancelled", "Suspended"):
                await self.set_risk(gid, "med")
        await self.end("enrich", f"{len(self.facts.struck)} struck off")

    async def step_legal(self) -> None:
        await self.begin("legal")
        co, cid = self.facts.company, self.facts.company_node
        parties = [(co["name"], co["cin"], cid)] + [(d["name"], d["din"] or d["name"], d["node"]) for d in self.facts.directors]
        total = 0
        for name, key, node in parties:
            result, ev = await self.query("legal", "courts", {"party": name, "key": key}, "courts", f"eCourts party search “{name}”")
            for c in result.records:
                total += 1
                kid = f"k_{short_hash(c.get('case_no', '') + c.get('court', ''))}"
                await self.node(kid, "case", c.get("case_no", "Case"), c.get("case_no", ""), kind="court_case",
                                court=c.get("court"), nature=c.get("nature"), status=c.get("status"),
                                filed=c.get("filed"), role=c.get("party_role"), next_hearing=c.get("next_hearing"),
                                evidence=[ev])
                await self.edge(node, kid, "party_in", role=c.get("party_role"))
                if str(c.get("status", "")).lower() == "pending":
                    await self.set_risk(kid, "med")
                self.facts.cases.append({"node": kid, "party_node": node, "role": c.get("party_role"),
                                         "status": c.get("status"), "nature": c.get("nature")})
        linked = self.linked_cins()
        names = [co["name"]] + [self.facts.linked.get(c, {}).get("name") or self.graph.nodes[company_id(c)]["label"]
                                for c in linked if company_id(c) in self.graph.nodes]
        result, ev = await self.query("legal", "ibbi", {"names": names, "cins": [co["cin"], *linked]}, "ibbi",
                                      "IBBI / NCLT announcements")
        for i in result.records:
            cin = i.get("cin")
            kid = f"k_ibbi_{short_hash(i.get('name', '') + str(i.get('announced')))}"
            await self.node(kid, "case", f"{i.get('type', 'Insolvency')} · {i.get('name', '')}", kid, kind="insolvency",
                            authority=i.get("authority"), announced=i.get("announced"), applicant=i.get("applicant"),
                            evidence=[ev])
            party = company_id(cin) if cin else cid
            await self.edge(party, kid, "party_in", role="corporate debtor")
            await self.set_risk(kid, "critical" if cin == co["cin"] else "high", pulse=True)
            self.facts.insolvency.append({**{k: v for k, v in i.items() if not k.startswith("_")}, "node": kid})
        await self.end("legal", f"{total} cases · {len(result.records)} insolvency")

    async def step_news(self) -> None:
        await self.begin("news")
        co, cid = self.facts.company, self.facts.company_node
        terms = [co["name"]] + [d["name"] for d in self.facts.directors if d.get("din") and not self.is_demo][:3]
        result, ev = await self.query("news", "news", {"terms": terms, "target": co["cin"]}, "news", "GDELT news mentions")
        tones = await classify_news(result.records)
        adverse = 0
        for art, tone in zip(result.records, tones):
            nid = f"n_{short_hash(art.get('title', '') + art.get('url', ''))}"
            about = art.get("about")
            about_node = company_id(about) if about and company_id(about) in self.graph.nodes else (
                about if about in self.graph.nodes else cid)
            await self.node(nid, "news", art.get("title", "")[:80], nid, title=art.get("title"), source=art.get("source"),
                            date=art.get("date"), url=art.get("url"), snippet=art.get("snippet"), tone=tone["tone"],
                            tone_reason=tone["reason"], evidence=[ev])
            await self.edge(about_node, nid, "mentioned_in")
            if tone["tone"] == "adverse":
                adverse += 1
                await self.set_risk(nid, "med")
            self.facts.news.append({"node": nid, "about_node": about_node, "tone": tone["tone"], "title": art.get("title")})
        await self.note("news", f"{len(result.records)} articles scanned, {adverse} adverse ({tones and tones[0]['method'] or 'n/a'})")
        await self.end("news", f"{len(result.records)} articles · {adverse} adverse")

    async def step_document(self) -> None:
        await self.begin("document")
        path = self.partner.doc_path
        if not path:
            await self.end("document", "no document uploaded", skipped=True)
            return
        try:
            text = claims_mod.read_document(path)
        except Exception as exc:  # noqa: BLE001
            await self.note("document", f"Could not read the document: {exc}", "error")
            await self.end("document", "unreadable")
            return
        ev = self.evidence("document", "Partner document", {"file": self.partner.doc_name}, "", "upload",
                           {"filename": self.partner.doc_name, "text": text[:20000]},
                           f"{len(text)} characters extracted", "doc")
        await self.emit("query.started", qid="doc", step="document", adapter="document", source="Partner document",
                        query={"file": self.partner.doc_name}, label="Claim extraction", mode="upload")
        extracted, method = await claims_mod.extract(text)
        await self.pause(900)
        await self.emit("query.finished", qid="doc", step="document", adapter="document", source="Partner document",
                        status="ok" if extracted else "empty", records=len(extracted), latency_ms=0, evidence_id=ev,
                        mode="upload", summary=f"{len(extracted)} claims ({'LLM' if method == 'llm' else 'pattern rules'})")
        self.coverage["document"] = "ok"
        cid = self.facts.company_node
        for i, c in enumerate(extracted, 1):
            qid = f"q_{i}"
            state = claims_mod._state_of(c.value) if c.field == "location" else None
            self.claims_raw.append({"node": qid, "text": c.text, "field": c.field, "value": c.value, "unit": c.unit,
                                    "state": state, "source": "document"})
            await self.node(qid, "doc_claim", c.text[:60], qid, field=c.field, value=c.value, verdict="pending",
                            evidence=[ev])
            if cid:
                await self.edge(cid, qid, "claims")
        await self.end("document", f"{len(extracted)} claims extracted")

    async def step_ground(self) -> None:
        from . import ground

        await self.begin("ground")
        summary = await ground.run(self)
        await self.end("ground", summary)

    async def step_claims(self) -> None:
        await self.begin("claims")
        if not self.claims_raw:
            await self.end("claims", "no claims to check", skipped=True)
            return
        facts = {"company": self.facts.company, "gst": self.facts.gst, "company_node": self.facts.company_node,
                 "ev_company": (self.facts.ev.get("company") or [None])[0], "ev_gst": (self.facts.ev.get("gst") or [None])[0]}
        counts = {"verified": 0, "contradicted": 0, "unverifiable": 0}
        ground_verdicts = {v["claim_node"]: v for v in self.facts.ground.get("claim_verdicts", [])}
        for c in self.claims_raw:
            gv = ground_verdicts.get(c["node"])
            v = claims_mod.verify(claims_mod.ExtractedClaim(c["text"], c["field"], c["value"], c["unit"]), facts,
                                  self.facts.today)
            if gv and v.verdict == gv["verdict"]:
                v = claims_mod.Verdict(v.verdict, f"{v.explanation_en} {gv['explanation_en']}",
                                       f"{v.explanation_ja}{gv['explanation_ja']}", v.evidence_ids + gv["evidence_ids"])
            elif gv and (v.verdict == "unverifiable" or gv["verdict"] == "contradicted"):
                v = claims_mod.Verdict(gv["verdict"], gv["explanation_en"], gv["explanation_ja"], gv["evidence_ids"])
            evidence = [e for e in v.evidence_ids if e] or self.facts.evs("doc")
            entry = {**c, "verdict": v.verdict, "evidence_ids": evidence, "explanation_en": v.explanation_en,
                     "explanation_ja": v.explanation_ja}
            self.facts.claims.append(entry)
            counts[v.verdict] += 1
            await self.emit("claim.checked", claim=entry)
            mark = {"verified": "✅", "contradicted": "❌", "unverifiable": "❓"}[v.verdict]
            await self.note("claims", f"{mark} “{c['text'][:64]}” → {v.verdict} {evidence}", "warn" if v.verdict == "contradicted" else "info",
                            icon=mark)
            await self.set_risk(c["node"], "high" if v.verdict == "contradicted" else "none", verdict=v.verdict)
            await self.pause(config.DRAMA_DELAY_MS * 0.6)
        await self.end("claims", f"✅ {counts['verified']} · ❌ {counts['contradicted']} · ❓ {counts['unverifiable']}")

    async def step_analytics(self) -> None:
        await self.begin("analytics")
        mapping = self.graph.communities()
        await self.emit("graph.communities", mapping=mapping, count=len(set(mapping.values())))
        await self.pause(config.DRAMA_DELAY_MS)
        await self.note("analytics", f"Louvain communities: {len(set(mapping.values()))} across {len(self.graph.nodes)} "
                                     f"nodes and {len(self.graph.edges)} edges")
        addr = self.graph.degree_by_type("address", "registered_at")
        if addr:
            top, n = max(addr.items(), key=lambda t: t[1])
            if n > 1:
                await self.note("analytics", f"Shared registered address: {n} companies at "
                                             f"{self.graph.nodes[top]['attrs'].get('address', '')[:70]}",
                                "warn" if n >= 6 else "info")
        if self.facts.directors:
            d = max(self.facts.directors, key=lambda x: len(x["companies"]))
            await self.note("analytics", f"Highest director degree: {d['name']} · {len(d['companies'])} directorships")
        await self.end("analytics", f"{len(set(mapping.values()))} communities")

    async def step_rules(self) -> None:
        await self.begin("rules")
        flags = evaluate(self.facts)
        raised: list[dict] = []
        for f in flags:
            raised.append(f)
            await self.emit("flag.raised", flag=f)
            for nid in f["entity_ids"]:
                await self.set_risk(nid, SEVERITY_RISK[f["severity"]], pulse=True)
            provisional = scoring.compute(raised, self.coverage)
            await self.emit("score.updated", overall=provisional["overall"], band=provisional["band"],
                            subscores=provisional["subscores"], final=False)
            await self.pause(config.DRAMA_DELAY_MS)
        self.flags = flags
        await self.end("rules", f"{len(flags)} flags")

    async def step_scoring(self) -> None:
        await self.begin("scoring")
        self.score = scoring.compute(self.flags, self.coverage)
        fit = scoring.fit(self.sme.model_dump(), self.facts, self.score["overall"]) if self.facts.company else None
        self.score["fit"] = fit
        self.score["outlook"] = scoring.outlook(self.flags, self.facts, self.facts.today)
        await self.emit("score.updated", overall=self.score["overall"], band=self.score["band"],
                        band_ja=self.score["band_ja"], band_en=self.score["band_en"], subscores=self.score["subscores"],
                        fit=fit, final=True)
        await self.emit("outlook", signals=self.score["outlook"])
        await self.end("scoring", f"{self.score['overall']}/100 · {self.score['band_ja']}")

    def facts_json(self) -> dict:
        co = self.facts.company or {}
        return {
            "company": {k: co.get(k) for k in ("name", "cin", "status", "date_of_incorporation", "state",
                                                "paid_up_capital", "registered_address", "company_class")} if co else None,
            "directors": [{"name": d["name"], "din": d["din"], "directorships": len(d["companies"])}
                          for d in self.facts.directors],
            "gst": [{"gstin": g["gstin"], "status": g.get("status"), "cancellation_date": g.get("cancellation_date")}
                    for g in self.facts.gst],
            "flags": [{k: f[k] for k in ("rule_id", "severity", "family", "text_en", "text_ja", "evidence_ids")}
                      for f in self.flags],
            "claims": [{k: c.get(k) for k in ("text", "field", "verdict", "explanation_en", "evidence_ids")}
                       for c in self.facts.claims],
            "score": {k: self.score.get(k) for k in ("overall", "band", "band_ja", "band_en", "subscores")},
            "outlook": [{k: s[k] for k in ("text_en", "evidence_ids")} for s in self.score.get("outlook", [])],
            "ground": {k: self.facts.ground.get(k) for k in ("summary_en", "verdicts")} if self.facts.ground else None,
            "money": self.facts.money.get("summary") if self.facts.money else None,
            "evidence": self.facts.ev,
            "all_evidence_ids": [f"ev_{i}" for i in range(1, self.ev_n + 1)],
        }

    async def step_narrative(self) -> None:
        await self.begin("narrative")
        self.narrative = await report.narrative(self.facts_json())
        await self.emit("narrative.ready", method=self.narrative["method"], summary_en=self.narrative["summary_en"],
                        summary_ja=self.narrative["summary_ja"], dropped=self.narrative["dropped_sentences"])
        await self.end("narrative", "LLM" if self.narrative["method"] == "llm" else "template (no API key)")

    # ----- persistence ----------------------------------------------------------------------------------
    def state(self) -> dict:
        f = {fl.name: getattr(self.facts, fl.name) for fl in fields(self.facts) if fl.name not in ("graph", "today")}
        return _jsonable({"facts": f, "graph": {"nodes": self.graph.nodes, "edges": list(self.graph.edges.values())},
                          "ev_n": self.ev_n, "q_n": self.q_n, "coverage": self.coverage,
                          "modes_used": sorted(self.modes_used), "claims_raw": self.claims_raw,
                          "adapter_mode": self.adapter_mode, "is_demo": self.is_demo,
                          "seed_id": (self.seed_file or {}).get("id")})

    def restore(self, state: dict) -> None:
        for k, v in state["facts"].items():
            setattr(self.facts, k, v)
        self.graph.nodes = state["graph"]["nodes"]
        self.graph.edges = {(e["src"], e["dst"], e["type"]): e for e in state["graph"]["edges"]}
        self.ev_n, self.q_n = state["ev_n"], state["q_n"]
        self.coverage, self.modes_used = state["coverage"], set(state["modes_used"])
        self.claims_raw, self.is_demo = state["claims_raw"], state["is_demo"]

    def persist(self, started: float) -> None:
        inv_id = self.inv.id
        mode_used = "live" if "live" in self.modes_used else "cached" if "cached" in self.modes_used else "seed"
        with session() as s:
            for model in (Entity, Edge, Flag, Claim):
                s.exec(delete(model).where(model.inv_id == inv_id))
            for n in self.graph.nodes.values():
                s.add(Entity(inv_id=inv_id, node_id=n["id"], type=n["type"], key=n.get("key", ""), label=n["label"],
                             attrs=_jsonable(n["attrs"]), risk=n["risk"], community=n.get("community")))
            for e in self.graph.edges.values():
                s.add(Edge(inv_id=inv_id, src=e["src"], dst=e["dst"], type=e["type"], attrs=_jsonable(e["attrs"])))
            for f in self.flags:
                s.add(Flag(inv_id=inv_id, **{k: f[k] for k in ("rule_id", "severity", "deduction", "family", "entity_ids",
                                                               "evidence_ids", "text_en", "text_ja")}))
            for c in self.facts.claims:
                s.add(Claim(inv_id=inv_id, text=c["text"], field=c["field"], value=str(c.get("value", "")),
                            verdict=c["verdict"], evidence_ids=c["evidence_ids"], explanation_en=c["explanation_en"],
                            explanation_ja=c["explanation_ja"]))
            inv = s.get(Investigation, inv_id)
            inv.status = "done"
            inv.finished_at = utcnow()
            inv.duration_ms = int((time.perf_counter() - started) * 1000) if started else inv.duration_ms
            inv.mode_used = mode_used
            inv.overall_score = self.score.get("overall")
            inv.band = self.score.get("band")
            inv.subscores = self.score.get("subscores", {})
            inv.fit_score = (self.score.get("fit") or {}).get("score")
            inv.fit_detail = self.score.get("fit") or {}
            inv.company = _jsonable(self.facts.company or {})
            inv.narrative = getattr(self, "narrative", {}) or {}
            inv.outlook = self.score.get("outlook", [])
            inv.coverage = self.coverage
            inv.is_demo = self.is_demo
            inv.state = self.state()
            s.add(inv)
            partner = s.get(Partner, self.partner.id)
            partner.status = "done"
            s.add(partner)
            s.commit()

    async def finish(self, started: float) -> None:
        self.persist(started)
        await self.emit("done", report_url=f"/report/{self.inv.id}", overall=self.score.get("overall"),
                        band=self.score.get("band"), duration_ms=int((time.perf_counter() - started) * 1000) if started else None)

    async def run_all(self) -> None:
        started = time.perf_counter()
        await self.emit("investigation.started", partner=self.partner.input_name or self.partner.cin,
                        mode=self.adapter_mode, demo=bool(self.seed_file and self.seed_file.get("demo")),
                        steps=[{"id": s[0], "en": s[1], "ja": s[2]} for s in STEPS])
        await self.step_resolve()
        if self.facts.company:
            for step in (self.step_company, self.step_gst, self.step_directors, self.step_expand, self.step_enrich,
                         self.step_legal, self.step_news, self.step_document, self.step_ground, self.step_claims,
                         self.step_analytics):
                await step()
        else:
            for name in ("company", "gst", "directors", "expand", "enrich", "legal", "news", "document", "ground",
                         "claims", "analytics"):
                await self.end(name, "skipped: identity not resolved", skipped=True)
        await self.step_rules()
        await self.step_scoring()
        await self.step_narrative()
        await self.begin("done")
        await self.finish(started)


def _load(inv_id: int) -> tuple[Investigation, Partner, Sme]:
    with session() as s:
        inv = s.get(Investigation, inv_id)
        partner = s.get(Partner, inv.partner_id)
        sme = s.get(Sme, partner.sme_id)
        return inv, partner, sme


async def run_investigation(inv_id: int, speed: float = 1.0) -> None:
    inv, partner, sme = _load(inv_id)
    run = RUNS.setdefault(inv_id, Run(inv_id))
    pipe = Pipeline(inv, partner, sme, run, speed=speed)
    with session() as s:
        row = s.get(Investigation, inv_id)
        row.status = "running"
        s.add(row)
        p = s.get(Partner, partner.id)
        p.status = "investigating"
        s.add(p)
        s.commit()
    try:
        await pipe.run_all()
    except Exception as exc:  # noqa: BLE001 - the UI must always get a terminal event
        log.exception("investigation %s failed", inv_id)
        await pipe.emit("error", message=f"{type(exc).__name__}: {exc}")
        with session() as s:
            row = s.get(Investigation, inv_id)
            row.status = "failed"
            s.add(row)
            s.commit()
        await pipe.emit("done", report_url=f"/report/{inv_id}", failed=True)
    finally:
        run.close()
        RUNS.pop(inv_id, None)


async def reassess(inv_id: int, mutate, label: str) -> dict:
    """Re-run rules → scoring → narrative after new evidence (consent, pin, audit). Appends to the same trace."""
    inv, partner, sme = _load(inv_id)
    with session() as s:
        last = s.exec(select(TraceEvent.seq).where(TraceEvent.inv_id == inv_id).order_by(TraceEvent.seq.desc())).first()
    run = Run(inv_id, start_seq=last or 0)
    RUNS[inv_id] = run
    pipe = Pipeline(inv, partner, sme, run, speed=0)
    pipe.restore(inv.state)
    try:
        await pipe.emit("reassess.started", reason=label)
        await mutate(pipe)
        await pipe.step_rules()
        await pipe.step_scoring()
        await pipe.step_narrative()
        await pipe.finish(0)
    finally:
        run.close()
        RUNS.pop(inv_id, None)
    return {"overall": pipe.score.get("overall"), "band": pipe.score.get("band")}
