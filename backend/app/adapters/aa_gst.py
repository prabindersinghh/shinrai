"""SIMULATED Account Aggregator GST data (GSTR-3B monthly turnover, 18 months), shared with partner consent.

Production would receive this through a regulated bank/NBFC partner; here it is sandbox data in SEED mode only.
"""
from __future__ import annotations

import json
from functools import lru_cache

from ..config import SEED_DIR
from .base import NotAvailable, SourceAdapter


@lru_cache(maxsize=1)
def _data() -> dict:
    path = SEED_DIR / "aa_gst.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


class AaGst(SourceAdapter):
    name = "aa_gst"
    source_name = "Account Aggregator · GSTR-3B (SIMULATED)"
    url = "https://sahamati.org.in/"

    def mode_order(self, requested: str) -> list[str]:
        return ["seed"]

    def seed(self, query: dict) -> tuple[list[dict], str]:
        rows = _data().get(query["cin"])
        if rows is None:
            raise NotAvailable("no sandbox returns for this company")
        return rows, "seed"

    def summarize(self, records: list[dict]) -> str:
        total = sum(r["taxable_turnover"] for r in records[-12:])
        return f"{len(records)} months of GSTR-3B · last 12 months ₹{total / 1e7:,.2f} crore"
