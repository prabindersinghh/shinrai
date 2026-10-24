"""Headless run of the demo partners (no theater pacing). Prints score, flags and claims.

Run: python -m scripts.run_one [sunrise|kaveri|maruti|all]
"""
from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import select  # noqa: E402

from app.engine.orchestrator import RUNS, Run, run_investigation  # noqa: E402
from app.main import demo_setup  # noqa: E402
from app.models import Claim, Flag, Investigation, init_db, session  # noqa: E402


async def run(partner_id: int) -> Investigation:
    with session() as s:
        inv = Investigation(partner_id=partner_id, mode="auto")
        s.add(inv)
        s.commit()
        s.refresh(inv)
    RUNS[inv.id] = Run(inv.id)
    t0 = time.perf_counter()
    await run_investigation(inv.id, speed=0)
    with session() as s:
        inv = s.get(Investigation, inv.id)
        flags = list(s.exec(select(Flag).where(Flag.inv_id == inv.id)))
        claims = list(s.exec(select(Claim).where(Claim.inv_id == inv.id)))
    print(f"\n=== {inv.company.get('name')} · {inv.status} · {inv.overall_score} {inv.band} · fit {inv.fit_score} "
          f"· {time.perf_counter() - t0:.1f}s · mode {inv.mode_used}")
    print("subscores", inv.subscores)
    for f in flags:
        print(f"  [{f.severity:8}] {f.rule_id:28} -{f.deduction:<3} {f.text_en[:90]}  {f.evidence_ids}")
    for c in claims:
        print(f"  claim {c.verdict:13} {c.field:13} {c.text[:70]}")
    print("  narrative:", (inv.narrative or {}).get("method"), (inv.narrative or {}).get("summary_ja", "")[:160])
    return inv


async def main(which: str) -> None:
    init_db()
    demo = demo_setup()
    ids = {"sunrise": demo["partners"][0]["id"], "kaveri": demo["partners"][1]["id"],
           "maruti": demo["partners"][2]["id"]}
    for name in (ids if which == "all" else [which]):
        await run(ids[name])


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "all"))
