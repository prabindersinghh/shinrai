"""FastAPI app: REST + SSE (TRD §10, Addendum modules)."""
from __future__ import annotations

import asyncio
import json
import logging
import shutil
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import select
from sse_starlette.sse import EventSourceResponse

from . import config
from .adapters.ground_common import EE_PROJECT, GOOGLE_MAPS_KEY
from .engine import llm
from .engine.orchestrator import RUNS, STEPS, Run, reassess, run_investigation
from .engine.rules import rulebook
from .models import (Claim, Edge, Entity, Evidence, Flag, Investigation, Partner, Sme, TraceEvent, init_db, session)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
app = FastAPI(title="Shinrai 信頼", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=[config.FRONTEND_URL], allow_methods=["*"], allow_headers=["*"])
TASKS: set[asyncio.Task] = set()


@app.on_event("startup")
def _startup() -> None:
    init_db()


# ----- SME + partners ----------------------------------------------------------------------------------------
class SmeIn(BaseModel):
    name: str
    name_ja: str = ""
    industry: str = "auto_parts"
    seeking: str = "distributor"
    target_states: list[str] = []
    deal_band: str = "mid"
    risk_appetite: str = "balanced"
    language: str = "ja"


@app.post("/api/sme")
def create_sme(body: SmeIn) -> Sme:
    with session() as s:
        sme = Sme(**body.model_dump())
        s.add(sme)
        s.commit()
        s.refresh(sme)
        return sme


@app.get("/api/sme/{sme_id}")
def get_sme(sme_id: int) -> Sme:
    with session() as s:
        sme = s.get(Sme, sme_id)
        if not sme:
            raise HTTPException(404, "SME not found")
        return sme


@app.get("/api/sme")
def list_smes() -> list[Sme]:
    with session() as s:
        return list(s.exec(select(Sme).order_by(Sme.id.desc())))


def _save_upload(doc: UploadFile) -> tuple[str, str]:
    suffix = Path(doc.filename or "doc.pdf").suffix.lower() or ".pdf"
    if suffix not in (".pdf", ".txt", ".md", ".eml"):
        raise HTTPException(400, "Upload a PDF or text file")
    dest = config.UPLOAD_DIR / f"{uuid.uuid4().hex}{suffix}"
    with dest.open("wb") as fh:
        shutil.copyfileobj(doc.file, fh)
    return str(dest), doc.filename or dest.name


@app.post("/api/partners")
def create_partner(sme_id: int = Form(...), name: str = Form(""), cin: str = Form(""), gstin: str = Form(""),
                   doc: UploadFile | None = File(None), demo_brochure: bool = Form(False)) -> Partner:
    if not (name or cin or gstin):
        raise HTTPException(400, "Enter a company name, CIN or GSTIN")
    doc_path = doc_name = None
    if doc is not None and doc.filename:
        doc_path, doc_name = _save_upload(doc)
    elif demo_brochure:
        doc_path, doc_name = str(config.SEED_DIR / "sunrise_brochure.pdf"), "sunrise_brochure.pdf"
    with session() as s:
        p = Partner(sme_id=sme_id, input_name=name.strip(), cin=cin.strip().upper() or None,
                    gstin=gstin.strip().upper() or None, doc_path=doc_path, doc_name=doc_name)
        s.add(p)
        s.commit()
        s.refresh(p)
        return p


@app.get("/api/partners")
def list_partners(sme_id: int) -> list[dict]:
    with session() as s:
        partners = list(s.exec(select(Partner).where(Partner.sme_id == sme_id).order_by(Partner.id)))
        out = []
        for p in partners:
            inv = s.exec(select(Investigation).where(Investigation.partner_id == p.id)
                         .order_by(Investigation.id.desc())).first()
            out.append({**p.model_dump(), "latest": inv and {k: getattr(inv, k) for k in (
                "id", "status", "overall_score", "band", "mode_used", "is_demo", "fit_score")}})
        return out


# ----- investigations -----------------------------------------------------------------------------------------
class InvestigationIn(BaseModel):
    partner_id: int
    mode: str = "auto"
    speed: float = 1.0


def _spawn(coro) -> None:
    task = asyncio.create_task(coro)
    TASKS.add(task)
    task.add_done_callback(TASKS.discard)


@app.post("/api/investigations")
async def create_investigation(body: InvestigationIn) -> dict:
    with session() as s:
        if not s.get(Partner, body.partner_id):
            raise HTTPException(404, "Partner not found")
        inv = Investigation(partner_id=body.partner_id, mode=body.mode)
        s.add(inv)
        s.commit()
        s.refresh(inv)
    RUNS[inv.id] = Run(inv.id)
    _spawn(run_investigation(inv.id, speed=body.speed))
    return {"id": inv.id}


@app.get("/api/investigations/{inv_id}")
def get_investigation(inv_id: int) -> dict:
    with session() as s:
        inv = s.get(Investigation, inv_id)
        if not inv:
            raise HTTPException(404, "Investigation not found")
        partner = s.get(Partner, inv.partner_id)
        return {**inv.model_dump(exclude={"state"}), "partner": partner.model_dump(), "running": inv_id in RUNS,
                "steps": [{"id": a, "en": b, "ja": c} for a, b, c in STEPS]}


@app.get("/api/investigations/{inv_id}/stream")
async def stream(inv_id: int, replay: int = 0, speed: float = 1.0) -> EventSourceResponse:
    async def live(run: Run):
        snapshot, q = run.subscribe()
        try:
            for ev in snapshot:
                yield {"event": "message", "data": json.dumps(ev, ensure_ascii=False)}
            while True:
                ev = await q.get()
                if ev is None:
                    break
                yield {"event": "message", "data": json.dumps(ev, ensure_ascii=False)}
        finally:
            run.queues.discard(q)
        yield {"event": "end", "data": "{}"}

    async def from_trace():
        with session() as s:
            rows = list(s.exec(select(TraceEvent).where(TraceEvent.inv_id == inv_id).order_by(TraceEvent.seq)))
        prev: datetime | None = None
        for row in rows:
            ts = datetime.fromisoformat(row.payload["ts"])
            if replay and prev is not None and speed > 0:
                gap = min((ts - prev).total_seconds(), 1.5) / speed
                if gap > 0:
                    await asyncio.sleep(gap)
            prev = ts
            yield {"event": "message", "data": json.dumps({**row.payload, "replay": bool(replay)}, ensure_ascii=False)}
        yield {"event": "end", "data": "{}"}

    run = RUNS.get(inv_id)
    return EventSourceResponse(live(run) if run and not replay else from_trace(), ping=10)


def _evidence_rows(inv_id: int, with_payload: bool = False) -> list[dict]:
    with session() as s:
        rows = list(s.exec(select(Evidence).where(Evidence.inv_id == inv_id).order_by(Evidence.id)))
    out = []
    for e in rows:
        d = e.model_dump(exclude=None if with_payload else {"payload"})
        out.append(d)
    return out


@app.get("/api/investigations/{inv_id}/trace")
def get_trace(inv_id: int) -> list[dict]:
    with session() as s:
        rows = list(s.exec(select(TraceEvent).where(TraceEvent.inv_id == inv_id).order_by(TraceEvent.seq)))
    keep = ("step.started", "step.finished", "query.finished", "log.note", "flag.raised", "claim.checked",
            "score.updated", "reassess.started", "money.received", "done", "error")
    return [r.payload for r in rows if r.type in keep]


@app.get("/api/investigations/{inv_id}/evidence/{ev_id}")
def get_evidence(inv_id: int, ev_id: str) -> dict:
    with session() as s:
        ev = s.exec(select(Evidence).where(Evidence.inv_id == inv_id, Evidence.ev_id == ev_id)).first()
        if not ev:
            raise HTTPException(404, "Evidence not found")
        return ev.model_dump()


def graph_payload(inv_id: int) -> dict:
    with session() as s:
        nodes = list(s.exec(select(Entity).where(Entity.inv_id == inv_id)))
        edges = list(s.exec(select(Edge).where(Edge.inv_id == inv_id)))
    return {"nodes": [{"id": n.node_id, "type": n.type, "label": n.label, "key": n.key, "risk": n.risk,
                       "community": n.community, "attrs": n.attrs} for n in nodes],
            "edges": [{"src": e.src, "dst": e.dst, "type": e.type, "attrs": e.attrs} for e in edges]}


@app.get("/api/investigations/{inv_id}/graph")
def get_graph(inv_id: int) -> dict:
    return graph_payload(inv_id)


def report_payload(inv_id: int) -> dict:
    with session() as s:
        inv = s.get(Investigation, inv_id)
        if not inv:
            raise HTTPException(404, "Investigation not found")
        partner = s.get(Partner, inv.partner_id)
        sme = s.get(Sme, partner.sme_id)
        flags = [f.model_dump() for f in s.exec(select(Flag).where(Flag.inv_id == inv_id).order_by(Flag.id))]
        claims = [c.model_dump() for c in s.exec(select(Claim).where(Claim.inv_id == inv_id).order_by(Claim.id))]
        trace_count = len(list(s.exec(select(TraceEvent.id).where(TraceEvent.inv_id == inv_id))))
    state = inv.state or {}
    facts = state.get("facts", {})
    from .routes_modules import audit_summary, consent_summary

    return {
        "investigation": inv.model_dump(exclude={"state"}), "partner": partner.model_dump(), "sme": sme.model_dump(),
        "flags": flags, "claims": claims, "evidence": _evidence_rows(inv_id), "graph": graph_payload(inv_id),
        "ground": facts.get("ground") or {}, "money": facts.get("money") or {}, "audit": audit_summary(inv_id),
        "consent": consent_summary(inv_id), "directors": facts.get("directors", []),
        "gst": facts.get("gst", []), "families": rulebook()["families"], "bands": rulebook()["bands"],
        "trace_count": trace_count, "llm": llm.available(),
    }


@app.get("/api/investigations/{inv_id}/report")
def get_report(inv_id: int) -> dict:
    return report_payload(inv_id)


class PinIn(BaseModel):
    role: str
    lat: float
    lon: float


@app.post("/api/investigations/{inv_id}/pin")
async def confirm_pin(inv_id: int, body: PinIn) -> dict:
    with session() as s:
        inv = s.get(Investigation, inv_id)
        if not inv or inv.status != "done":
            raise HTTPException(409, "Investigation must be finished before a pin can be confirmed")

    async def mutate(pipe) -> None:
        pipe.facts.ground.setdefault("pins", {})[body.role] = {"lat": body.lat, "lon": body.lon}
        await pipe.step_ground()
        pipe.facts.claims = []
        await pipe.step_claims()

    return await reassess(inv_id, mutate, f"pin confirmed for {body.role}")


@app.get("/api/compare")
def compare(sme_id: int) -> list[dict]:
    rows = []
    with session() as s:
        for p in s.exec(select(Partner).where(Partner.sme_id == sme_id)):
            inv = s.exec(select(Investigation).where(Investigation.partner_id == p.id, Investigation.status == "done")
                         .order_by(Investigation.id.desc())).first()
            if not inv:
                continue
            flags = list(s.exec(select(Flag).where(Flag.inv_id == inv.id)))
            order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
            top = min(flags, key=lambda f: order[f.severity], default=None)
            rows.append({"partner_id": p.id, "inv_id": inv.id, "name": inv.company.get("name") or p.input_name,
                         "cin": inv.company.get("cin"), "state": inv.company.get("state"), "score": inv.overall_score,
                         "band": inv.band, "fit": inv.fit_score, "flags": len(flags), "mode": inv.mode_used,
                         "is_demo": inv.is_demo, "subscores": inv.subscores,
                         "top_flag": top and {"rule_id": top.rule_id, "severity": top.severity, "text_en": top.text_en,
                                              "text_ja": top.text_ja}})
    return sorted(rows, key=lambda r: -(r["score"] or 0))


# ----- files (imagery, audit photos) -------------------------------------------------------------------------
@app.get("/api/data/{path:path}")
def data_file(path: str) -> FileResponse:
    target = (config.DATA_DIR / path).resolve()
    allowed = [(config.DATA_DIR / d).resolve() for d in ("ground", "seed/ground", "audits", "seed/audits")]
    if not any(str(target).startswith(str(a)) for a in allowed) or not target.is_file():
        raise HTTPException(404, "File not found")
    media = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}.get(target.suffix.lower())
    if media is None:
        raise HTTPException(404, "File not found")
    return FileResponse(target, media_type=media,
                        headers={"Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff"})


@app.get("/api/meta")
def meta() -> dict:
    return {"llm": llm.available(), "model": config.ANTHROPIC_MODEL if llm.available() else None,
            "earth_engine": bool(EE_PROJECT), "google_maps": bool(GOOGLE_MAPS_KEY),
            "cesium_ion": bool(config.env("CESIUM_ION_TOKEN")), "data_gov_in": bool(config.DATA_GOV_IN_KEY),
            "steps": [{"id": a, "en": b, "ja": c} for a, b, c in STEPS]}


@app.get("/api/config/public")
def public_config() -> dict:
    """Browser-side keys for map tiles / 3D tiles (only what the client must hold)."""
    return {"google_maps_key": GOOGLE_MAPS_KEY or None, "cesium_ion_token": config.env("CESIUM_ION_TOKEN") or None}


# ----- demo --------------------------------------------------------------------------------------------------
@app.post("/api/demo/setup")
def demo_setup() -> dict:
    """Creates the scripted demo: Tanaka Seiko K.K. plus Sunrise (with brochure), Kaveri and Maruti."""
    with session() as s:
        sme = Sme(name="Tanaka Seiko K.K.", name_ja="田中精工株式会社", industry="auto_parts", seeking="distributor",
                  target_states=["Haryana", "Maharashtra"], deal_band="mid", risk_appetite="conservative", language="ja")
        s.add(sme)
        s.commit()
        s.refresh(sme)
        partners = [
            Partner(sme_id=sme.id, input_name="Sunrise Auto Components Pvt Ltd",
                    doc_path=str(config.SEED_DIR / "sunrise_brochure.pdf"), doc_name="sunrise_brochure.pdf"),
            Partner(sme_id=sme.id, input_name="Kaveri Precision Engineering Pvt Ltd"),
            Partner(sme_id=sme.id, input_name="Maruti Suzuki India Ltd", cin="L34103DL1981PLC011375"),
        ]
        for p in partners:
            s.add(p)
        s.commit()
        for p in partners:
            s.refresh(p)
        return {"sme": sme.model_dump(), "partners": [p.model_dump() for p in partners]}


from .routes_modules import router as modules_router  # noqa: E402

app.include_router(modules_router)
