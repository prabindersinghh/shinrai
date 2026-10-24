"""IBBI public announcements (CIRP / liquidation). LIVE scrape by company name; else SEED."""
from __future__ import annotations

import asyncio
import html
import re

import httpx

from .base import NotAvailable, SourceAdapter
from .seed_store import norm_name, store

ROW = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S | re.I)
CELL = re.compile(r"<td[^>]*>(.*?)</td>", re.S | re.I)
TAG = re.compile(r"<[^>]+>")


class Ibbi(SourceAdapter):
    name = "ibbi"
    source_name = "IBBI / NCLT"
    url = "https://ibbi.gov.in/en/public-announcement"

    async def _search(self, client: httpx.AsyncClient, name: str) -> list[dict]:
        resp = await client.get(self.url, params={"title": name})
        resp.raise_for_status()
        rows = []
        for row in ROW.findall(resp.text):
            cells = [html.unescape(TAG.sub(" ", c)).strip() for c in CELL.findall(row)]
            if len(cells) >= 3 and norm_name(name) in norm_name(" ".join(cells)):
                kind = cells[0]
                rows.append({"name": name, "type": "Liquidation" if "liquidation" in kind.lower() else "CIRP" if "insolvency" in kind.lower() else kind,
                             "announcement": kind, "announced": cells[1], "last_date_of_claims": cells[2] if len(cells) > 2 else None,
                             "detail": " | ".join(cells[3:6]), "url": self.url})
        return rows

    async def live(self, query: dict) -> list[dict]:
        headers = {"User-Agent": "Mozilla/5.0 (Shinrai due-diligence research)"}
        async with httpx.AsyncClient(timeout=self.timeout_s, headers=headers, follow_redirects=True) as client:
            batches = await asyncio.gather(*(self._search(client, n) for n in query["names"][:6]))
        return [r for b in batches for r in b]

    def seed(self, query: dict) -> tuple[list[dict], str]:
        s = store()
        cins = set(query.get("cins", []))
        if not cins & set(s.companies):
            raise NotAvailable("companies not in seed")
        rows = [i for i in s.insolvency if i["cin"] in cins]
        return rows, s.mode_for(next(iter(cins & set(s.companies))))

    def summarize(self, records: list[dict]) -> str:
        return f"{len(records)} insolvency announcement{'s' if len(records) != 1 else ''}"
