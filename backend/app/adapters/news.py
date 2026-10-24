"""News mentions via the GDELT DOC 2.0 API (LIVE, no key); else SEED."""
from __future__ import annotations

import httpx

from .base import NotAvailable, SourceAdapter
from .seed_store import store

GDELT = "https://api.gdeltproject.org/api/v2/doc/doc"


class News(SourceAdapter):
    name = "news"
    source_name = "GDELT news"
    url = "https://www.gdeltproject.org/"

    async def live(self, query: dict) -> list[dict]:
        terms = " OR ".join(f'"{t}"' for t in query["terms"][:4])
        q = f"({terms}) sourcecountry:IN" if len(query["terms"]) > 1 else f"{terms} sourcecountry:IN"
        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            resp = await client.get(GDELT, params={"query": q, "mode": "artlist", "format": "json",
                                                   "maxrecords": 15, "timespan": "24months", "sort": "datedesc"})
            resp.raise_for_status()
            body = resp.json() if resp.text.strip().startswith("{") else {}
        return [{"title": a.get("title", ""), "url": a.get("url", ""), "source": a.get("domain", ""),
                 "date": (a.get("seendate") or "")[:8], "snippet": "", "about": query.get("target")}
                for a in body.get("articles", [])]

    def seed(self, query: dict) -> tuple[list[dict], str]:
        s = store()
        target = query.get("target")
        if target not in s.news:
            raise NotAvailable("company not in seed")
        return [{k: v for k, v in n.items() if k != "tone"} for n in s.news[target]], s.mode_for(target)

    def summarize(self, records: list[dict]) -> str:
        return f"{len(records)} articles scanned"
