"""Validation run (TRD step 10): recall, false-flag rate, evidence coverage and latency.

Part A runs SYNTHETIC labelled fixtures through the real rules engine (each fixture states the flags it must and
must not raise). This measures the rulebook, not real-world accuracy: a labelled set of real companies with known
public issues still has to be assembled from live records. Part B runs the full pipeline for the three seeded
companies and checks the acceptance targets.

Run: python -m scripts.validate
"""
from __future__ import annotations

import asyncio
import sys
import time
from copy import deepcopy
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import select  # noqa: E402

from app.engine.graph import GraphState  # noqa: E402
from app.engine.orchestrator import RUNS, Run, run_investigation  # noqa: E402
from app.engine.rules import Facts, evaluate  # noqa: E402
from app.main import demo_setup  # noqa: E402
from app.models import Claim, Evidence, Flag, Investigation, init_db, session  # noqa: E402

TODAY = date(2026, 10, 24)
CLEAN_CO = {"cin": "L00000DL2000PLC000001", "name": "Clean Co Limited", "status": "Active",
            "date_of_incorporation": "2000-01-01", "state": "Delhi", "paid_up_capital": 5e8, "pan": "AAACC0000A",
            "last_agm_date": "2026-08-30", "last_bs_date": "2026-03-31"}
EV = {"resolve": ["ev_1"], "company": ["ev_1"], "gst": ["ev_2"], "gst_local": ["ev_3"], "directors": ["ev_4"],
      "strikeoff": ["ev_5"], "enrich": ["ev_6"], "courts": ["ev_7"], "ibbi": ["ev_8"], "news": ["ev_9"],
      "doc": ["ev_10"], "expand:01": ["ev_11"]}


def base(**over) -> Facts:
    g = GraphState()
    g.add_node("c_X", "company", "X")
    f = Facts(input_label="X", today=TODAY, graph=g, registry_checked=True, company=deepcopy(CLEAN_CO),
              company_node="c_X", gst=[{"gstin": "07AAACC0000A1Z5", "status": "Active", "cin": CLEAN_CO["cin"]}],
              directors=[{"node": "p_01", "din": "01", "name": "D1", "companies": [CLEAN_CO["cin"]]}],
              ev=deepcopy(EV))
    for k, v in over.items():
        setattr(f, k, v)
    return f


def with_company(**changes) -> Facts:
    f = base()
    f.company.update(changes)
    return f


def struck_links() -> Facts:
    f = base()
    f.directors[0]["companies"] += ["S1", "S2"]
    f.struck = {"S1": {}, "S2": {}}
    return f


def shared_address() -> Facts:
    f = base()
    f.graph.add_node("a_1", "address", "addr")
    f.graph.add_edge("c_X", "a_1", "registered_at")
    for i in range(5):
        f.graph.add_node(f"c_{i}", "company", str(i))
        f.graph.add_edge(f"c_{i}", "a_1", "registered_at")
    return f


FIXTURES: list[tuple[str, callable, set[str]]] = [
    ("registry no match", lambda: base(company=None, company_node=None), {"ID_NOT_FOUND"}),
    ("struck off", lambda: with_company(status="Strike Off"), {"ID_STATUS_NOT_ACTIVE"}),
    ("under liquidation", lambda: with_company(status="Under Liquidation"), {"ID_STATUS_NOT_ACTIVE"}),
    ("GST cancelled", lambda: base(gst=[{"gstin": "07AAACC0000A1Z5", "status": "Cancelled", "cin": CLEAN_CO["cin"],
                                          "cancellation_date": "2025-01-01"}]), {"CMP_GST_CANCELLED"}),
    ("filings overdue", lambda: with_company(last_agm_date="2023-09-30", last_bs_date="2023-03-31"), {"CMP_FILING_OVERDUE"}),
    ("young, ₹1 lakh capital", lambda: with_company(date_of_incorporation="2026-03-01", paid_up_capital=100000,
                                                   last_agm_date=None, last_bs_date=None), {"CMP_YOUNG_LOW_CAPITAL"}),
    ("insolvency", lambda: base(insolvency=[{"cin": CLEAN_CO["cin"], "node": "k_1", "type": "CIRP"}]), {"LEG_INSOLVENCY"}),
    ("2 cases as respondent", lambda: base(cases=[{"node": f"k_{i}", "party_node": "c_X", "role": "respondent",
                                                   "status": "Pending"} for i in range(2)]), {"LEG_CASES_AS_RESPONDENT"}),
    ("disqualified director", lambda: base(disqualified={"01": {}}), {"NET_DIRECTOR_DISQUALIFIED"}),
    ("struck-off links", struck_links, {"NET_STRUCKOFF_LINKS"}),
    ("high-degree director", lambda: base(directors=[{"node": "p_01", "din": "01", "name": "D1",
                                                     "companies": [f"C{i}" for i in range(11)]}]), {"NET_HIGH_DEGREE_DIRECTOR"}),
    ("shared address", shared_address, {"NET_SHARED_ADDRESS_CLUSTER"}),
    ("adverse news", lambda: base(news=[{"node": "n_1", "about_node": "c_X", "tone": "adverse"}]), {"REP_ADVERSE_NEWS"}),
    ("contradicted claim", lambda: base(claims=[{"node": "q_1", "text": "x", "field": "founded_year", "verdict": "contradicted",
                                                 "evidence_ids": ["ev_1"]}]), {"CLM_CONTRADICTED"}),
    ("GSTIN of another PAN", lambda: base(gst_local={"gstin": "07AAACZ9999Z1Z5", "format_ok": True, "checksum_ok": True,
                                                     "pan": "AAACZ9999Z", "state": "Delhi"}), {"ID_GSTIN_PAN_MISMATCH"}),
]
CLEAN: list[tuple[str, callable]] = [
    ("clean listed company", base),
    ("clean, 1 respondent case", lambda: base(cases=[{"node": "k_1", "party_node": "c_X", "role": "respondent", "status": "Pending"}])),
    ("clean, neutral news", lambda: base(news=[{"node": "n_1", "about_node": "c_X", "tone": "neutral"}])),
    ("clean, 1 struck-off link", lambda: (lambda f: (f.directors[0]["companies"].append("S1"), f.struck.update({"S1": {}}), f)[2])(base())),
    ("clean, 9 directorships", lambda: base(directors=[{"node": "p_01", "din": "01", "name": "D1", "companies": [f"C{i}" for i in range(9)]}])),
    ("clean, registry unreachable", lambda: base(registry_checked=False, company=None, company_node=None)),
]


def part_a() -> bool:
    hit = total = 0
    print("Part A: synthetic labelled fixtures through the real rulebook")
    for name, make, expected in FIXTURES:
        fired = {f["rule_id"] for f in evaluate(make())}
        ok = expected <= fired
        hit += len(expected & fired)
        total += len(expected)
        print(f"  {'PASS' if ok else 'FAIL'}  {name:28} expected {sorted(expected)} fired {sorted(fired)}")
    false = 0
    for name, make in CLEAN:
        serious = [f["rule_id"] for f in evaluate(make()) if f["severity"] in ("high", "critical")]
        false += bool(serious)
        print(f"  {'PASS' if not serious else 'FAIL'}  {name:28} high/critical flags: {serious}")
    recall, fpr = hit / total, false / len(CLEAN)
    print(f"  red-flag recall {recall:.0%} (target ≥ 90%) · false red-flag rate {fpr:.0%} (target ≤ 5%)")
    return recall >= 0.9 and fpr <= 0.05


async def part_b() -> bool:
    print("\nPart B: full pipeline on the seeded companies (no theater pacing)")
    init_db()
    demo = demo_setup()
    targets = {0: ("Sunrise", lambda s, f: s < 40 and len(f) >= 4), 1: ("Kaveri", lambda s, f: 60 <= s < 80),
               2: ("Maruti", lambda s, f: s >= 80 and not [x for x in f if x.severity in ("high", "critical")])}
    ok_all = True
    for i, (label, check) in targets.items():
        with session() as s:
            inv = Investigation(partner_id=demo["partners"][i]["id"])
            s.add(inv)
            s.commit()
            s.refresh(inv)
        RUNS[inv.id] = Run(inv.id)
        t0 = time.perf_counter()
        await run_investigation(inv.id, speed=0)
        secs = time.perf_counter() - t0
        with session() as s:
            inv = s.get(Investigation, inv.id)
            flags = list(s.exec(select(Flag).where(Flag.inv_id == inv.id)))
            claims = list(s.exec(select(Claim).where(Claim.inv_id == inv.id)))
            evs = {e.ev_id for e in s.exec(select(Evidence).where(Evidence.inv_id == inv.id))}
        cited = [x for x in flags if x.evidence_ids and set(x.evidence_ids) <= evs]
        claim_cited = [c for c in claims if set(c.evidence_ids) <= evs and c.evidence_ids]
        total = len(flags) + len(claims)
        coverage = (len(cited) + len(claim_cited)) / total if total else 1.0  # nothing to cite = nothing uncited
        passed = check(inv.overall_score, flags) and coverage == 1.0 and inv.status == "done"
        ok_all &= passed
        print(f"  {'PASS' if passed else 'FAIL'}  {label:8} score {inv.overall_score} ({inv.band}) · {len(flags)} flags · "
              f"{sum(c.verdict == 'contradicted' for c in claims)} contradicted claims · evidence coverage {coverage:.0%} · "
              f"{secs:.1f}s")
    return ok_all


if __name__ == "__main__":
    a = part_a()
    b = asyncio.run(part_b())
    print(f"\n{'ALL PASS' if a and b else 'SOME CHECKS FAILED'}")
    sys.exit(0 if a and b else 1)
