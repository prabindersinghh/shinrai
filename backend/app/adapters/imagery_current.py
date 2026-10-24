"""Current imagery at the site: Google Static Maps satellite (key) → Esri World Imagery export → SEED file."""
from __future__ import annotations

import httpx

from ..config import DATA_DIR
from .base import HTTP_HEADERS, NotAvailable
from .ground_common import GOOGLE_MAPS_KEY, GroundAdapter, bbox, site_dir, seed_site_near

ESRI_EXPORT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"


class ImageryCurrent(GroundAdapter):
    name = "imagery_current"
    source_name = "Satellite imagery (current)"
    url = "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9"
    timeout_s = 20.0

    async def live(self, query: dict) -> list[dict]:
        lat, lon, half = query["lat"], query["lon"], query.get("half_m", 220)
        rel = f"{site_dir(query['site'])}/current.png"
        async with httpx.AsyncClient(timeout=self.timeout_s, headers=HTTP_HEADERS) as client:
            if GOOGLE_MAPS_KEY:
                resp = await client.get("https://maps.googleapis.com/maps/api/staticmap", params={
                    "center": f"{lat},{lon}", "zoom": 18, "size": "640x640", "maptype": "satellite", "key": GOOGLE_MAPS_KEY})
                provider, attribution = "google_static", "Imagery © Google"
            else:
                b = bbox(lat, lon, half)
                resp = await client.get(ESRI_EXPORT, params={"bbox": ",".join(map(str, b)), "bboxSR": 4326,
                                                             "imageSR": 3857, "size": "640,640", "format": "png", "f": "image"})
                provider = "esri_world_imagery"
                attribution = "Esri, Maxar, Earthstar Geographics, and the GIS User Community"
            resp.raise_for_status()
            if not resp.headers.get("content-type", "").startswith("image"):
                raise ValueError("imagery service returned no image")
        (DATA_DIR / rel).write_bytes(resp.content)
        return [{"path": rel, "provider": provider, "attribution": attribution, "bbox": bbox(lat, lon, half),
                 "half_m": half}]

    def seed(self, query: dict) -> tuple[list[dict], str]:
        site = seed_site_near(query["lat"], query["lon"])
        if not site or "current" not in site.get("images", {}):
            raise NotAvailable("no seed imagery for this site")
        img = site["images"]["current"]
        return [{**img, "bbox": bbox(site["lat"], site["lon"], img.get("half_m", 220))}], site.get("mode", "seed")

    def summarize(self, records: list[dict]) -> str:
        return f"image saved ({records[0]['provider']})" if records else "no image"
