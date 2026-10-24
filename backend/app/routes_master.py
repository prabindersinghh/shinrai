"""Shinrai Master Report (統合レポート): one board-ready report per SME engagement. Recommendations are rule-derived."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from sqlmodel import select

from .advisor.kb import kb
from .advisor.plan import SEEKING_TO_PARTNER, advise, clause_pack
from .engine.rules import rulebook
from .intel import distress
from .models import Investigation, Partner, Sme, session
from .routes_advisor import profile_of, verified_partners
from .routes_modules import _print, recommendation

router = APIRouter()
BAND_RANK = {"low": 0, "standard": 1, "caution": 2, "high": 3, "insufficient": 4}


def _partners(sme_id: int) -> list[dict]:
    from .main import report_payload

    out = []
    with session() as s:
        partners = list(s.exec(select(Partner).where(Partner.sme_id == sme_id).order_by(Partner.id)))
        latest = []
        for p in partners:
            inv = s.exec(select(Investigation).where(Investigation.partner_id == p.id, Investigation.status == "done")
                         .order_by(Investigation.id.desc())).first()
            if inv:
                latest.append(inv.id)
    seen = set()
    for inv_id in latest:
        r = report_payload(inv_id)
        name = r["investigation"]["company"].get("name") or r["partner"]["input_name"]
        if name in seen:
            continue
        seen.add(name)
        flags = sorted(r["flags"], key=lambda f: ["critical", "high", "medium", "low"].index(f["severity"]))
        out.append({
            "inv_id": inv_id, "name": name, "company": r["investigation"]["company"], "score": r["investigation"]["overall_score"],
            "band": r["investigation"]["band"], "subscores": r["investigation"]["subscores"], "fit": r["investigation"]["fit_score"],
            "mode": r["investigation"]["mode_used"], "illustrative": r["investigation"]["is_demo"],
            "summary_en": (r["investigation"]["narrative"] or {}).get("summary_en", ""),
            "summary_ja": (r["investigation"]["narrative"] or {}).get("summary_ja", ""),
            "flags": flags, "claims": r["claims"], "ground": r["ground"], "money": r["money"], "audit": r["audit"],
            "outlook": r["investigation"]["outlook"], "recommendation": recommendation(r["investigation"]["band"], flags),
            "clauses": clause_pack(SEEKING_TO_PARTNER.get(r["sme"]["seeking"], "distributor"), flags),
            "evidence": [{k: e[k] for k in ("ev_id", "source_name", "mode", "summary", "url", "retrieved_at")} for e in r["evidence"]],
            "intel": r["intel"],
        })
    return sorted(out, key=lambda p: (BAND_RANK.get(p["band"] or "insufficient", 5), -(p["score"] or 0)))


def _decision(partners: list[dict]) -> dict:
    """Overall go / conditional / no-go, rule-derived from partner verdicts."""
    real = [p for p in partners if p["band"] in ("low", "standard") and not any(f["severity"] == "critical" for f in p["flags"])]
    if not partners:
        return {"id": "verify", "en": "Proceed to partner verification", "ja": "パートナー検証へ進む",
                "reason_en": "No partner has been verified yet.", "reason_ja": "検証済みのパートナーがまだありません。"}
    if real and real[0]["band"] == "low" and not any(f["severity"] == "high" for f in real[0]["flags"]):
        return {"id": "go", "en": f"Go: proceed with {real[0]['name']}", "ja": f"推進：{real[0]['name']}と取引を進める",
                "reason_en": "Low-risk band with no high or critical findings.", "reason_ja": "低リスク帯で、重大・高リスクの指摘がありません。"}
    if real:
        return {"id": "conditional", "en": f"Conditional go: {real[0]['name']} under the term-sheet conditions",
                "ja": f"条件付き推進：契約条件書の条件の下で{real[0]['name']}と進める",
                "reason_en": "Acceptable band; open findings are addressed by the risk-driven clauses.",
                "reason_ja": "許容範囲の判定で、残る指摘はリスク連動条項で対応します。"}
    return {"id": "no_go", "en": "No-go on the current candidates", "ja": "現候補では見送り",
            "reason_en": "Every verified candidate is in the caution or high-risk band.", "reason_ja": "検証した全候補が要注意または高リスク帯です。"}


def _next_steps(plan: dict, partners: list[dict], decision: dict) -> list[dict]:
    steps = [{"when": 30, "en": f"Shortlist sites in {plan['top'][0]['state']} and contact {plan['contacts'][0]['name'] if plan['contacts'] else 'JETRO India'}.",
              "ja": f"{plan['top'][0]['name_ja']}で候補地を絞り込み、{plan['contacts'][0]['name_ja'] if plan['contacts'] else 'ジェトロ・インド'}に相談する。"}]
    if decision["id"] in ("go", "conditional"):
        steps.append({"when": 30, "en": "Negotiate the term sheet, including every risk-driven clause.", "ja": "リスク連動条項を含む契約条件を交渉する。"})
        steps.append({"when": 60, "en": "Commission a Genba Audit of the partner's site before signing.", "ja": "署名前に相手先拠点の現地監査を実施する。"})
    else:
        steps.append({"when": 30, "en": "Source and verify new partner candidates in the recommended states.", "ja": "推奨州で新たな候補を探し、検証する。"})
    first_steps = [s for s in plan["roadmap"]][:3]
    steps.append({"when": 60, "en": "Start the compliance roadmap: " + ", ".join(s["name"] for s in first_steps) + ".",
                  "ja": "コンプライアンス工程を開始：" + "、".join(s["name_ja"] for s in first_steps) + "。"})
    steps.append({"when": 90, "en": f"Board decision on the {plan['entry']['route']['name'].lower()} and the first-year budget.",
                  "ja": f"{plan['entry']['route']['name_ja']}と初年度予算について取締役会で決定する。"})
    return steps


@router.get("/api/sme/{sme_id}/master")
def master(sme_id: int) -> dict:
    with session() as s:
        sme = s.get(Sme, sme_id)
        if not sme:
            raise HTTPException(404, "Company profile not found")
    plan = advise(profile_of(sme), (sme.advisor_state or {}).get("steps", {}))
    plan["verified_partners"] = verified_partners(sme_id, [t["state"] for t in plan["top"]])
    partners = _partners(sme_id)
    decision = _decision(partners)
    top = plan["top"][0]
    exec_en = [
        f"Recommended location: {top['state']} (fit {top['fit']}), followed by {plan['top'][1]['state']} and {plan['top'][2]['state']}.",
        f"Entry route: {plan['entry']['route']['name']}; alternative: {plan['entry']['alternative']['name']}.",
        (f"{len(partners)} partner(s) verified; best: {partners[0]['name']} ({partners[0]['score'] if partners[0]['score'] is not None else '—'}/100)."
         if partners else "No partner verified yet."),
        f"Recommendation: {decision['en']}.",
        f"White space: {', '.join(w['state'] for w in plan['white_space'])}, where partner verification and a Genba Audit matter most."
        if plan["white_space"] else "No white-space state among the profiled states.",
    ]
    exec_ja = [
        f"推奨立地：{top['name_ja']}（適合度{top['fit']}）、次点は{plan['top'][1]['name_ja']}、{plan['top'][2]['name_ja']}。",
        f"参入形態：{plan['entry']['route']['name_ja']}（代替案：{plan['entry']['alternative']['name_ja']}）。",
        (f"検証済みパートナー{len(partners)}社。最良：{partners[0]['name']}（{partners[0]['score'] if partners[0]['score'] is not None else '—'}点）。"
         if partners else "検証済みのパートナーはまだありません。"),
        f"推奨判断：{decision['ja']}。",
        f"ホワイトスペース：{'、'.join(w['name_ja'] for w in plan['white_space'])}。パートナー検証と現地監査が特に重要です。"
        if plan["white_space"] else "分析対象州にホワイトスペースはありません。",
    ]
    rules = [{k: r[k] for k in ("id", "family", "severity", "deduction")} for r in rulebook()["rules"]]
    by_url: dict[str, tuple] = {}
    for c in (kb().citation(i) for i in kb().entries):
        if c["source_url"].startswith("http") and c["source_url"] not in by_url:
            by_url[c["source_url"]] = (c["source_name"], c["source_url"], str(c["as_of"]), bool(c["verified"]))
    sources = sorted(by_url.values())
    return {
        "sme": profile_of(sme) | {"id": sme.id, "export_markets": sme.export_markets or []}, "generated": date.today().isoformat(),
        "version": f"1.{len(partners)}", "executive_en": exec_en, "executive_ja": exec_ja, "decision": decision, "plan": plan,
        "partners": partners, "next_steps": _next_steps(plan, partners, decision),
        "methodology": {"rules": rules, "families": rulebook()["families"], "model_card": {k: v for k, v in distress.card().items() if k != "curves"},
                        "sources": [{"name": n, "url": u, "as_of": a, "verified": v} for n, u, a, v in sources]},
        "citations": {i: kb().citation(i) for i in kb().entries},
    }


@router.get("/api/sme/{sme_id}/master-report.pdf")
async def master_pdf(sme_id: int, lang: str = "en") -> Response:
    if lang not in ("en", "ja", "bi"):
        raise HTTPException(400, "lang must be en, ja or bi")
    pdf = await _print(f"/master-report/{sme_id}?print=1&lang={lang}", landscape=False)
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="shinrai_master_report_{sme_id}_{lang}.pdf"'})


@router.get("/api/advisor/{sme_id}/report.pdf")
async def advisor_pdf(sme_id: int, kind: str = "market", lang: str = "en") -> Response:
    """Separate reports: market entry, compliance roadmap or growth plan (sections of the master report)."""
    if kind not in ("market", "compliance", "growth") or lang not in ("en", "ja"):
        raise HTTPException(400, "kind must be market, compliance or growth; lang en or ja")
    pdf = await _print(f"/master-report/{sme_id}?print=1&lang={lang}&only={kind}", landscape=False)
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="shinrai_{kind}_report_{sme_id}_{lang}.pdf"'})
