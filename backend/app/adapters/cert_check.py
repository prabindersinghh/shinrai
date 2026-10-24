"""Certification check against IAF CertSearch. LIVE needs an IAF CertSearch API key (IAF_CERTSEARCH_KEY);
otherwise CACHED / SEED. Verdicts: valid + manufacturing scope → verified; expired or trading-only scope →
contradicted; not found → unverifiable (never contradicted on absence alone)."""
from __future__ import annotations

import json
from functools import lru_cache

import httpx

from ..config import SEED_DIR, env
from .base import HTTP_HEADERS, NotAvailable, SourceAdapter


@lru_cache(maxsize=1)
def _seed() -> dict:
    path = SEED_DIR / "certificates.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


class CertCheck(SourceAdapter):
    name = "cert_check"
    source_name = "IAF CertSearch"
    url = "https://www.iafcertsearch.org/"
    timeout_s = 12.0

    async def live(self, query: dict) -> list[dict]:
        key = env("IAF_CERTSEARCH_KEY")
        if not key:
            raise NotAvailable("IAF CertSearch API key not configured")
        async with httpx.AsyncClient(timeout=self.timeout_s, headers={**HTTP_HEADERS, "x-api-key": key}) as client:
            resp = await client.get("https://api.iafcertsearch.org/api/v1/certifications",
                                    params={"company_name": query["company"], "standard": query["standard"]})
            resp.raise_for_status()
            return resp.json().get("data", [])

    def seed(self, query: dict) -> tuple[list[dict], str]:
        rows = _seed().get(query["cin"])
        if rows is None:
            raise NotAvailable("no seed certification record")
        return [r for r in rows if query["standard"].replace(" ", "").lower() in r["standard"].replace(" ", "").lower()], "seed"

    def summarize(self, records: list[dict]) -> str:
        if not records:
            return "no matching certificate found"
        r = records[0]
        return f"{r['standard']} · {r['status']} · scope: {r['scope']}"


def verdict(records: list[dict]) -> tuple[str, str]:
    if not records:
        return "unverifiable", "not found in the register (absence is not proof)"
    r = records[0]
    if str(r.get("status", "")).lower() != "valid":
        return "contradicted", f"certificate status {r.get('status')}, expiry {r.get('expiry')}"
    if "manufactur" not in str(r.get("scope", "")).lower():
        return "contradicted", f"scope covers {r.get('scope')}, not manufacturing"
    return "verified", f"valid until {r.get('expiry')}; scope covers manufacturing"
