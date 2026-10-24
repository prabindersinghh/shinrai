"""MCA struck-off (Sec 248) and disqualified-director (Sec 164(2)) lists. SEED file, used in every mode."""
from __future__ import annotations

from .base import SourceAdapter
from .seed_store import store


class StrikeOff(SourceAdapter):
    name = "strikeoff"
    source_name = "MCA Sec 248 / 164(2) lists"
    url = "https://www.mca.gov.in/content/mca/global/en/notifications-tender/news-updates/stk-notices.html"

    def mode_order(self, requested: str) -> list[str]:
        return ["seed"]

    def seed(self, query: dict) -> tuple[list[dict], str]:
        s = store()
        rows = [{"kind": "struck_off", **s.strikeoff[c]} for c in query.get("cins", []) if c in s.strikeoff]
        rows += [{"kind": "disqualified", **s.disqualified[d]} for d in query.get("dins", []) if d in s.disqualified]
        return rows, "seed"

    def summarize(self, records: list[dict]) -> str:
        struck = sum(r["kind"] == "struck_off" for r in records)
        disq = sum(r["kind"] == "disqualified" for r in records)
        return f"{struck} struck off · {disq} disqualified"
