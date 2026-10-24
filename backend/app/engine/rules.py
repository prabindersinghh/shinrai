"""Loads rulebook.yaml and evaluates named predicates over the collected facts. Deterministic."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Callable

import yaml
from rapidfuzz import fuzz

from .graph import GraphState

RULEBOOK = Path(__file__).resolve().parent.parent / "rulebook.yaml"
NOT_ACTIVE = {"strike off", "struck off", "under liquidation", "liquidated", "dormant", "amalgamated", "dissolved",
              "under process of striking off", "converted to llp and dissolved", "under cirp"}
RESPONDENT_ROLES = {"respondent", "accused", "defendant", "opposite party"}
STATUS_JA = {"Cancelled": "取消", "Suspended": "停止中", "Inactive": "無効"}


@dataclass
class Facts:
    input_label: str
    today: date
    graph: GraphState
    registry_checked: bool = False
    company: dict | None = None
    company_node: str | None = None
    input_gstin: str | None = None
    gst: list[dict] = field(default_factory=list)
    gst_local: dict | None = None
    directors: list[dict] = field(default_factory=list)  # {node, din, name, companies:[cin]}
    linked: dict[str, dict] = field(default_factory=dict)  # cin -> master record
    struck: dict[str, dict] = field(default_factory=dict)
    disqualified: dict[str, dict] = field(default_factory=dict)
    cases: list[dict] = field(default_factory=list)  # {node, party_node, role, status}
    insolvency: list[dict] = field(default_factory=list)
    news: list[dict] = field(default_factory=list)  # {node, about_node, tone}
    claims: list[dict] = field(default_factory=list)  # {node, text, field, value, unit, verdict, evidence_ids}
    ground: dict = field(default_factory=dict)  # addresses, buildings series, night lights, verdicts
    money: dict = field(default_factory=dict)  # consented GSTR-3B turnover (simulated AA)
    audit: dict = field(default_factory=dict)  # completed Genba audit items
    ev: dict[str, list[str]] = field(default_factory=dict)

    def evs(self, *keys: str) -> list[str]:
        out: list[str] = []
        for k in keys:
            out += [e for e in self.ev.get(k, []) if e not in out]
        return out


@dataclass
class Hit:
    entity_ids: list[str]
    evidence_ids: list[str]
    params: dict = field(default_factory=dict)


Predicate = Callable[[Facts], list[Hit]]
PREDICATES: dict[str, Predicate] = {}


def predicate(fn: Predicate) -> Predicate:
    PREDICATES[fn.__name__] = fn
    return fn


def months_between(a: date, b: date) -> int:
    return (b.year - a.year) * 12 + b.month - a.month - (1 if b.day < a.day else 0)


def inr(n: float) -> str:
    return f"₹{n / 1e7:,.1f} crore" if n >= 1e7 else f"₹{n / 1e5:,.1f} lakh"


def _d(s: str | None) -> date | None:
    return date.fromisoformat(s[:10]) if s else None


@predicate
def registry_no_match(f: Facts) -> list[Hit]:
    if f.registry_checked and f.company is None:
        return [Hit([], f.evs("resolve"), {"input": f.input_label})]
    return []


@predicate
def status_not_active(f: Facts) -> list[Hit]:
    if f.company and str(f.company.get("status", "")).lower() in NOT_ACTIVE:
        return [Hit([f.company_node], f.evs("company"), {"status": f.company["status"]})]
    return []


@predicate
def gstin_pan_mismatch(f: Facts) -> list[Hit]:
    loc, co = f.gst_local, f.company
    if not loc or not co:
        return []
    ids = [f"g_{loc['gstin']}", f.company_node]
    if not loc["format_ok"] or not loc["checksum_ok"]:
        return [Hit(ids, f.evs("gst_local"), {"gstin": loc["gstin"], "reason": "invalid GSTIN checksum",
                                              "reason_ja": "GSTINのチェックサムが不正"})]
    if co.get("pan") and loc["pan"] != co["pan"]:
        return [Hit(ids, f.evs("gst_local", "company"), {"gstin": loc["gstin"],
                                                         "reason": f"embedded PAN {loc['pan']} ≠ company PAN {co['pan']}",
                                                         "reason_ja": f"内包PAN {loc['pan']} が法人PAN {co['pan']} と不一致"})]
    for g in f.gst:
        if g["gstin"] == loc["gstin"] and g.get("legal_name") and fuzz.token_sort_ratio(
                g["legal_name"].lower(), co["name"].lower()) < 85:
            return [Hit(ids, f.evs("gst", "company"), {"gstin": loc["gstin"],
                                                       "reason": f"legal name on GST is {g['legal_name']}",
                                                       "reason_ja": f"GST上の商号は{g['legal_name']}"})]
    return []


@predicate
def state_mismatch(f: Facts) -> list[Hit]:
    # ADDRESS_MISMATCH (geocoded pins) is the stronger form of the same finding; never count both.
    if not f.company or not f.gst_local or not f.gst_local.get("state") or address_mismatch(f):
        return []
    gst_state, reg_state = f.gst_local["state"], f.company.get("state")
    claimed = {c.get("state") for c in f.claims if c["field"] == "location" and c.get("state")}
    if gst_state != reg_state and claimed and not claimed & {gst_state, reg_state}:
        return [Hit([f.company_node], f.evs("gst_local", "company", "doc"),
                    {"gst_state": gst_state, "reg_state": reg_state})]
    return []


@predicate
def gst_cancelled(f: Facts) -> list[Hit]:
    hits = []
    for g in f.gst:
        if g.get("cin", f.company and f.company["cin"]) != (f.company or {}).get("cin"):
            continue
        status = str(g.get("status", "")).title()
        if status in ("Cancelled", "Suspended"):
            since = g.get("cancellation_date") or "n/a"
            hits.append(Hit([f"g_{g['gstin']}", f.company_node], f.evs("gst"),
                            {"gstin": g["gstin"], "status": status.lower(), "status_ja": STATUS_JA.get(status, status),
                             "since": since}))
    return hits


@predicate
def filing_overdue(f: Facts) -> list[Hit]:
    co = f.company
    if not co or not co.get("date_of_incorporation") or "last_agm_date" not in co:
        return []
    inc = _d(co["date_of_incorporation"])
    last = max(filter(None, [_d(co.get("last_agm_date")), _d(co.get("last_bs_date"))]), default=None)
    if last is None:
        # First FY closes on 31 March of the following year; the first AGM is due within 9 months of it.
        due = date(inc.year + 1, 12, 31)
        if months_between(inc, f.today) <= 18 or f.today <= due:
            return []
        return [Hit([f.company_node], f.evs("company"), {"months": months_between(due, f.today),
                                                          "last": "none on record", "last_ja": "記録なし"})]
    if months_between(last, f.today) > 18:
        due = date(last.year + 1, last.month, min(last.day, 28))
        return [Hit([f.company_node], f.evs("company"),
                    {"months": months_between(due, f.today), "last": last.isoformat(), "last_ja": last.isoformat()})]
    return []


@predicate
def young_low_capital(f: Facts) -> list[Hit]:
    co = f.company
    if not co or not co.get("date_of_incorporation"):
        return []
    age = months_between(_d(co["date_of_incorporation"]), f.today)
    if age < 12 and float(co.get("paid_up_capital") or 0) <= 100000:
        return [Hit([f.company_node], f.evs("company"), {"months": age, "capital": inr(co["paid_up_capital"])})]
    return []


@predicate
def insolvency(f: Facts) -> list[Hit]:
    if not f.company:
        return []
    return [Hit([i["node"], f.company_node], f.evs("ibbi"),
                {"kind": i.get("type", "Insolvency"), "authority": i.get("authority", "NCLT"), "date": i.get("announced", "")})
            for i in f.insolvency if i.get("cin") == f.company["cin"]]


@predicate
def cases_as_respondent(f: Facts) -> list[Hit]:
    rows = [c for c in f.cases if c["party_node"] == f.company_node
            and str(c.get("role", "")).lower() in RESPONDENT_ROLES and str(c.get("status", "")).lower() == "pending"]
    if len(rows) >= 2:
        return [Hit([c["node"] for c in rows] + [f.company_node], f.evs("courts"), {"count": len(rows)})]
    return []


@predicate
def director_disqualified(f: Facts) -> list[Hit]:
    return [Hit([d["node"]], f.evs("strikeoff", "directors"), {"name": d["name"], "din": d["din"]})
            for d in f.directors if d.get("din") and d["din"] in f.disqualified]


@predicate
def struckoff_links(f: Facts) -> list[Hit]:
    hits = []
    target = (f.company or {}).get("cin")
    for d in f.directors:
        struck = [c for c in d["companies"] if c != target and (c in f.struck or str(
            f.linked.get(c, {}).get("status", "")).lower() in ("strike off", "struck off"))]
        if len(struck) >= 2:
            names = [f.linked.get(c, {}).get("name", c) for c in struck]
            hits.append(Hit([d["node"], *[f"c_{c}" for c in struck]],
                            f.evs(f"expand:{d['din'] or d['name']}", "strikeoff", "enrich"),
                            {"name": d["name"], "count": len(struck), "companies": ", ".join(names)}))
    return hits


@predicate
def high_degree_director(f: Facts) -> list[Hit]:
    return [Hit([d["node"]], f.evs(f"expand:{d['din'] or d['name']}"), {"name": d["name"], "count": len(d["companies"])})
            for d in f.directors if len(d["companies"]) >= 10]


@predicate
def shared_address_cluster(f: Facts) -> list[Hit]:
    if not f.company_node:
        return []
    for a in f.graph.neighbors(f.company_node, "registered_at"):
        others = [n for n in f.graph.neighbors(a, "registered_at") if n != f.company_node]
        if len(others) >= 5:
            return [Hit([a, f.company_node, *others], f.evs("company", "enrich"), {"count": len(others)})]
    return []


@predicate
def claim_contradicted(f: Facts) -> list[Hit]:
    return [Hit([c["node"]], c["evidence_ids"] + f.evs("doc"), {"claim": c["text"]})
            for c in f.claims if c["verdict"] == "contradicted"]


@predicate
def adverse_news(f: Facts) -> list[Hit]:
    subjects = {f.company_node: (f.company or {}).get("name", "the company")}
    subjects.update({d["node"]: d["name"] for d in f.directors})
    rows = [n for n in f.news if n["tone"] == "adverse" and n["about_node"] in subjects]
    if not rows:
        return []
    names = sorted({subjects[n["about_node"]] for n in rows})
    return [Hit([n["node"] for n in rows], f.evs("news"), {"count": len(rows), "subject": ", ".join(names)})]


def _ground_site(f: Facts) -> tuple[dict | None, str | None]:
    """The analysed site and the most severe level its pin precision allows."""
    site = (f.ground or {}).get("site")
    if not site:
        return None, None
    return site, "medium" if site.get("precision") in ("locality", "pin_code") else None


def _ground_ev(f: Facts, *extra: str) -> list[str]:
    g = f.ground
    base = [g.get("buildings", {}).get("evidence_id") if g.get("buildings", {}).get("series") else
            g.get("osm", {}).get("evidence_id")]
    return [e for e in base if e] + f.evs("ground_img", *extra)


@predicate
def ground_no_building(f: Facts) -> list[Hit]:
    site, cap = _ground_site(f)
    b = (f.ground or {}).get("buildings", {})
    if site and b.get("series") and (b.get("latest_area_m2") or 0) < 100:
        return [Hit([site["node"]], _ground_ev(f), {"area": b.get("latest_area_m2") or 0,
                                                    "year": b["series"][-1]["year"], "_max_severity": cap})]
    return []


@predicate
def ground_after_claimed_year(f: Facts) -> list[Hit]:
    site, cap = _ground_site(f)
    g = f.ground or {}
    b, year = g.get("buildings", {}), (g.get("claimed") or {}).get("founded_year")
    first = b.get("first_year_built")
    if site and b.get("series") and first and year and first > year and (
            year >= 2016 or b["series"][0]["built_area_m2"] < 100):
        return [Hit([site["node"]], _ground_ev(f, "doc"), {"first": first, "claimed": year, "_max_severity": cap})]
    return []


@predicate
def ground_area_mismatch(f: Facts) -> list[Hit]:
    site, cap = _ground_site(f)
    g = f.ground or {}
    claimed = (g.get("claimed") or {}).get("area_m2")
    b, osm = g.get("buildings", {}), g.get("osm", {})
    measured = b.get("latest_area_m2") if b.get("series") else (osm.get("total_area_m2") if osm.get("count") else None)
    if site and claimed and measured is not None and claimed > 3 * max(measured, 1):
        return [Hit([site["node"]], _ground_ev(f, "doc"), {"claimed": f"{claimed:,.0f}", "claimed_sqft":
                    f"{claimed / 0.092903:,.0f}", "measured": f"{measured:,}", "_max_severity": cap})]
    return []


@predicate
def ground_low_activity(f: Facts) -> list[Hit]:
    site, cap = _ground_site(f)
    g = f.ground or {}
    nl = g.get("nightlights") or {}
    ratio = nl.get("activity_ratio")
    if site and ratio is not None and ratio < 1.1 and (g.get("claimed") or {}).get("production"):
        return [Hit([site["node"]], [nl["evidence_id"]], {"ratio": ratio, "_max_severity": cap})]
    return []


@predicate
def address_mismatch(f: Facts) -> list[Hit]:
    # Multi-state footprints are normal for large firms; the signal is a claimed site in a state where the company
    # has neither its registered office nor a GST registration.
    addrs = [a for a in (f.ground or {}).get("addresses", []) if a.get("state")]
    states = {a["state"] for a in addrs}
    claimed = next((a for a in addrs if a["role"] == "claimed_site"), None)
    official = {a["state"] for a in addrs if a["role"] != "claimed_site"} | {g.get("state") for g in f.gst}
    if claimed and claimed["state"] not in official and len(states) >= 2:
        listing = "; ".join(f"{a['role'].replace('_', ' ')}: {a['state']}" for a in addrs)
        return [Hit([a["node"] for a in addrs] + [f.company_node], [a["evidence_id"] for a in addrs] + f.evs("company"),
                    {"count": len(states), "listing": listing})]
    return []


@predicate
def money_turnover_mismatch(f: Facts) -> list[Hit]:
    m = f.money or {}
    claimed = m.get("claimed_turnover")
    declared = m.get("declared_12m")
    if m.get("status") == "received" and claimed and declared is not None and claimed > 2 * declared:
        nodes = [c["node"] for c in f.claims if c["field"] == "turnover"] + [f.company_node]
        return [Hit(nodes, [m["evidence_id"]] + f.evs("doc"),
                    {"claimed": inr(claimed), "declared": inr(declared), "ratio": f"{claimed / max(declared, 1):,.0f}"})]
    return []


@predicate
def audit_item_failed(f: Facts) -> list[Hit]:
    a = f.audit or {}
    if a.get("status") != "completed":
        return []
    return [Hit([it["claim_node"] or f.company_node], it["evidence_ids"],
                {"item": it["text_en"], "item_ja": it["text_ja"], "note": it.get("note") or "see photos"})
            for it in a.get("items", []) if it["status"] == "fail" and it.get("evidence_ids")]


@lru_cache(maxsize=1)
def rulebook() -> dict:
    return yaml.safe_load(RULEBOOK.read_text(encoding="utf-8"))


SEVERITY_RISK = {"critical": "critical", "high": "high", "medium": "med", "low": "low"}


SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def evaluate(facts: Facts) -> list[dict]:
    """Returns flag dicts. A hit without evidence is dropped: no source, no flag."""
    flags = []
    for rule in rulebook()["rules"]:
        for hit in PREDICATES[rule["condition"]](facts):
            evidence = list(dict.fromkeys(e for e in hit.evidence_ids if e))
            if not evidence:
                continue
            severity, deduction = rule["severity"], rule["deduction"]
            cap = hit.params.get("_max_severity")
            if cap and SEVERITY_RANK[severity] > SEVERITY_RANK[cap]:
                severity, deduction = cap, min(deduction, 10)
            flags.append({
                "rule_id": rule["id"], "family": rule["family"], "severity": severity, "deduction": deduction,
                "entity_ids": list(dict.fromkeys(e for e in hit.entity_ids if e)), "evidence_ids": evidence,
                "text_en": rule["text_en"].format(**hit.params), "text_ja": rule["text_ja"].format(**hit.params),
                "approximate": bool(cap),
            })
    return flags
