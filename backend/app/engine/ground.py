"""Ground truth step (Addendum Module 1): addresses → geocode → satellite checks → ground facts and claim verdicts.

Satellites show structures, not operations: everything here is evidence for rules, never a verdict on its own.
"""
from __future__ import annotations

import re
from statistics import mean

from ..adapters.ground_common import GROUND_BUFFER_M
from . import claims as claims_mod
from . import llm
from .graph import address_id

ROLE_LABEL = {"registered": ("registered office", "登記上の本店"), "gst_ppob": ("GST place of business", "GST主たる事業所"),
              "claimed_site": ("claimed site", "主張されている拠点")}
SQFT_TO_M2 = 0.092903
SITE_KINDS = ("factory", "plant", "facility", "manufacturing unit", "warehouse", "site")
YEARS = list(range(2016, 2027))
LIVE_YEARS = [2016, 2018, 2020, 2022, 2024, 2026]  # fewer scenes keeps a LIVE run demo-length


def _claimed(pipe) -> dict:
    area = founded = None
    production = False
    for c in pipe.claims_raw:
        if c["field"] == "site_area":
            digits = re.sub(r"[^\d.]", "", c["value"])
            area = {"m2": float(digits), "node": c["node"], "text": c["text"]} if digits else area
        elif c["field"] == "founded_year":
            digits = re.sub(r"\D", "", c["value"])
            if digits:
                n = int(digits)
                year = pipe.facts.today.year - n if c["unit"].startswith("years") or n < 200 else n
                if founded is None or year < founded["year"]:
                    founded = {"year": year, "node": c["node"], "text": c["text"]}
        if c["field"] in ("capacity", "employees") or (c["field"] == "location" and c["unit"] in SITE_KINDS):
            production = True
    return {"area": area, "founded": founded, "production": production}


def _slope(values: list[float]) -> float:
    n = len(values)
    if n < 2:
        return 0.0
    xm, ym = (n - 1) / 2, mean(values)
    den = sum((i - xm) ** 2 for i in range(n)) or 1
    return round(sum((i - xm) * (v - ym) for i, v in enumerate(values)) / den, 4)


async def _addresses(pipe) -> list[dict]:
    co, out = pipe.facts.company, []
    if co.get("registered_address"):
        out.append({"role": "registered", "address": co["registered_address"]})
    gst_addr = next((g["address"] for g in pipe.facts.gst if g.get("address")), None)
    if gst_addr:
        out.append({"role": "gst_ppob", "address": gst_addr})
    site_claim = next((c for c in pipe.claims_raw if c["field"] == "location" and c["unit"] in SITE_KINDS), None)
    if site_claim:
        out.append({"role": "claimed_site", "address": site_claim["value"], "claim_node": site_claim["node"]})
    return out


async def run(pipe) -> str:
    g = pipe.facts.ground
    pins = g.get("pins", {})
    cid = pipe.facts.company_node
    addresses = []
    for a in await _addresses(pipe):
        role, label = a["role"], ROLE_LABEL[a["role"]][0]
        aid = address_id(a["address"])
        if role in pins:
            p = pins[role]
            loc = {"lat": p["lat"], "lon": p["lon"], "precision": "rooftop", "provider": "user_confirmed",
                   "state": p.get("state")}
            ev = pipe.evidence("geocode", "Pin confirmed by user", {"address": a["address"]}, "", "user", loc,
                               "pin confirmed in the Ground Truth panel", f"geo:{role}")
            await pipe.note("ground", f"Pin for {label} confirmed by user → {loc['lat']:.5f}, {loc['lon']:.5f} [{ev}]",
                            icon="🛰️")
        else:
            res, ev = await pipe.query("ground", "geocode", {"address": a["address"]}, f"geo:{role}",
                                       f"Geocode {label}", icon="🛰️")
            if not res.records:
                await pipe.note("ground", f"Could not geocode the {label}.", "warn", icon="🛰️")
                continue
            loc = res.records[0]
        state = loc.get("state") or claims_mod._state_of(a["address"])
        approx = loc["precision"] in ("locality", "pin_code")
        await pipe.node(aid, "address", a["address"].split(",")[0][:48], aid, address=a["address"], role=role,
                        lat=loc["lat"], lon=loc["lon"], precision=loc["precision"], provider=loc["provider"],
                        state=state, approximate=approx, satellite=True, evidence=[ev])
        roles = pipe.graph.nodes[aid]["attrs"].setdefault("roles", [])
        if role not in roles:
            roles.append(role)
        await pipe.edge(cid, aid, {"registered": "registered_at", "gst_ppob": "gst_place_of_business",
                                   "claimed_site": "claimed_site"}[role])
        addresses.append({**a, "node": aid, "lat": loc["lat"], "lon": loc["lon"], "precision": loc["precision"],
                          "provider": loc["provider"], "state": state, "evidence_id": ev})
    g["addresses"] = addresses
    if not addresses:
        g["status"] = "not_geocoded"
        return "no address could be geocoded"

    site = next((a for a in addresses if a["role"] == "claimed_site"), None) or next(
        (a for a in addresses if a["role"] == "gst_ppob"), addresses[0])
    lat, lon = site["lat"], site["lon"]
    key = f"{lat:.5f}_{lon:.5f}"
    g["site"] = {k: site[k] for k in ("role", "address", "node", "lat", "lon", "precision", "provider", "state")}
    g["buffer_m"] = GROUND_BUFFER_M
    claimed = _claimed(pipe)
    g["claimed"] = {"area_m2": claimed["area"]["m2"] if claimed["area"] else None,
                    "founded_year": claimed["founded"]["year"] if claimed["founded"] else None,
                    "production": claimed["production"]}

    img, ev_img = await pipe.query("ground", "imagery_current", {"lat": lat, "lon": lon, "site": key, "half_m": 220},
                                   "ground_img", "Current satellite image", icon="🛰️")
    g["current"] = img.records[0] if img.records else None

    bld, ev_bld = await pipe.query("ground", "buildings_temporal", {"lat": lat, "lon": lon, "radius_m": GROUND_BUFFER_M},
                                   "ground_buildings", "Open Buildings 2016→2023", icon="🛰️")
    series = bld.records if bld.checked else []
    built = [r for r in series if r["built_area_m2"] >= 100]
    g["buildings"] = {"status": bld.status, "mode": bld.mode_used, "series": series, "evidence_id": ev_bld,
                      "first_year_built": built[0]["year"] if built else None,
                      "latest_area_m2": series[-1]["built_area_m2"] if series else None,
                      "latest_height_m": series[-1].get("mean_height_m") if series else None,
                      "note": None if bld.checked else bld.error[:160]}
    if series:
        await pipe.note("ground", f"Open Buildings {series[0]['year']}→{series[-1]['year']}: "
                                  f"{'first seen ' + str(built[0]['year']) if built else 'no building'} · "
                                  f"{series[-1]['built_area_m2']:,} m² [{ev_bld}]", icon="🛰️")
    else:
        await pipe.note("ground", "Open Buildings temporal: pending (Earth Engine not reachable), using footprints.",
                        "warn", icon="🛰️")
    osm, ev_osm = await pipe.query("ground", "osm_buildings", {"lat": lat, "lon": lon, "radius_m": GROUND_BUFFER_M},
                                   "ground_osm", "Building footprints (OSM)", icon="🛰️")
    nearest = osm.records[0] if osm.records else None
    g["osm"] = {"status": osm.status, "mode": osm.mode_used, "evidence_id": ev_osm, "count": len(osm.records),
                "total_area_m2": sum(r["area_m2"] for r in osm.records),
                "footprints": [{k: r[k] for k in ("osm_id", "area_m2", "footprint", "distance_m")} for r in osm.records[:40]],
                "nearest": nearest and {k: nearest[k] for k in ("osm_id", "area_m2", "footprint", "distance_m")}}

    years = YEARS if pipe.adapter_mode in ("seed", "cached") else LIVE_YEARS
    tl, ev_tl = await pipe.query("ground", "imagery_timelapse", {"lat": lat, "lon": lon, "site": key, "years": years,
                                                                 "half_m": 500},
                                 "ground_timelapse", "Sentinel-2 yearly scenes", icon="🛰️")
    g["frames"] = tl.records
    g["frames_evidence_id"] = ev_tl

    nl, ev_nl = await pipe.query("ground", "nightlights", {"lat": lat, "lon": lon}, "ground_lights",
                                 "VIIRS night lights (36 months)", icon="🛰️")
    if nl.records:
        last = nl.records[-12:]
        ring = mean(r["ring"] for r in last) or 1e-6
        ratio = round(mean(r["site"] for r in last) / ring, 2)
        g["nightlights"] = {"status": "ok", "series": nl.records, "activity_ratio": ratio,
                            "slope": _slope([r["site"] for r in nl.records]), "evidence_id": ev_nl, "mode": nl.mode_used}
        await pipe.note("ground", f"VIIRS: activity ratio {ratio} (site ÷ 1–2 km ring) [{ev_nl}]", icon="🛰️")
    else:
        g["nightlights"] = {"status": nl.status, "series": [], "activity_ratio": None, "evidence_id": ev_nl,
                            "note": nl.error[:160]}

    if g["current"] and llm.available():
        g["caption"] = await llm.caption_image(g["current"]["path"])

    g["claim_verdicts"] = _claim_verdicts(g, claimed, [e for e in (ev_bld if series else ev_osm, ev_img) if e])
    g["status"] = "ok"
    await pipe.emit("ground.ready", ground=g)
    measured = g["buildings"]["latest_area_m2"] if series else g["osm"]["total_area_m2"]
    return f"{len(addresses)} addresses · {measured or 0:,} m² built · {len(tl.records)} scenes"


def _claim_verdicts(g: dict, claimed: dict, evidence: list[str]) -> list[dict]:
    out = []
    series = g["buildings"]["series"]
    measured = g["buildings"]["latest_area_m2"] if series else (g["osm"]["total_area_m2"] if g["osm"]["count"] else None)
    source = "Open Buildings" if series else "OpenStreetMap footprints"
    if claimed["area"] and measured is not None:
        c = claimed["area"]["m2"]
        if c > 3 * max(measured, 1):
            out.append({"claim_node": claimed["area"]["node"], "verdict": "contradicted", "evidence_ids": evidence,
                        "explanation_en": f"Claimed {c:,.0f} m² ({c / SQFT_TO_M2:,.0f} sq ft); {source} measures "
                                          f"{measured:,} m² built within {g['buffer_m']} m of the site.",
                        "explanation_ja": f"主張は{c:,.0f}㎡（{c / SQFT_TO_M2:,.0f}平方フィート）ですが、{source}による"
                                          f"拠点周辺{g['buffer_m']}m内の建築面積は{measured:,}㎡です。"})
        elif measured >= 0.5 * c:
            out.append({"claim_node": claimed["area"]["node"], "verdict": "verified", "evidence_ids": evidence,
                        "explanation_en": f"{source} measures {measured:,} m² built at the site.",
                        "explanation_ja": f"{source}で拠点の建築面積{measured:,}㎡を確認しました。"})
    first = g["buildings"]["first_year_built"]
    if claimed["founded"] and series:
        year = claimed["founded"]["year"]
        empty_2016 = series[0]["built_area_m2"] < 100
        if first and first > year and (year >= 2016 or empty_2016):
            out.append({"claim_node": claimed["founded"]["node"], "verdict": "contradicted", "evidence_ids": evidence,
                        "explanation_en": f"No building stood at the claimed site until {first} (Open Buildings), "
                                          f"but the claim implies operations since {year}.",
                        "explanation_ja": f"Open Buildingsでは主張拠点に{first}年まで建物が存在しませんが、"
                                          f"主張は{year}年からの操業を示しています。"})
    return out
