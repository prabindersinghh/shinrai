"""Geocoding: Google (GOOGLE_MAPS_KEY) → Nominatim (OSM, 1 req/s) → SEED coordinates."""
from __future__ import annotations

import asyncio
import time

import httpx

from .base import NotAvailable
from .ground_common import GOOGLE_MAPS_KEY, NOMINATIM_USER_AGENT, GroundAdapter, seed_site_for_address

_nominatim_lock = asyncio.Lock()
_last_call = 0.0

GOOGLE_PRECISION = {"ROOFTOP": "rooftop", "RANGE_INTERPOLATED": "street", "GEOMETRIC_CENTER": "street",
                    "APPROXIMATE": "locality"}


def _nominatim_precision(r: dict) -> str:
    kind = r.get("addresstype") or r.get("type") or ""
    if kind in ("house", "building", "industrial", "office", "company", "commercial", "retail", "landuse"):
        return "rooftop" if kind in ("house", "building") else "street"
    if kind in ("road", "street", "residential", "neighbourhood", "quarter"):
        return "street"
    if kind == "postcode":
        return "pin_code"
    return "locality"


class Geocode(GroundAdapter):
    name = "geocode"
    source_name = "Geocoder"
    url = "https://nominatim.openstreetmap.org/"
    timeout_s = 12.0

    async def live(self, query: dict) -> list[dict]:
        address = query["address"]
        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            if GOOGLE_MAPS_KEY:
                resp = await client.get("https://maps.googleapis.com/maps/api/geocode/json",
                                        params={"address": address, "region": "in", "key": GOOGLE_MAPS_KEY})
                resp.raise_for_status()
                rows = resp.json().get("results", [])
                if rows:
                    g = rows[0]["geometry"]
                    return [{"lat": g["location"]["lat"], "lon": g["location"]["lng"],
                             "precision": GOOGLE_PRECISION.get(g.get("location_type"), "locality"),
                             "provider": "google", "display_name": rows[0].get("formatted_address")}]
            global _last_call
            candidates = [address]
            parts = [p.strip() for p in address.split(",") if p.strip()]
            if len(parts) > 2:
                candidates += [", ".join(parts[-3:]), ", ".join(parts[-2:])]
            for i, q in enumerate(candidates):
                async with _nominatim_lock:
                    wait = 1.05 - (time.monotonic() - _last_call)
                    if wait > 0:
                        await asyncio.sleep(wait)
                    resp = await client.get("https://nominatim.openstreetmap.org/search",
                                            params={"q": q, "format": "json", "limit": 1, "countrycodes": "in",
                                                    "addressdetails": 1},
                                            headers={"User-Agent": NOMINATIM_USER_AGENT})
                    _last_call = time.monotonic()
                resp.raise_for_status()
                rows = resp.json()
                if rows:
                    r = rows[0]
                    precision = _nominatim_precision(r) if i == 0 else "locality"
                    addr = r.get("address", {})
                    return [{"lat": float(r["lat"]), "lon": float(r["lon"]), "precision": precision,
                             "provider": "nominatim", "display_name": r.get("display_name"),
                             "state": addr.get("state"), "city": addr.get("city") or addr.get("town") or addr.get("county")}]
        return []

    def seed(self, query: dict) -> tuple[list[dict], str]:
        site = seed_site_for_address(query["address"])
        if not site:
            raise NotAvailable("address not in seed")
        return [{"lat": site["lat"], "lon": site["lon"], "precision": site.get("precision", "street"),
                 "provider": site.get("provider", "seed"), "display_name": site["address"], "state": site.get("state"),
                 "city": site.get("city")}], site.get("mode", "seed")

    def summarize(self, records: list[dict]) -> str:
        if not records:
            return "no match"
        r = records[0]
        return f"{r['lat']:.4f}, {r['lon']:.4f} ({r['precision']}, {r['provider']})"
