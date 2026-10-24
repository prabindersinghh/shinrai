"""GST taxpayer search. LIVE through a verification provider chosen by GST_PROVIDER; else SEED."""
from __future__ import annotations

import httpx

from ..config import GST_API_KEY, GST_PROVIDER
from .base import NotAvailable, SourceAdapter, pick
from .gstin import STATE_CODES
from .seed_store import store


def _normalize(g: str, data: dict) -> dict:
    status = str(pick(data, "gstin_status", "sts", "status", default="Unknown")).title()
    return {"gstin": g, "legal_name": pick(data, "legal_name", "lgnm", "legal_name_of_business"),
            "trade_name": pick(data, "trade_name", "tradeNam", "business_name"), "status": status,
            "registration_date": pick(data, "date_of_registration", "rgdt", "registration_date"),
            "cancellation_date": pick(data, "date_of_cancellation", "cxdt"),
            "state": STATE_CODES.get(g[:2]), "taxpayer_type": pick(data, "taxpayer_type", "dty"),
            "filing_frequency": pick(data, "filing_frequency"), "last_return_filed": None}


class Gst(SourceAdapter):
    name = "gst"
    source_name = "GST portal"
    url = "https://services.gst.gov.in/services/searchtp"

    async def live(self, query: dict) -> list[dict]:
        if GST_PROVIDER in ("", "none") or not GST_API_KEY:
            raise NotAvailable("GST_PROVIDER not configured")
        if "gstin" not in query:
            raise NotAvailable("live search needs a GSTIN")
        g = query["gstin"]
        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            if GST_PROVIDER == "surepass":
                resp = await client.post("https://kyc-api.surepass.io/api/v1/corporate/gstin",
                                         json={"id_number": g}, headers={"Authorization": f"Bearer {GST_API_KEY}"})
                resp.raise_for_status()
                return [_normalize(g, resp.json().get("data", {}))]
            if GST_PROVIDER == "cashfree":
                client_id, _, secret = GST_API_KEY.partition(":")
                resp = await client.post("https://api.cashfree.com/verification/gstin", json={"GSTIN": g},
                                         headers={"x-client-id": client_id, "x-client-secret": secret})
                resp.raise_for_status()
                return [_normalize(g, resp.json())]
        raise NotAvailable(f"unknown GST_PROVIDER {GST_PROVIDER}")

    def seed(self, query: dict) -> tuple[list[dict], str]:
        s = store()
        if "gstin" in query:
            c = s.find_by_gstin(query["gstin"])
            if not c:
                raise NotAvailable("GSTIN not in seed")
            return [r for r in s.gst_by_cin[c["cin"]] if r["gstin"] == query["gstin"]], c["_mode"]
        cins = query.get("cins") or [query["cin"]]
        known = [c for c in cins if c in s.companies]
        if not known:
            raise NotAvailable("company not in seed")
        rows = [{**r, "cin": c} for c in known for r in s.gst_by_cin.get(c, [])]
        return rows, s.mode_for(known[0])

    def summarize(self, records: list[dict]) -> str:
        if len(records) == 1:
            return f"{records[0]['gstin']} · {records[0]['status']}"
        return f"{len(records)} GST registrations"
