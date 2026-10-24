"""Building presence and height by year.

`BuildingsTemporal`: Google Open Buildings 2.5D Temporal via Earth Engine (needs EE_PROJECT + credentials).
`OsmBuildings`: current footprints from OpenStreetMap (Overpass), used when Earth Engine is not configured.
"""
from __future__ import annotations

import asyncio

import httpx

from .base import NotAvailable
from .ground_common import (EE_PROJECT, EE_SERVICE_ACCOUNT_JSON, NOMINATIM_USER_AGENT, GroundAdapter,
                            distance_m, polygon_area_m2, seed_site_near)

DATASET = "GOOGLE/Research/open-buildings-temporal/v1"
YEARS = list(range(2016, 2024))
OVERPASS = ["https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter"]


def _ee_series(lat: float, lon: float, radius_m: int) -> list[dict]:
    import ee  # optional dependency: earthengine-api

    if EE_SERVICE_ACCOUNT_JSON:
        import json

        info = json.load(open(EE_SERVICE_ACCOUNT_JSON, encoding="utf-8"))
        ee.Initialize(ee.ServiceAccountCredentials(info["client_email"], EE_SERVICE_ACCOUNT_JSON), project=EE_PROJECT)
    else:
        ee.Initialize(project=EE_PROJECT)
    region = ee.Geometry.Point([lon, lat]).buffer(radius_m)
    col = ee.ImageCollection(DATASET).filterBounds(region)
    out = []
    for year in YEARS:
        img = col.filter(ee.Filter.calendarRange(year, year, "year")).mosaic()
        presence = img.select("building_presence").gte(0.5)
        area = presence.multiply(ee.Image.pixelArea()).reduceRegion(ee.Reducer.sum(), region, 4, maxPixels=1e8)
        height = img.select("building_height").updateMask(presence).reduceRegion(ee.Reducer.mean(), region, 4,
                                                                                  maxPixels=1e8)
        vals = ee.Dictionary({"area": area.get("building_presence"), "height": height.get("building_height")}).getInfo()
        out.append({"year": year, "built_area_m2": round(vals.get("area") or 0), "mean_height_m":
                    round(vals.get("height") or 0, 1)})
    return out


class BuildingsTemporal(GroundAdapter):
    name = "buildings_temporal"
    source_name = "Open Buildings 2.5D Temporal"
    url = "https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_Research_open-buildings-temporal_v1"
    timeout_s = 12.0

    async def live(self, query: dict) -> list[dict]:
        if not EE_PROJECT:
            raise NotAvailable("Earth Engine not configured (EE_PROJECT)")
        try:
            import ee  # noqa: F401
        except ImportError as exc:
            raise NotAvailable("earthengine-api not installed") from exc
        return await asyncio.to_thread(_ee_series, query["lat"], query["lon"], query["radius_m"])

    def seed(self, query: dict) -> tuple[list[dict], str]:
        site = seed_site_near(query["lat"], query["lon"])
        if not site or "buildings" not in site:
            raise NotAvailable("no seed building series for this site")
        return site["buildings"]["series"], site.get("mode", "seed")

    def summarize(self, records: list[dict]) -> str:
        built = [r for r in records if r["built_area_m2"] >= 100]
        if not built:
            return f"{records[0]['year']}→{records[-1]['year']}: no building" if records else "no data"
        return f"first seen {built[0]['year']} · {records[-1]['built_area_m2']} m²"


class OsmBuildings(GroundAdapter):
    name = "osm_buildings"
    source_name = "OpenStreetMap buildings"
    url = "https://www.openstreetmap.org/"
    timeout_s = 30.0

    async def live(self, query: dict) -> list[dict]:
        lat, lon, r = query["lat"], query["lon"], query["radius_m"]
        q = f'[out:json][timeout:50];way["building"](around:{r},{lat},{lon});out geom tags;'
        last_exc: Exception | None = None
        async with httpx.AsyncClient(timeout=self.timeout_s, headers={"User-Agent": NOMINATIM_USER_AGENT}) as client:
            for endpoint in OVERPASS:
                try:
                    resp = await client.post(endpoint, data={"data": q})
                    resp.raise_for_status()
                    ways = resp.json().get("elements", [])
                    break
                except (httpx.HTTPError, ValueError) as exc:
                    last_exc = exc
            else:
                raise last_exc or RuntimeError("overpass unavailable")
        rows = []
        for w in ways:
            geom = [[p["lat"], p["lon"]] for p in w.get("geometry", [])]
            if len(geom) < 3:
                continue
            c = (sum(p[0] for p in geom) / len(geom), sum(p[1] for p in geom) / len(geom))
            rows.append({"osm_id": w["id"], "area_m2": round(polygon_area_m2(geom)), "levels": w.get("tags", {}).get(
                "building:levels"), "kind": w.get("tags", {}).get("building"), "distance_m": round(distance_m((lat, lon), c)),
                "footprint": geom})
        return sorted(rows, key=lambda x: x["distance_m"])

    def seed(self, query: dict) -> tuple[list[dict], str]:
        site = seed_site_near(query["lat"], query["lon"])
        if not site or "osm" not in site:
            raise NotAvailable("no seed footprints for this site")
        return site["osm"], site.get("mode", "seed")

    def summarize(self, records: list[dict]) -> str:
        return f"{len(records)} footprints · {sum(r['area_m2'] for r in records):,} m² built today"
