"""Shinrai Advisor API: plan, live run (SSE), compliance tracking, Verify-linked term sheet."""
from __future__ import annotations

import asyncio
import io
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import select
from sse_starlette.sse import EventSourceResponse

from .advisor.fit import FACTORS
from .advisor.kb import kb
from .advisor.plan import SEEKING_TO_PARTNER, advise, clause_pack
from .models import Flag, Investigation, Partner, Sme, session

router = APIRouter()


def profile_of(sme: Sme) -> dict:
    return {"name": sme.name, "name_ja": sme.name_ja, "industry": sme.industry, "seeking": sme.seeking, "goal": sme.goal or "sell",
            "investment_band": sme.investment_band or "50m_300m", "timeline_months": sme.timeline_months or 12,
            "entry_mode": sme.entry_mode or "undecided", "must_haves": sme.must_haves or [], "risk_appetite": sme.risk_appetite,
            "target_states": sme.target_states or [], "products": sme.products or "", "hs_chapter": sme.hs_chapter or "",
            "headcount_y1": sme.headcount_y1 or 0}


def _sme(sme_id: int) -> Sme:
    with session() as s:
        sme = s.get(Sme, sme_id)
        if not sme:
            raise HTTPException(404, "Company profile not found")
        return sme


def verified_partners(sme_id: int, states: list[str]) -> list[dict]:
    """Partners already run through Verify with a good band, in the recommended states."""
    out = []
    with session() as s:
        for p in s.exec(select(Partner).where(Partner.sme_id == sme_id)):
            inv = s.exec(select(Investigation).where(Investigation.partner_id == p.id, Investigation.status == "done")
                         .order_by(Investigation.id.desc())).first()
            if inv and inv.band in ("low", "standard"):
                out.append({"inv_id": inv.id, "name": inv.company.get("name"), "state": inv.company.get("state"),
                            "score": inv.overall_score, "band": inv.band, "in_recommended_state": inv.company.get("state") in states})
    return sorted(out, key=lambda x: (not x["in_recommended_state"], -(x["score"] or 0)))


@router.get("/api/advisor/preview")
def preview() -> dict:
    """Fit for a default profile (sell in India, balanced): real model, cited KB, no SME needed."""
    plan = advise({"industry": "auto_parts", "goal": "sell", "investment_band": "50m_300m", "risk_appetite": "balanced"})
    return {"states": plan["states"], "support_network": plan["support_network"], "top": plan["top"]}


@router.get("/api/advisor/{sme_id}")
def get_plan(sme_id: int) -> dict:
    sme = _sme(sme_id)
    plan = advise(profile_of(sme), (sme.advisor_state or {}).get("steps", {}))
    plan["verified_partners"] = verified_partners(sme_id, [t["state"] for t in plan["top"]])
    plan["citations"] = {i: kb().citation(i) for i in kb().entries}
    return plan


class StepIn(BaseModel):
    step_id: str
    status: str


@router.post("/api/advisor/{sme_id}/step")
def set_step(sme_id: int, body: StepIn) -> dict:
    if body.status not in ("not_started", "in_progress", "done"):
        raise HTTPException(400, "Status must be not_started, in_progress or done")
    with session() as s:
        sme = s.get(Sme, sme_id)
        if not sme:
            raise HTTPException(404, "Company profile not found")
        state = dict(sme.advisor_state or {})
        state["steps"] = {**state.get("steps", {}), body.step_id: body.status}
        sme.advisor_state = state
        s.add(sme)
        s.commit()
        return state


@router.get("/api/advisor/{sme_id}/stream")
async def advisor_stream(sme_id: int, speed: float = 1.0) -> EventSourceResponse:
    """The Advisor run as a paced event stream: sources load, then each state's fit arrives in turn."""
    sme = _sme(sme_id)
    plan = advise(profile_of(sme), (sme.advisor_state or {}).get("steps", {}))
    k = kb()
    sector = plan["entry"]["sector"]

    async def gen():
        seq = 0

        async def emit(ev: dict, wait: float = 0.0):
            nonlocal seq
            seq += 1
            if wait and speed > 0:
                await asyncio.sleep(wait / speed)
            return {"event": "message", "data": json.dumps({"seq": seq, **ev}, ensure_ascii=False)}

        lines = [
            ("📊", "ASI 2022-23 · state shares of manufacturing GVA and employment · loaded", "kb_asi_top5_gva"),
            ("🗾", "Embassy of Japan / JETRO list · 1,434 Japanese companies (Oct 2024) · state table Oct 2021", "kb_jp_states_2021"),
            ("💹", "DPIIT FDI equity inflows by state · Apr–Sep 2024", "kb_fdi_h1fy25"),
            ("🏭", f"Japan Industrial Townships · {len(k.section('support_network', 'jits'))} sites mapped", "jit_neemrana"),
            ("📜", f"FDI policy · {sector['name'] if sector else 'sector'} · {sector['fdi_route'] if sector else 'route'}"
                  + (f" up to {sector['fdi_cap_pct']}%" if sector else ""), sector["id"] if sector else "rt_wos"),
            ("🏛️", f"Support network · {len(k.section('support_network', 'offices'))} JETRO offices and consulates", "sn_jetro_delhi"),
        ]
        yield await emit({"type": "advisor.started", "profile": plan["profile"], "weights": plan["weights"], "factors": FACTORS})
        for icon, text, cite in lines:
            yield await emit({"type": "log", "icon": icon, "text": text, "cite": k.citation(cite)}, 0.9)
        yield await emit({"type": "log", "icon": "🧭", "text": "Computing fit for each profiled state"}, 0.6)
        for r in sorted(plan["states"], key=lambda x: x["fit"]):
            yield await emit({"type": "state.scored", "state": r}, 1.7)
            yield await emit({"type": "log", "icon": "▸", "text": f"{r['state']} · fit {r['fit']} · support {r['support']}"}, 0.15)
        yield await emit({"type": "log", "icon": "✦", "text": f"White space: {', '.join(w['state'] for w in plan['white_space'])}"}, 0.8)
        yield await emit({"type": "log", "icon": "🧭", "text": f"Entry route: {plan['entry']['route']['name']}"}, 0.6)
        plan["verified_partners"] = verified_partners(sme_id, [t["state"] for t in plan["top"]])
        plan["citations"] = {i: k.citation(i) for i in k.entries}
        yield await emit({"type": "advisor.done", "plan": plan}, 0.6)
        yield {"event": "end", "data": "{}"}

    return EventSourceResponse(gen(), ping=10)


def _partner_type(inv: Investigation) -> str:
    with session() as s:
        sme = s.get(Sme, s.get(Partner, inv.partner_id).sme_id)
    return SEEKING_TO_PARTNER.get(sme.seeking, "distributor")


@router.get("/api/investigations/{inv_id}/clauses")
def get_clauses(inv_id: int) -> dict:
    with session() as s:
        inv = s.get(Investigation, inv_id)
        if not inv:
            raise HTTPException(404, "Investigation not found")
        flags = [f.model_dump() for f in s.exec(select(Flag).where(Flag.inv_id == inv_id))]
    pack = clause_pack(_partner_type(inv), flags)
    return {**pack, "company": inv.company, "inv_id": inv_id, "is_demo": inv.is_demo}


@router.get("/api/investigations/{inv_id}/termsheet.docx")
def termsheet_docx(inv_id: int, lang: str = "en") -> Response:
    from docx import Document
    from docx.shared import Pt, RGBColor

    if lang not in ("en", "ja"):
        raise HTTPException(400, "lang must be en or ja")
    pack = get_clauses(inv_id)
    ja = lang == "ja"
    doc = Document()
    doc.add_heading("契約条件書（タームシート）" if ja else "Partner term sheet", level=0)
    doc.add_paragraph(f"{pack['company'].get('name', '')} · CIN {pack['company'].get('cin', '—')}")
    note = doc.add_paragraph(pack["disclaimer_ja"] if ja else pack["disclaimer_en"])
    note.runs[0].italic = True
    for i, c in enumerate(pack["clauses"], 1):
        doc.add_heading(f"{i}. {c['title_ja'] if ja else c['title_en']}", level=2)
        doc.add_paragraph(c["text_ja"] if ja else c["text_en"])
        if c["added_because"]:
            for b in c["added_because"]:
                p = doc.add_paragraph()
                run = p.add_run(("追加理由：" if ja else "Added because: ") + (b["text_ja"] if ja else b["text_en"])
                                + f" ({b['rule_id']}; evidence {', '.join(b['evidence_ids'])})")
                run.font.size = Pt(9)
                run.font.color.rgb = RGBColor(0xE3, 0x12, 0x2B)
        ref = doc.add_paragraph(f"{c['law']} · {c['source_url']}")
        ref.runs[0].font.size = Pt(8)
    buf = io.BytesIO()
    doc.save(buf)
    return Response(buf.getvalue(), media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    headers={"Content-Disposition": f'attachment; filename="term_sheet_{inv_id}_{lang}.docx"'})
