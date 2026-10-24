"""Record the real-company scenarios: run each once in LIVE mode so every adapter writes its genuine response to
data/cache/. Afterwards the scenarios replay from that cache, so the walkthrough works without internet.

Run: python -m scripts.record_scenarios        (needs internet; set DATA_GOV_IN_KEY to avoid the shared key's rate limit)
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.engine.orchestrator import RUNS, Run, run_investigation  # noqa: E402
from app.models import Investigation, Partner, Sme, init_db, session  # noqa: E402

REAL = [("Maruti Suzuki India Limited", "L34103DL1981PLC011375"), ("Future Retail Limited", None)]


async def main() -> None:
    init_db()
    with session() as s:
        sme = Sme(name="Recording workspace")
        s.add(sme)
        s.commit()
        s.refresh(sme)
        ids = []
        for name, cin in REAL:
            p = Partner(sme_id=sme.id, input_name=name, cin=cin)
            s.add(p)
            s.commit()
            s.refresh(p)
            inv = Investigation(partner_id=p.id, mode="live")
            s.add(inv)
            s.commit()
            s.refresh(inv)
            ids.append((name, inv.id))
    for name, inv_id in ids:
        RUNS[inv_id] = Run(inv_id)
        await run_investigation(inv_id, speed=0)
        with session() as s:
            inv = s.get(Investigation, inv_id)
        print(f"{name}: status {inv.status}, score {inv.overall_score}, band {inv.band}, coverage {inv.coverage}")


if __name__ == "__main__":
    asyncio.run(main())
