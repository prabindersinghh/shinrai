"""MCA company master data via the data.gov.in OGD API (LIVE), with seed fallback."""
from __future__ import annotations

import asyncio
import re

import httpx

from ..config import DATA_GOV_IN_KEY, DATA_GOV_IN_RESOURCE
from .base import HTTP_HEADERS, NotAvailable, SourceAdapter, pick
from .seed_store import store

API = "https://api.data.gov.in/resource/{res}"


def normalize(r: dict) -> dict:
    """Map data.gov.in field names onto the seed schema."""
    address = re.sub(r"\s+", " ", str(pick(r, "Registered_Office_Address", "registered_address", default="")))
    status = str(pick(r, "CompanyStatus", "status", default="Unknown")).strip()
    state = str(pick(r, "CompanyStateCode", "state", default="")).strip().title()
    return {
        "cin": pick(r, "CIN", "cin"),
        "name": str(pick(r, "CompanyName", "name", default="")).title(),
        "status": {"Strike Off": "Strike Off", "Struck Off": "Strike Off"}.get(status, status),
        "date_of_incorporation": pick(r, "CompanyRegistrationdate_date", "date_of_incorporation"),
        "state": state,
        "roc": pick(r, "CompanyROCcode", "roc"),
        "company_class": pick(r, "CompanyClass", "company_class"),
        "category": pick(r, "CompanyCategory", "category"),
        "sub_category": pick(r, "CompanySubCategory", "sub_category"),
        "listed": str(pick(r, "Listingstatus", default="")).lower() == "listed",
        "authorized_capital": float(pick(r, "AuthorizedCapital", "authorized_capital", default=0) or 0),
        "paid_up_capital": float(pick(r, "PaidupCapital", "paid_up_capital", default=0) or 0),
        "registered_address": address.replace("-India", ", India"),
        "activity": pick(r, "CompanyIndustrialClassification", "activity"),
        # The OGD dataset carries no filing dates; leaving the keys out marks filings as "not checked".
    }


class McaOgd(SourceAdapter):
    name = "mca_ogd"
    source_name = "MCA21 master data"
    url = "https://data.gov.in/catalog/company-master-data"
    timeout_s = 20.0

    async def _get(self, client: httpx.AsyncClient, field: str, value: str) -> list[dict]:
        params = {"api-key": DATA_GOV_IN_KEY, "format": "json", "limit": 5, f"filters[{field}]": value}
        resp = await client.get(API.format(res=DATA_GOV_IN_RESOURCE), params=params)
        resp.raise_for_status()
        return [normalize(r) for r in resp.json().get("records", [])]

    async def live(self, query: dict) -> list[dict]:
        if not DATA_GOV_IN_KEY:
            raise NotAvailable("DATA_GOV_IN_KEY not set")
        async with httpx.AsyncClient(timeout=self.timeout_s, headers=HTTP_HEADERS) as client:
            if "cin" in query:
                return await self._get(client, "CIN", query["cin"].upper())
            if "cins" in query:
                batches = await asyncio.gather(*(self._get(client, "CIN", c) for c in query["cins"]))
                return [r for b in batches for r in b]
            base = re.sub(r"\s+", " ", query["name"].upper().replace(".", " ")).strip()
            base = re.sub(r"\b(PVT|PRIVATE)\s*(LTD|LIMITED)?$", "", base).strip()
            base = re.sub(r"\b(LTD|LIMITED)$", "", base).strip()
            variants = list(dict.fromkeys((query["name"].upper().strip(), f"{base} PRIVATE LIMITED", f"{base} LIMITED", base)))
            results = await asyncio.gather(*(self._get(client, "CompanyName", v) for v in variants), return_exceptions=True)
            for rows in results:  # first variant in priority order that returned records
                if isinstance(rows, list) and rows:
                    return rows
            errors = [r for r in results if isinstance(r, Exception)]
            if len(errors) == len(results):
                raise errors[0]
            return []

    def seed(self, query: dict) -> tuple[list[dict], str]:
        s = store()
        if "cin" in query:
            c = s.companies.get(query["cin"].upper())
            if not c:
                raise NotAvailable("CIN not in seed")
            return [c], c["_mode"]
        if "cins" in query:
            rows = [s.companies[c] for c in query["cins"] if c in s.companies]
            if not rows:
                raise NotAvailable("CINs not in seed")
            return rows, rows[0]["_mode"]
        c, _ = s.find_by_name(query["name"])
        if not c:
            raise NotAvailable("name not in seed")
        return [c], c["_mode"]

    def summarize(self, records: list[dict]) -> str:
        if len(records) == 1:
            r = records[0]
            return f"{r.get('cin')} · {r.get('status')} · inc. {r.get('date_of_incorporation')}"
        return f"{len(records)} company records"
