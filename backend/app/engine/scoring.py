"""Sub-scores, overall 信頼スコア, band, fit score and deterministic risk-outlook signals (TRD §6)."""
from __future__ import annotations

from datetime import date

from .rules import Facts, _d, months_between, rulebook

FAMILY_SOURCES = {
    "identity": ["mca_ogd"], "compliance": ["gst", "mca_ogd"], "legal": ["courts", "ibbi"],
    "network": ["mca_directors"], "claims": ["document"], "reputation": ["news"],
    "ground": ["buildings_temporal", "osm_buildings"], "money": ["aa_gst"], "audit": ["genba_audit"], "cyber": ["cyber_posture"],
}


def band_for(score: int) -> dict:
    for b in rulebook()["bands"]:
        if score >= b["min"]:
            return b
    return rulebook()["bands"][-1]


def compute(flags: list[dict], coverage: dict[str, str]) -> dict:
    """coverage: adapter -> status (ok | empty | failed | skipped). Unchecked families score None."""
    fam = rulebook()["families"]
    deductions = {f: 0 for f in fam}
    for flag in flags:
        deductions[flag["family"]] += flag["deduction"]
    capped = {f: min(d, fam[f]["cap"]) for f, d in deductions.items()}

    subscores: dict[str, int | None] = {}
    for f in fam:
        checked = any(coverage.get(src) in ("ok", "empty") for src in FAMILY_SOURCES[f])
        subscores[f] = round(100 * (1 - capped[f] / fam[f]["cap"])) if checked or capped[f] else None

    overall_deduction = sum(min(capped[f], fam[f].get("overall_cap", fam[f]["cap"])) for f in fam)
    overall = max(0, min(100, 100 - overall_deduction))
    if any(fl["severity"] == "critical" for fl in flags):
        overall = min(overall, rulebook()["critical_overall_cap"])
    identity_checked = coverage.get("mca_ogd") in ("ok", "empty")
    band = band_for(overall) if identity_checked else {"id": "insufficient", "ja": "確認不足", "en": "Insufficient data"}
    # Without a registry check there is nothing to score: show no number rather than a misleading 100.
    return {"overall": overall if identity_checked else None, "band": band["id"], "band_ja": band["ja"], "band_en": band["en"],
            "subscores": subscores, "deductions": capped}


SECTOR_KEYWORDS = {
    "auto_parts": ["motor vehicle", "auto", "engine", "fastener", "casting", "forging", "gear", "bearing", "machined"],
    "machinery": ["machinery", "machine", "tool", "equipment", "hydraulic", "pump"],
    "electronics": ["electronic", "electrical", "semiconductor", "component", "battery"],
    "chemicals": ["chemical", "polymer", "plastic", "paint", "pharma"],
    "food": ["food", "agri", "beverage", "dairy"],
    "textiles": ["textile", "garment", "apparel", "yarn"],
    "medical": ["medical", "pharma", "health", "diagnostic"],
}
APPETITE = {"conservative": 0.5, "balanced": 0.3, "aggressive": 0.1}


def fit(sme: dict, facts: Facts, overall: int) -> dict:
    co = facts.company or {}
    activity = f"{co.get('activity', '')} {co.get('name', '')}".lower()
    words = SECTOR_KEYWORDS.get(sme.get("industry", ""), [])
    sector = 40 if any(w in activity for w in words) else 15 if words else 20
    states = {s.lower() for s in sme.get("target_states", [])}
    company_states = {str(co.get("state", "")).lower(), *[str(g.get("state", "")).lower() for g in facts.gst]}
    state = 30 if states & company_states else 30 if not states else 8
    paid = float(co.get("paid_up_capital") or 0)
    band = sme.get("deal_band", "mid")
    if band == "small":
        scale = 30 if paid >= 1e5 else 20
    elif band == "mid":
        scale = 30 if paid >= 1e6 else 15 if paid >= 1e5 else 5
    else:
        scale = 30 if paid >= 5e7 or co.get("listed") else 15 if paid >= 5e6 else 5
    raw = sector + state + scale
    weight = APPETITE.get(sme.get("risk_appetite", "balanced"), 0.3)
    adjusted = round(raw * ((1 - weight) + weight * overall / 100))
    return {"raw": raw, "score": adjusted, "sector": sector, "state": state, "scale": scale,
            "appetite": sme.get("risk_appetite", "balanced"), "weight": weight}


def outlook(flags: list[dict], facts: Facts, today: date) -> list[dict]:
    """Early-warning signals. Deterministic, labelled as signals, never as predictions."""
    ids = {f["rule_id"] for f in flags}
    signals = []

    def add(sid: str, level: str, en: str, ja: str, evidence: list[str]) -> None:
        if evidence:
            signals.append({"id": sid, "level": level, "text_en": en, "text_ja": ja, "evidence_ids": evidence})

    if {"CMP_FILING_OVERDUE", "CMP_GST_CANCELLED"} <= ids:
        add("STRIKE_OFF_TRAJECTORY", "high",
            "Strike-off risk rising: overdue filings plus a cancelled GST registration match the pattern MCA uses "
            "to identify non-operating companies under Sec 248.",
            "登記抹消リスク上昇：年次報告書の遅延とGST登録取消は、MCAが会社法248条で休眠会社を特定する際の典型パターンです。",
            facts.evs("company", "gst"))
    recent = [d for d in facts.directors if d.get("appointed_on") and months_between(_d(d["appointed_on"]), today) <= 12]
    if len(recent) >= 2:
        add("GOVERNANCE_INSTABILITY", "med", f"Governance instability: {len(recent)} director changes in 12 months.",
            f"ガバナンス不安定：過去12か月で取締役の変更が{len(recent)}件。", facts.evs("directors"))
    elif recent:
        d = recent[0]
        add("BOARD_CHANGE", "low", f"Recent board change: {d['name']} appointed {d['appointed_on']}.",
            f"最近の取締役変更：{d['name']}が{d['appointed_on']}に就任。", facts.evs("directors"))
    for g in facts.gst:
        since = _d(g.get("cancellation_date"))
        if since and months_between(since, today) <= 30 and g.get("cin") in (None, (facts.company or {}).get("cin")):
            add("GST_STATUS_CHANGED", "med", f"GST status changed to {g['status']} on {since.isoformat()}.",
                f"GSTステータスが{since.isoformat()}に「{g['status']}」へ変更。", facts.evs("gst"))
            break
    cirp = [i for i in facts.insolvency if i.get("cin") != (facts.company or {}).get("cin")]
    if cirp:
        add("CONTAGION", "med", f"Connected-company stress: {cirp[0]['name']} is in {cirp[0].get('type', 'insolvency')} "
                                "and shares a director with the target.",
            f"関連会社リスク：取締役を共有する{cirp[0]['name']}が{cirp[0].get('type', '倒産')}手続き中です。", facts.evs("ibbi"))
    if "NET_SHARED_ADDRESS_CLUSTER" in ids:
        add("SHELL_PATTERN", "med", "Shell-pattern signal: many companies registered at one address with a common director.",
            "ペーパーカンパニーの兆候：同一住所に共通の取締役を持つ多数の会社が登記されています。", facts.evs("company", "enrich"))
    co = facts.company or {}
    if co.get("date_of_incorporation") and months_between(_d(co["date_of_incorporation"]), today) < 36:
        add("SHORT_HISTORY", "low", "Limited operating history: incorporated less than three years ago.",
            "事業実績が限定的：設立から3年未満です。", facts.evs("company"))
    return signals
