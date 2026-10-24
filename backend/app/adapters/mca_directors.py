"""Directors (DIN) of a company, and each DIN's other directorships. SEED, or a paid provider by env key."""
from __future__ import annotations

import httpx

from ..config import DIRECTOR_API_KEY, DIRECTOR_PROVIDER
from .base import NotAvailable, SourceAdapter, pick
from .seed_store import store


class McaDirectors(SourceAdapter):
    name = "mca_directors"
    source_name = "MCA21 director master"
    url = "https://www.mca.gov.in/content/mca/global/en/mca/master-data/MDS.html"

    async def live(self, query: dict) -> list[dict]:
        if DIRECTOR_PROVIDER != "probe42" or not DIRECTOR_API_KEY:
            raise NotAvailable("no director data provider configured")
        headers = {"x-api-key": DIRECTOR_API_KEY, "accept": "application/json", "x-api-version": "1.3"}
        async with httpx.AsyncClient(timeout=self.timeout_s, headers=headers) as client:
            if "cin" in query:
                resp = await client.get(f"https://api.probe42.in/probe_pro/companies/{query['cin']}/base-details")
                resp.raise_for_status()
                people = resp.json().get("data", {}).get("authorized_signatories", [])
                return [{"din": pick(p, "din", "pan"), "name": pick(p, "name"), "designation": pick(p, "designation"),
                         "appointed_on": pick(p, "date_of_appointment")} for p in people]
            raise NotAvailable("DIN expansion not offered by provider")

    def seed(self, query: dict) -> tuple[list[dict], str]:
        s = store()
        if "cin" in query:
            rows = s.directors_by_cin.get(query["cin"])
            if rows is None:
                raise NotAvailable("CIN not in seed")
            return [{k: v for k, v in d.items() if k != "companies"} for d in rows], s.mode_for(query["cin"])
        key = query["din"] or f"name:{query.get('name')}"
        cins = s.companies_by_din.get(key)
        if cins is None:
            raise NotAvailable("DIN not in seed")
        rows = [{"cin": c, "name": s.companies.get(c, {}).get("name", c)} for c in cins]
        return rows, s.mode_for(cins[0])

    def summarize(self, records: list[dict]) -> str:
        if records and "din" in records[0]:
            return f"{len(records)} directors"
        return f"{len(records)} directorships"
