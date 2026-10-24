"""Partner-document claims: extraction (LLM, else pattern rules) and deterministic verification."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from . import llm

FIELDS = ["founded_year", "turnover", "employees", "location", "site_area", "certification", "clients", "capacity",
          "other"]
AREA_TO_M2 = {"sq ft": 0.092903, "sqft": 0.092903, "square feet": 0.092903, "sq m": 1.0, "sqm": 1.0, "m²": 1.0,
              "square metres": 1.0, "square meters": 1.0, "acre": 4046.86, "acres": 4046.86}

CITY_STATE = {
    "pune": "Maharashtra", "mumbai": "Maharashtra", "chakan": "Maharashtra", "nashik": "Maharashtra",
    "aurangabad": "Maharashtra", "gurugram": "Haryana", "gurgaon": "Haryana", "manesar": "Haryana",
    "faridabad": "Haryana", "sonipat": "Haryana", "bawal": "Haryana", "delhi": "Delhi", "new delhi": "Delhi",
    "noida": "Uttar Pradesh", "greater noida": "Uttar Pradesh", "chennai": "Tamil Nadu", "hosur": "Tamil Nadu",
    "coimbatore": "Tamil Nadu", "bengaluru": "Karnataka", "bangalore": "Karnataka", "mysuru": "Karnataka",
    "ahmedabad": "Gujarat", "sanand": "Gujarat", "vadodara": "Gujarat", "hyderabad": "Telangana",
    "jaipur": "Rajasthan", "neemrana": "Rajasthan", "kolkata": "West Bengal", "ludhiana": "Punjab",
}
STATES = {"maharashtra", "haryana", "delhi", "uttar pradesh", "tamil nadu", "karnataka", "gujarat", "telangana",
          "rajasthan", "west bengal", "punjab", "kerala", "andhra pradesh", "madhya pradesh"}

EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {"claims": {"type": "array", "items": {
        "type": "object",
        "properties": {"text": {"type": "string"}, "field": {"type": "string", "enum": FIELDS},
                       "value": {"type": "string"}, "unit": {"type": "string"}},
        "required": ["text", "field", "value", "unit"], "additionalProperties": False}}},
    "required": ["claims"], "additionalProperties": False,
}

EXTRACT_SYSTEM = (
    "You extract verifiable factual claims a company makes about itself from its own marketing document. "
    "Return each claim once, quoting or tightly paraphrasing the document in `text`. Use `field` from the enum. "
    "For founded_year give the year or the number of years with unit 'year' or 'years'. For turnover give the "
    "amount in INR as digits with unit 'INR'. For location give the full address or place as written and put the "
    "facility kind (registered office, factory, plant, warehouse) in unit. For site_area give the area in square "
    "metres as digits with unit 'm2'. Do not invent claims; skip opinions and slogans."
)


@dataclass
class ExtractedClaim:
    text: str
    field: str
    value: str
    unit: str = ""


@dataclass
class Verdict:
    verdict: str
    explanation_en: str
    explanation_ja: str
    evidence_ids: list[str] = field(default_factory=list)
    entity_ids: list[str] = field(default_factory=list)


def read_document(path: str) -> str:
    p = Path(path)
    if p.suffix.lower() == ".pdf":
        from pypdf import PdfReader

        return "\n".join((page.extract_text() or "") for page in PdfReader(str(p)).pages)
    return p.read_text(encoding="utf-8", errors="ignore")


def _inr(amount: str, unit: str) -> int:
    n = float(amount.replace(",", ""))
    return int(n * {"crore": 1e7, "cr": 1e7, "lakh": 1e5, "lac": 1e5, "million": 1e6}.get(unit.lower(), 1))


def _short(s: str, n: int = 90) -> str:
    s = " ".join(s.split()).strip(" ,.")
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def _area(m: re.Match) -> tuple[str, str, str]:
    unit = re.sub(r"\.\s*", " ", m.group(2).lower()).replace("  ", " ").strip()
    m2 = float(m.group(1).replace(",", "")) * AREA_TO_M2.get(unit, 1.0)
    kind = (m.group(3) or "site").lower()
    return str(round(m2)), "m2", f"{m.group(1)} {m.group(2)} {kind}"


# (field, pattern, parse) — parse returns (value, unit, clean claim text).
PATTERNS: list[tuple[str, re.Pattern, callable]] = [
    ("founded_year", re.compile(r"(?:over |more than )?(\d{1,3})\+?\s*years? of experience(?: in ([^.,;]+))?", re.I),
     lambda m: (m.group(1), "years", _short(f"Over {m.group(1)} years of experience" +
                                            (f" in {m.group(2)}" if m.group(2) else ""), 70))),
    ("founded_year", re.compile(r"\b(?:since|established in|founded in|est\.?)\s*((?:19|20)\d{2})", re.I),
     lambda m: (m.group(1), "year", f"In operation since {m.group(1)}")),
    ("location", re.compile(r"registered office is in ([A-Z][\w ]+?(?:, [A-Z][\w ]+)?)(?=[,.]| at |\n)", re.I),
     lambda m: (m.group(1).strip(), "registered office", f"Registered office in {m.group(1).strip()}")),
    ("location", re.compile(r"(factory|plant|facility|manufacturing unit|warehouse) (?:at|in) "
                            r"((?:Plot|Gat|Survey|Unit|Shed|No\.?|[A-Z])[^.;]*?)(?=\s+(?:has|with|since|which|where|that)\b|[.;]|$)"),
     lambda m: (m.group(2).strip(" ,"), m.group(1).lower(), f"{m.group(1).capitalize()} at {m.group(2).strip(' ,')}")),
    ("site_area", re.compile(r"([\d,]+(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|square feet|sq\.?\s*m|sqm|m²|square met(?:re|er)s|acres?)\b"
                             r"(?:\s+(factory|plant|facility|site|campus|unit|warehouse))?", re.I), _area),
    ("turnover", re.compile(r"turnover[^\d₹]{0,40}(?:rs\.?|₹|inr)\s*([\d.,]+)\s*(crore|cr|lakh|lac|million)", re.I),
     lambda m: (str(_inr(m.group(1), m.group(2))), "INR", f"Annual turnover ₹{m.group(1)} {m.group(2)}")),
    ("certification", re.compile(r"(ISO\s*\d{4,5}(?::\d{4})?|IATF\s*16949(?::\d{4})?)[^.\n]{0,20}?certified", re.I),
     lambda m: (m.group(1), "", f"{m.group(1)} certified")),
    ("clients", re.compile(r"supplier to ((?:major |leading |top )?[A-Za-z][\w ]*?(?:OEMs?|manufacturers|brands)(?: in [A-Z][a-z]+)?)",
                           re.I),
     lambda m: (m.group(1).strip(), "", f"Supplier to {m.group(1).strip()}")),
    ("capacity", re.compile(r"(\d+(?:\.\d+)?)\s*(million|lakh)?\s*(?:machined )?(?:parts|units|pieces) (?:per|a) (?:year|annum)",
                            re.I),
     lambda m: (m.group(0), "", _short(m.group(0)).capitalize())),
    ("capacity", re.compile(r"(\d+)\s+CNC machining centres", re.I),
     lambda m: (m.group(1), "machines", f"{m.group(1)} CNC machining centres")),
    ("employees", re.compile(r"(\d[\d,]*)\+?\s*(?:skilled )?(?:employees|staff|workers)", re.I),
     lambda m: (m.group(1).replace(",", ""), "people", f"{m.group(1)}+ employees")),
]


def extract_rules(text: str) -> list[ExtractedClaim]:
    flat = " ".join(text.split())
    claims, seen = [], set()
    for fld, pattern, parse in PATTERNS:
        for m in pattern.finditer(flat):
            value, unit, clean = parse(m)
            key = (fld, value.lower())
            if key in seen:
                continue
            seen.add(key)
            claims.append(ExtractedClaim(clean, fld, value, unit))
    return claims


async def extract(text: str) -> tuple[list[ExtractedClaim], str]:
    """Returns (claims, method) where method is 'llm' or 'rules'."""
    out = await llm.structured("claims.extract", EXTRACT_SYSTEM, text[:30000], EXTRACT_SCHEMA)
    if out and out.get("claims"):
        return [ExtractedClaim(c["text"], c["field"] if c["field"] in FIELDS else "other", str(c["value"]),
                               c.get("unit", "")) for c in out["claims"]], "llm"
    return extract_rules(text), "rules"


def _state_of(place: str) -> str | None:
    p = place.lower()
    for city, state in CITY_STATE.items():
        if re.search(rf"\b{city}\b", p):
            return state
    return next((s.title() for s in STATES if s in p), None)


def _fmt_inr(n: float) -> str:
    return f"₹{n / 1e7:,.1f} crore" if n >= 1e7 else f"₹{n / 1e5:,.1f} lakh"


def verify(claim: ExtractedClaim, facts: dict, today: date) -> Verdict:
    """Deterministic: compares a claim with registry facts. facts keys: company, gst, ev_company, ev_gst, ids."""
    co, gst_rows = facts.get("company") or {}, facts.get("gst") or []
    ev_co, ev_gst = facts.get("ev_company"), facts.get("ev_gst")
    company_node = facts.get("company_node")
    inc = co.get("date_of_incorporation")

    if claim.field == "founded_year" and inc:
        inc_date = date.fromisoformat(inc[:10])
        digits = re.sub(r"\D", "", claim.value)
        if not digits:
            return _unverifiable(claim)
        n = int(digits)
        implied = today.year - n if claim.unit.startswith("years") or n < 200 else n
        age = (today - inc_date).days / 365.25
        if implied >= inc_date.year - 1:
            return Verdict("verified", f"Consistent with incorporation on {inc} (MCA).",
                           f"MCA登記上の設立日 {inc} と整合しています。", [ev_co], [company_node])
        return Verdict(
            "contradicted",
            f"Incorporated {inc} (MCA), {age:.1f} years ago. The claim implies operations since about {implied}; "
            "no predecessor entity appears in the records checked.",
            f"MCA登記上の設立日は {inc}（約{age:.1f}年前）です。主張は{implied}年頃からの事業を示唆しますが、"
            "確認した記録に前身企業は見当たりません。", [ev_co], [company_node])

    if claim.field == "location":
        state = _state_of(claim.value)
        reg_state = co.get("state", "")
        gst_states = {g.get("state") for g in gst_rows if g.get("state")}
        address = (co.get("registered_address") or "").lower()
        kind = claim.unit or "facility"
        if not state:
            return _unverifiable(claim)
        city_hit = any(re.search(rf"\b{c}\b", address) for c, s in CITY_STATE.items()
                       if s == state and re.search(rf"\b{c}\b", claim.value.lower()))
        if "registered" in kind:
            if city_hit or state == reg_state:
                return Verdict("verified", f"Registered office on MCA record: {co.get('registered_address')}.",
                               f"MCA登記上の本店所在地と一致します：{co.get('registered_address')}", [ev_co], [company_node])
            return Verdict("contradicted", f"MCA lists the registered office in {reg_state}, not {state}.",
                           f"MCA登記上の本店所在地は{reg_state}であり、{state}ではありません。", [ev_co], [company_node])
        if state == reg_state or state in gst_states:
            return Verdict("verified", f"The company is registered in {state} (MCA/GST).",
                           f"{state}州での登記（MCA/GST）を確認しました。", [e for e in (ev_co, ev_gst) if e], [company_node])
        registered_in = ", ".join(sorted({reg_state, *gst_states} - {""})) or "no state"
        return Verdict(
            "contradicted",
            f"No GST registration or registered office in {state}. A {kind} there needs a GST registration in "
            f"that state; records show only {registered_in}.",
            f"{state}州にはGST登録も本店もありません。同州で{kind}を運営するには同州でのGST登録が必要ですが、"
            f"記録上は{registered_in}のみです。", [e for e in (ev_co, ev_gst) if e], [company_node])

    if claim.field == "turnover":
        digits = re.sub(r"[^\d]", "", claim.value)
        amount = float(digits) if digits else 0
        active = [g for g in gst_rows if str(g.get("status", "")).lower() == "active"]
        if gst_rows and not active and amount >= 4e6:
            g = gst_rows[0]
            return Verdict(
                "contradicted",
                f"GST registration {g['gstin']} is {g['status'].lower()} since {g.get('cancellation_date') or 'n/a'}. "
                f"A company cannot lawfully invoice {_fmt_inr(amount)} a year without an active GSTIN; "
                f"paid-up capital is {_fmt_inr(co.get('paid_up_capital') or 0)} and no financial statements were found.",
                f"GST登録 {g['gstin']} は {g.get('cancellation_date') or '—'} 以降「{g['status']}」です。"
                f"有効なGSTINなしに年間{_fmt_inr(amount)}の請求は法的にできません。払込資本金は"
                f"{_fmt_inr(co.get('paid_up_capital') or 0)}で、財務諸表の提出も確認できません。",
                [e for e in (ev_gst, ev_co) if e], [company_node])
        return _unverifiable(claim, "Financial statements were not part of the records checked; request audited accounts.",
                             "確認した記録に財務諸表は含まれていません。監査済み財務諸表の提出を求めてください。")

    hints = {
        "certification": ("No public certification registry was checked; ask for the certificate and verify its number "
                          "with the issuing body.", "公的な認証登録簿は確認していません。認証書の提出を求め、認証機関で番号を照会してください。"),
        "clients": ("Customer relationships are not in public records; ask for references you can call.",
                    "取引先情報は公的記録にありません。直接確認できる取引先の紹介を求めてください。"),
        "employees": ("Headcount is not in the records checked; EPFO filings or a site visit can confirm it.",
                      "従業員数は確認した記録にありません。EPFOの届出や現地訪問で確認できます。"),
        "capacity": ("Production capacity can only be confirmed on a site visit.", "生産能力は現地訪問でのみ確認できます。"),
        "site_area": ("Site area is checked against satellite building data in the ground step.",
                      "敷地面積は現地確認ステップで衛星の建物データと照合します。"),
    }
    en, ja = hints.get(claim.field, ("No public record covers this claim.", "この主張を裏付ける公的記録はありません。"))
    return _unverifiable(claim, en, ja)


def _unverifiable(claim: ExtractedClaim, en: str = "Not checkable against the records collected.",
                  ja: str = "収集した記録では確認できません。") -> Verdict:
    return Verdict("unverifiable", en, ja)
