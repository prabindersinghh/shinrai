"""eCourts party search. LIVE via the optional `bharat-courts` package (20 s timeout); else SEED."""
from __future__ import annotations

import asyncio
import importlib

from .base import NotAvailable, SourceAdapter
from .seed_store import store


class Courts(SourceAdapter):
    name = "courts"
    source_name = "eCourts"
    url = "https://services.ecourts.gov.in/ecourtindia_v6/"
    timeout_s = 20.0

    async def live(self, query: dict) -> list[dict]:
        try:
            module = importlib.import_module("bharat_courts")
        except ImportError as exc:
            raise NotAvailable("bharat-courts not installed") from exc
        search = getattr(module, "search_party", None) or getattr(module, "party_search", None)
        if search is None:
            raise NotAvailable("bharat-courts has no party search entry point")
        result = search(query["party"])
        if asyncio.iscoroutine(result):
            result = await result
        return [dict(r) if not isinstance(r, dict) else r for r in (result or [])]

    def seed(self, query: dict) -> tuple[list[dict], str]:
        s = store()
        key = query.get("key")
        if key not in s.companies and key not in s.companies_by_din and f"name:{query['party']}" not in s.companies_by_din:
            raise NotAvailable("party not in seed")
        rows = [c for c in s.cases if c["party_key"] == key]
        mode = s.mode_for(key) if key in s.companies else rows[0]["_mode"] if rows else "seed"
        return rows, mode

    def summarize(self, records: list[dict]) -> str:
        if not records:
            return "0 cases found (absence ≠ clean)"
        return f"{len(records)} case{'s' if len(records) > 1 else ''} · {records[0].get('status', '')}"
