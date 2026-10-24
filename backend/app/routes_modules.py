"""Addendum modules: Money (SIMULATED AA consent), Genba Audit, 稟議書, verified card, PDF export."""
from __future__ import annotations

import hashlib
import io
import json
import math
import secrets
import shutil
import uuid
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

import yaml
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import select

from . import config
from .adapters.ground_common import distance_m
from .engine import report as report_mod
from .engine.orchestrator import reassess
from .models import (Audit, AuditItem, AuditPhoto, Consent, Evidence, Flag, Investigation, Partner, Sme, session,
                     utcnow)

router = APIRouter()
AUDIT_DIR = config.DATA_DIR / "audits"
AUDIT_DIR.mkdir(parents=True, exist_ok=True)
GPS_TOLERANCE_M = 300

# ----- Money: SIMULATED Account Aggregator consent ---------------------------------------------------------------


def consent_summary(inv_id: int) -> dict | None:
    with session() as s:
        c = s.exec(select(Consent).where(Consent.inv_id == inv_id).order_by(Consent.id.desc())).first()
        return c and c.model_dump()


@router.post("/api/investigations/{inv_id}/consent")
def request_consent(inv_id: int) -> dict:
    with session() as s:
        inv = s.get(Investigation, inv_id)
        if not inv or inv.status != "done":
            raise HTTPException(409, "Finish the investigation before requesting financial verification")
        sme = s.get(Sme, s.get(Partner, inv.partner_id).sme_id)
        c = Consent(inv_id=inv_id, token=secrets.token_urlsafe(10),
                    purpose=f"Partner verification for {sme.name} (trade relationship due diligence)")
        s.add(c)
        s.commit()
        s.refresh(c)
        return {**c.model_dump(), "link": f"/consent/{c.token}"}


@router.get("/api/consent/{token}")
def get_consent(token: str) -> dict:
    with session() as s:
        c = s.exec(select(Consent).where(Consent.token == token)).first()
        if not c:
            raise HTTPException(404, "Consent request not found")
        inv = s.get(Investigation, c.inv_id)
        sme = s.get(Sme, s.get(Partner, inv.partner_id).sme_id)
        return {**c.model_dump(), "company": inv.company, "requester": sme.name, "requester_ja": sme.name_ja,
                "fiu": "Shinrai (via partner NBFC, sandbox)", "aa": "Sandbox AA (SIMULATED)",
                "data_life": "Deleted 30 days after the report is issued", "frequency": "One-time fetch",
                "simulated": True}


class Decision(BaseModel):
    approve: bool


async def _apply_money(pipe) -> None:
    await pipe.begin("scoring")
    cin = pipe.facts.company["cin"]
    res, ev = await pipe.query("scoring", "aa_gst", {"cin": cin}, "money", "GSTR-3B via Account Aggregator (consented)",
                               icon="💴")
    months = res.records
    declared = sum(r["taxable_turnover"] for r in months[-12:])
    turnover_claim = next((c for c in pipe.claims_raw if c["field"] == "turnover"), None)
    claimed = float(turnover_claim["value"]) if turnover_claim and turnover_claim["value"].isdigit() else None
    pipe.facts.money = {"status": "received" if months else "empty", "months": months, "declared_12m": declared,
                        "claimed_turnover": claimed, "evidence_id": ev, "simulated": True,
                        "summary": f"GSTR-3B (simulated, consented): ₹{declared / 1e7:,.2f} crore over the last 12 filed months"}
    pipe.coverage["aa_gst"] = res.status
    await pipe.note("scoring", f"💴 GST returns received (consented, {len(months)} months) · last 12 months "
                               f"₹{declared / 1e7:,.2f} crore [{ev}] · SIMULATED", icon="💴")
    await pipe.emit("money.received", money=pipe.facts.money)
    if claimed and turnover_claim:
        for c in pipe.facts.claims:
            if c["node"] == turnover_claim["node"] and claimed > 2 * declared:
                c["verdict"] = "contradicted"
                c["evidence_ids"] = list(dict.fromkeys(c["evidence_ids"] + [ev]))
                c["explanation_en"] += (f" Consented GSTR-3B returns declare ₹{declared / 1e7:,.2f} crore over the last 12 "
                                        f"filed months against ₹{claimed / 1e7:,.1f} crore claimed (SIMULATED data).")
                c["explanation_ja"] += (f"同意に基づくGSTR-3B申告では直近12か月の売上は₹{declared / 1e7:,.2f}crore"
                                        f"で、主張の₹{claimed / 1e7:,.1f}croreを大きく下回ります（シミュレーション）。")
                await pipe.emit("claim.checked", claim=c)


@router.post("/api/consent/{token}/decision")
async def decide_consent(token: str, body: Decision) -> dict:
    with session() as s:
        c = s.exec(select(Consent).where(Consent.token == token)).first()
        if not c:
            raise HTTPException(404, "Consent request not found")
        if c.status != "requested":
            return {"status": c.status}
        c.status = "approved" if body.approve else "denied"
        c.decided_at = utcnow()
        s.add(c)
        s.commit()
        inv_id = c.inv_id
    if not body.approve:
        return {"status": "denied"}
    result = await reassess(inv_id, _apply_money, "financial data received (consented)")
    return {"status": "approved", **result}


@router.get("/api/verified/{inv_id}")
def verified_card(inv_id: int) -> dict:
    with session() as s:
        inv = s.get(Investigation, inv_id)
        if not inv:
            raise HTTPException(404, "Not found")
        flags = list(s.exec(select(Flag).where(Flag.inv_id == inv_id)))
        consent = s.exec(select(Consent).where(Consent.inv_id == inv_id, Consent.status == "approved")).first()
        audit = s.exec(select(Audit).where(Audit.inv_id == inv_id, Audit.status == "completed")).first()
    serious = [f for f in flags if f.severity in ("high", "critical")]
    eligible = bool(consent) and not serious
    reasons = []
    if not consent:
        reasons.append("Financial verification consent not given")
    if serious:
        reasons.append(f"{len(serious)} high or critical flag(s)")
    return {"eligible": eligible, "reasons": reasons, "company": inv.company, "score": inv.overall_score,
            "band": inv.band, "checked_at": inv.finished_at, "audited": bool(audit), "is_demo": inv.is_demo,
            "consent_at": consent and consent.decided_at, "inv_id": inv_id}


# ----- Genba Audit -------------------------------------------------------------------------------------------------
RULE_TASKS = {
    "GROUND_AREA_MISMATCH": ("Measure the production floor and photograph the full building exterior from all four sides.",
                             "生産フロアを実測し、建物の外観を四方向すべてから撮影する。"),
    "GROUND_NO_BUILDING": ("Confirm whether any building stands at the pin; photograph the plot and its boundary.",
                           "ピン位置に建物があるか確認し、敷地と境界を撮影する。"),
    "GROUND_AFTER_CLAIMED_YEAR": ("Photograph evidence of the building's age (occupancy certificate, electricity connection date).",
                                  "建物の築年を示す証拠（使用許可証、電力契約日）を撮影する。"),
    "GROUND_LOW_ACTIVITY": ("Observe a working shift: photograph running machines and staff at work.",
                            "稼働中のシフトを確認し、稼働設備と作業中の従業員を撮影する。"),
    "ADDRESS_MISMATCH": ("Visit the GST place of business and photograph its signage and entrance.",
                         "GST上の事業所を訪問し、看板と入口を撮影する。"),
    "NET_SHARED_ADDRESS_CLUSTER": ("At the registered address, photograph every company nameplate on the premises.",
                                   "登記住所にある全ての社名表示を撮影する。"),
    "CMP_GST_CANCELLED": ("Photograph the GST registration certificate displayed on site.", "現地に掲示されたGST登録証を撮影する。"),
    "CMP_FILING_OVERDUE": ("Collect copies of the latest audited accounts and the AOC-4 filing receipt.",
                           "最新の監査済み決算書とAOC-4提出控の写しを入手する。"),
}
CLAIM_TASKS = {
    "certification": ("Photograph the original certificate and confirm its scope covers manufacturing.",
                      "認証書の原本を撮影し、適用範囲に製造が含まれることを確認する。"),
    "employees": ("Photograph the attendance register or shift roster for the current month.",
                  "当月の出勤簿またはシフト表を撮影する。"),
    "capacity": ("Count the CNC machines on the floor and photograph each production line.",
                 "フロアのCNC設備を数え、各生産ラインを撮影する。"),
    "clients": ("Photograph recent purchase orders or delivery challans from named customers.",
                "取引先名の入った最近の注文書または納品書を撮影する。"),
    "turnover": ("Photograph the sales register and three recent GST invoices.", "売上台帳と最近のGST請求書3枚を撮影する。"),
}


@lru_cache(maxsize=1)
def pricing() -> dict:
    return yaml.safe_load((config.BASE_DIR / "config" / "audit_pricing.yaml").read_text(encoding="utf-8"))["types"]


@lru_cache(maxsize=1)
def auditors() -> list[dict]:
    return json.loads((config.SEED_DIR / "auditors.json").read_text(encoding="utf-8"))


def _site(inv: Investigation) -> dict | None:
    return ((inv.state or {}).get("facts", {}).get("ground") or {}).get("site")


def checklist(inv: Investigation) -> list[dict]:
    with session() as s:
        flags = list(s.exec(select(Flag).where(Flag.inv_id == inv.id)))
    claims = (inv.state or {}).get("facts", {}).get("claims", [])
    items, seen = [], set()
    for f in flags:
        if f.rule_id in RULE_TASKS and f.rule_id not in seen:
            seen.add(f.rule_id)
            claim_node = next((c["node"] for c in claims if c["field"] == "site_area"), None) \
                if f.rule_id == "GROUND_AREA_MISMATCH" else None
            en, ja = RULE_TASKS[f.rule_id]
            items.append({"source": f.rule_id, "claim_node": claim_node, "text_en": en, "text_ja": ja})
    for c in claims:
        key = f"claim:{c['field']}"
        if c["verdict"] != "verified" and c["field"] in CLAIM_TASKS and key not in seen:
            seen.add(key)
            en, ja = CLAIM_TASKS[c["field"]]
            items.append({"source": key, "claim_node": c["node"], "text_en": en, "text_ja": ja, "claim": c["text"]})
    return items


def suggest_auditor(site: dict | None, audit_type: str) -> dict:
    pool = [a for a in auditors() if audit_type in a["specialties"]] or auditors()
    if not site:
        return pool[0]
    best = min(pool, key=lambda a: distance_m((site["lat"], site["lon"]), (a["lat"], a["lon"])))
    return {**best, "distance_km": round(distance_m((site["lat"], site["lon"]), (best["lat"], best["lon"])) / 1000, 1)}


@router.get("/api/investigations/{inv_id}/audit-plan")
def audit_plan(inv_id: int) -> dict:
    with session() as s:
        inv = s.get(Investigation, inv_id)
        if not inv:
            raise HTTPException(404, "Investigation not found")
    site = _site(inv)
    return {"types": pricing(), "checklist": checklist(inv), "site": site,
            "auditors": {t: suggest_auditor(site, t) for t in pricing()}}


class AuditIn(BaseModel):
    audit_type: str = "production_capability"
    start: date
    end: date
    custom_items: list[dict] = []


def audit_summary(inv_id: int) -> dict | None:
    with session() as s:
        a = s.exec(select(Audit).where(Audit.inv_id == inv_id).order_by(Audit.id.desc())).first()
        if not a:
            return None
        return _audit_dict(s, a)


def _audit_dict(s, a: Audit) -> dict:
    items = list(s.exec(select(AuditItem).where(AuditItem.audit_id == a.id).order_by(AuditItem.id)))
    photos = list(s.exec(select(AuditPhoto).where(AuditPhoto.audit_id == a.id).order_by(AuditPhoto.id)))
    return {**a.model_dump(), "pricing": pricing().get(a.audit_type),
            "items": [{**it.model_dump(), "photos": [p.model_dump() for p in photos if p.item_id == it.id]} for it in items]}


@router.post("/api/investigations/{inv_id}/audits")
def create_audit(inv_id: int, body: AuditIn) -> dict:
    with session() as s:
        inv = s.get(Investigation, inv_id)
        if not inv or inv.status != "done":
            raise HTTPException(409, "Finish the investigation before ordering an audit")
        if body.audit_type not in pricing():
            raise HTTPException(400, "Unknown audit type")
        site = _site(inv)
        a = Audit(inv_id=inv_id, audit_type=body.audit_type, auditor=suggest_auditor(site, body.audit_type),
                  window_start=datetime.combine(body.start, datetime.min.time(), timezone.utc),
                  window_end=datetime.combine(body.end, datetime.max.time(), timezone.utc),
                  price_jpy=pricing()[body.audit_type]["price_jpy"], pin=site or {})
        s.add(a)
        s.commit()
        s.refresh(a)
        for it in checklist(inv) + [{"source": "custom", "claim_node": None, "text_en": c.get("en", ""),
                                     "text_ja": c.get("ja") or c.get("en", "")} for c in body.custom_items if c.get("en")]:
            s.add(AuditItem(audit_id=a.id, source=it["source"], claim_node=it.get("claim_node"),
                            text_en=it["text_en"], text_ja=it["text_ja"]))
        s.commit()
        return _audit_dict(s, a)


@router.get("/api/audits/{audit_id}")
def get_audit(audit_id: int) -> dict:
    with session() as s:
        a = s.get(Audit, audit_id)
        if not a:
            raise HTTPException(404, "Audit not found")
        inv = s.get(Investigation, a.inv_id)
        return {**_audit_dict(s, a), "company": inv.company, "is_demo": inv.is_demo}


def _gps(img) -> tuple[float | None, float | None, datetime | None]:
    exif = img.getexif()
    taken = exif.get(306)
    sub = exif.get_ifd(0x8769)
    taken = sub.get(36867) or taken
    when = None
    if taken:
        try:
            when = datetime.strptime(str(taken), "%Y:%m:%d %H:%M:%S").replace(tzinfo=timezone(timedelta(hours=5, minutes=30)))
        except ValueError:
            when = None
    gps = exif.get_ifd(0x8825)
    if not gps or 2 not in gps or 4 not in gps:
        return None, None, when

    def deg(v, ref):
        d = float(v[0]) + float(v[1]) / 60 + float(v[2]) / 3600
        return -d if ref in ("S", "W") else d

    return deg(gps[2], gps.get(1, "N")), deg(gps[4], gps.get(3, "E")), when


def store_photo(audit: Audit, item: AuditItem, data: bytes, filename: str) -> AuditPhoto:
    from PIL import Image

    img = Image.open(io.BytesIO(data))
    if img.format not in ("JPEG", "PNG"):
        raise OSError("unsupported image format")
    lat, lon, when = _gps(img)
    pin = audit.pin or {}
    dist = distance_m((lat, lon), (pin["lat"], pin["lon"])) if lat is not None and pin.get("lat") is not None else None
    loc_ok = dist is not None and dist <= GPS_TOLERANCE_M
    time_ok = bool(when and audit.window_start and audit.window_start <= when.astimezone(timezone.utc) <= audit.window_end)
    sha = hashlib.sha256(data).hexdigest()  # hash of the original upload, as received
    # Never trust the client's filename: store a re-encoded copy with an extension from the detected format.
    ext = ".jpg" if img.format == "JPEG" else ".png"
    rel = f"audits/{audit.id}/{sha[:16]}{ext}"
    (config.DATA_DIR / rel).parent.mkdir(parents=True, exist_ok=True)
    clean = io.BytesIO()
    img.convert("RGB").save(clean, "JPEG" if ext == ".jpg" else "PNG", exif=img.getexif())
    (config.DATA_DIR / rel).write_bytes(clean.getvalue())
    with session() as s:
        n = len(list(s.exec(select(Evidence.id).where(Evidence.inv_id == audit.inv_id)))) + 1
        ev_id = f"ev_{n}"
        while s.exec(select(Evidence).where(Evidence.inv_id == audit.inv_id, Evidence.ev_id == ev_id)).first():
            n += 1
            ev_id = f"ev_{n}"
        summary = (f"photo {sha[:10]} · GPS {'✓' if loc_ok else '✗'} "
                   f"({'%.0f m' % dist if dist is not None else 'no GPS'}) · time {'✓' if time_ok else '✗'}")
        s.add(Evidence(inv_id=audit.inv_id, ev_id=ev_id, adapter="genba_audit", source_name="Genba Audit field photo",
                       query={"audit": audit.id, "item": item.id}, url=f"/api/data/{rel}", mode="field",
                       payload={"path": rel, "lat": lat, "lon": lon, "taken_at": when and when.isoformat(),
                                "distance_m": dist, "location_verified": loc_ok, "time_verified": time_ok,
                                "auditor": audit.auditor.get("name"), "item": item.text_en},
                       summary=summary, sha256=sha))
        photo = AuditPhoto(audit_id=audit.id, item_id=item.id, path=rel, sha256=sha, lat=lat, lon=lon, taken_at=when,
                           distance_m=dist, location_verified=loc_ok, time_verified=time_ok, ev_id=ev_id)
        s.add(photo)
        a = s.get(Audit, audit.id)
        if a.status == "scheduled":
            a.status = "in_progress"
            s.add(a)
        s.commit()
        s.refresh(photo)
        return photo


@router.post("/api/audits/{audit_id}/items/{item_id}/photo")
async def upload_photo(audit_id: int, item_id: int, photo: UploadFile = File(...)) -> dict:
    with session() as s:
        a, it = s.get(Audit, audit_id), s.get(AuditItem, item_id)
        if not a or not it or it.audit_id != audit_id:
            raise HTTPException(404, "Audit item not found")
        if a.status == "completed":
            raise HTTPException(409, "This audit is completed; its evidence can no longer change")
    data = await photo.read()
    try:
        p = store_photo(a, it, data, photo.filename or "photo.jpg")
    except OSError as exc:
        raise HTTPException(400, "Upload a JPEG or PNG photo") from exc
    return p.model_dump()


class ItemResult(BaseModel):
    status: str
    note: str = ""


@router.post("/api/audits/{audit_id}/items/{item_id}/result")
def set_item_result(audit_id: int, item_id: int, body: ItemResult) -> dict:
    if body.status not in ("pass", "fail", "pending"):
        raise HTTPException(400, "Status must be pass, fail or pending")
    with session() as s:
        it = s.get(AuditItem, item_id)
        if not it or it.audit_id != audit_id:
            raise HTTPException(404, "Audit item not found")
        if s.get(Audit, audit_id).status == "completed":
            raise HTTPException(409, "This audit is completed; its results can no longer change")
        photos = list(s.exec(select(AuditPhoto).where(AuditPhoto.item_id == item_id)))
        verified = [p for p in photos if p.location_verified and p.time_verified]
        # A result counts only with at least one GPS- and time-verified photo.
        it.status = body.status if body.status == "pending" or verified else "unverified"
        it.note = body.note or ("" if verified else "no photo passed the GPS / time check")
        s.add(it)
        s.commit()
        return it.model_dump()


async def complete_audit(audit_id: int) -> dict:
    with session() as s:
        a = s.get(Audit, audit_id)
        if not a:
            raise HTTPException(404, "Audit not found")
        if a.status == "completed":
            raise HTTPException(409, "This audit is already completed")
        a.status = "completed"
        a.completed_at = utcnow()
        s.add(a)
        s.commit()
        payload = _audit_dict(s, a)
        inv_id = a.inv_id
    items = [{"id": it["id"], "source": it["source"], "claim_node": it["claim_node"], "status": it["status"],
              "note": it["note"], "text_en": it["text_en"], "text_ja": it["text_ja"],
              "evidence_ids": [p["ev_id"] for p in it["photos"] if p["location_verified"] and p["time_verified"]],
              "unverified_photos": [p["ev_id"] for p in it["photos"] if not (p["location_verified"] and p["time_verified"])]}
             for it in payload["items"]]

    async def mutate(pipe) -> None:
        await pipe.begin("claims")
        pipe.facts.audit = {"status": "completed", "audit_id": audit_id, "items": items,
                            "auditor": payload["auditor"], "completed_at": str(payload["completed_at"])}
        pipe.coverage["genba_audit"] = "ok"
        for ev in [e for it in items for e in it["evidence_ids"]]:
            pipe.facts.ev.setdefault("audit", []).append(ev)
        pipe.ev_n = max(pipe.ev_n, *[int(e.split("_")[1]) for it in items for e in it["evidence_ids"] + it["unverified_photos"]],
                        0)
        for it in items:
            await pipe.note("claims", f"🧾 Field audit · {it['text_en'][:70]} → {it['status'].upper()}"
                                      f"{' [' + ', '.join(it['evidence_ids']) + ']' if it['evidence_ids'] else ''}",
                            "warn" if it["status"] in ("fail", "unverified") else "info", icon="🧾")
            if not it["claim_node"] or it["status"] not in ("pass", "fail"):
                continue
            for c in pipe.facts.claims:
                if c["node"] == it["claim_node"]:
                    c["verdict"] = "verified" if it["status"] == "pass" else "contradicted"
                    c["evidence_ids"] = list(dict.fromkeys(c["evidence_ids"] + it["evidence_ids"]))
                    c["explanation_en"] += f" Field audit: {it['note']}."
                    c["explanation_ja"] += f"現地監査：{it['note']}。"
                    await pipe.emit("claim.checked", claim=c)
        await pipe.end("claims", "field evidence applied")

    result = await reassess(inv_id, mutate, "on-site audit completed")
    return {"audit": audit_summary(inv_id), **result}


@router.post("/api/audits/{audit_id}/complete")
async def complete(audit_id: int) -> dict:
    return await complete_audit(audit_id)


def _demo_photo(caption: str, lat: float, lon: float, when: datetime) -> bytes:
    """A clearly labelled DEMO placeholder "photo" carrying real EXIF GPS + timestamp. Shows no real place."""
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (960, 720), (236, 237, 240))
    d = ImageDraw.Draw(img)
    for y in range(0, 720, 24):
        d.line([(0, y), (960, y)], fill=(228, 229, 233))
    try:
        big, font, small = (ImageFont.truetype("arialbd.ttf", 54), ImageFont.truetype("arial.ttf", 30),
                            ImageFont.truetype("arial.ttf", 22))
    except OSError:
        big = font = small = ImageFont.load_default()
    d.rectangle([40, 40, 920, 680], outline=(20, 20, 20), width=3)
    d.text((80, 90), "DEMO FIELD PHOTO", fill=(227, 18, 43), font=big)
    d.text((80, 190), "Placeholder for the auditor's photo.", fill=(58, 61, 69), font=font)
    words, line, y = caption.split(), "", 270
    for w in words:
        if len(line) + len(w) > 52:
            d.text((80, y), line, fill=(20, 20, 20), font=font)
            line, y = "", y + 44
        line += w + " "
    d.text((80, y), line, fill=(20, 20, 20), font=font)
    d.text((80, 600), f"EXIF GPS {lat:.5f}, {lon:.5f}  ·  {when:%Y-%m-%d %H:%M} IST", fill=(92, 97, 108), font=small)
    exif = Image.Exif()
    exif[306] = when.strftime("%Y:%m:%d %H:%M:%S")

    def dms(v: float) -> tuple:
        v = abs(v)
        d_ = int(v)
        m_ = int((v - d_) * 60)
        return (float(d_), float(m_), round((v - d_ - m_ / 60) * 3600, 2))

    exif[0x8825] = {1: "N" if lat >= 0 else "S", 2: dms(lat), 3: "E" if lon >= 0 else "W", 4: dms(lon)}
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=88, exif=exif)
    return buf.getvalue()


DEMO_RESULTS = {
    "GROUND_AREA_MISMATCH": ("fail", "Production floor measured at about 340 m², against 50,000 sq ft (4,645 m²) claimed"),
    "GROUND_AFTER_CLAIMED_YEAR": ("fail", "Electricity connection dated 2022-08; no structure before 2022"),
    "GROUND_LOW_ACTIVITY": ("fail", "Day shift: 9 workers and 4 machines running"),
    "ADDRESS_MISMATCH": ("pass", "Signage found at the GST place of business in Delhi"),
    "CMP_GST_CANCELLED": ("fail", "The certificate on display carries the cancelled GSTIN; no active registration shown"),
    "CMP_FILING_OVERDUE": ("fail", "No audited accounts or AOC-4 receipts available on site"),
    "NET_SHARED_ADDRESS_CLUSTER": ("pass", "Nameplates of 6 companies photographed at the registered address"),
    "claim:certification": ("pass", "Certificate shown on site"),
    "claim:employees": ("fail", "Roster lists 14 employees against 350+ claimed"),
    "claim:capacity": ("fail", "6 CNC machines counted against 40 claimed"),
    "claim:turnover": ("fail", "Sales register shows about ₹25 lakh a month"),
    "claim:clients": ("fail", "Purchase orders are from local traders; no OEM orders found"),
}


@router.post("/api/investigations/{inv_id}/audits/demo-complete")
async def demo_complete(inv_id: int) -> dict:
    """Seeds a completed Genba Audit for a DEMO investigation (labelled), so the whole loop can be shown."""
    with session() as s:
        inv = s.get(Investigation, inv_id)
        if not inv or not inv.is_demo:
            raise HTTPException(409, "Demo audits are only available for DEMO companies")
    today = date.today()
    audit = create_audit(inv_id, AuditIn(audit_type="production_capability", start=today - timedelta(days=2),
                                         end=today + timedelta(days=1)))
    site = audit["pin"]
    with session() as s:
        a = s.get(Audit, audit["id"])
        a.is_demo = True
        s.add(a)
        s.commit()
    when = datetime.now(timezone(timedelta(hours=5, minutes=30))).replace(microsecond=0) - timedelta(hours=20)
    for i, it in enumerate(audit["items"]):
        offset = (i % 4 - 1.5) * 0.00018
        lat, lon = site["lat"] + offset, site["lon"] - offset
        if it["source"] == "claim:certification":
            lat, lon = site["lat"] + 0.08, site["lon"] - 0.07  # taken ~12 km away: must fail the GPS check
        data = _demo_photo(it["text_en"], lat, lon, when + timedelta(minutes=12 * i))
        with session() as s:
            a, item = s.get(Audit, audit["id"]), s.get(AuditItem, it["id"])
        store_photo(a, item, data, f"demo_{i}.jpg")
        status, note = DEMO_RESULTS.get(it["source"], ("pass", "Confirmed on site"))
        set_item_result(audit["id"], it["id"], ItemResult(status=status, note=note))
    return await complete_audit(audit["id"])


# ----- 稟議書 (ringi-sho) -------------------------------------------------------------------------------------------
SEEKING_JA = {"distributor": "販売代理店", "jv": "合弁パートナー", "supplier": "仕入先", "contract_mfg": "製造委託先"}


def recommendation(band: str | None, flags: list[dict]) -> dict:
    """Rule-derived, never from the LLM."""
    critical = [f for f in flags if f["severity"] == "critical"]
    high = [f for f in flags if f["severity"] == "high"]
    if critical or band == "high":
        return {"id": "decline", "ja": "見送り", "en": "Do not proceed",
                "reason_ja": f"重大または高リスクの指摘が{len(critical) + len(high)}件あり、信頼スコアが高リスク帯のため。",
                "reason_en": f"{len(critical) + len(high)} critical or high findings and a high-risk score band."}
    if band in ("caution", "standard") or high:
        return {"id": "conditional", "ja": "条件付き承認", "en": "Approve with conditions",
                "reason_ja": "下記の対策（前払い制限、書類確認、現地訪問）を条件とするため。",
                "reason_en": "Subject to the measures below (advance-payment limits, documents, site visit)."}
    if band == "low":
        return {"id": "approve", "ja": "承認", "en": "Approve", "reason_ja": "重大な指摘がなく低リスク帯のため。",
                "reason_en": "No serious findings and a low-risk band."}
    return {"id": "hold", "ja": "保留（追加調査）", "en": "Hold for more checks",
            "reason_ja": "登記情報を確認できなかったため。", "reason_en": "The registry could not be checked."}


@router.get("/api/investigations/{inv_id}/ringi")
def ringi(inv_id: int, drafter: str = "海外事業部 担当") -> dict:
    from .main import report_payload

    r = report_payload(inv_id)
    inv, sme, co = r["investigation"], r["sme"], r["investigation"]["company"]
    flags = sorted(r["flags"], key=lambda f: {"critical": 0, "high": 1, "medium": 2, "low": 3}[f["severity"]])
    rec = recommendation(inv["band"], flags)
    sugg, _ = report_mod.suggestions(flags, r["claims"], inv["band"] or "standard")
    ev_co = next((e["ev_id"] for e in r["evidence"] if e["adapter"] == "mca_ogd"), None)
    name = co.get("name") or r["partner"]["input_name"]
    overview = [
        f"{name}（CIN {co.get('cin', '—')}）は{co.get('state', '—')}州で{co.get('date_of_incorporation', '—')}に設立された法人で、"
        f"MCA上のステータスは「{co.get('status', '—')}」です[{ev_co}]。" if co else "登記情報を確認できませんでした。",
    ]
    if r["ground"].get("site"):
        g = r["ground"]
        measured = (g.get("buildings") or {}).get("latest_area_m2") or (g.get("osm") or {}).get("total_area_m2")
        ev_g = (g.get("buildings") or {}).get("evidence_id") or (g.get("osm") or {}).get("evidence_id")
        overview.append(f"衛星データによる現地確認では、主張拠点の建築面積は約{measured or 0:,}㎡です[{ev_g}]。")
    if r["money"].get("status") == "received":
        m = r["money"]
        overview.append(f"同意に基づくGST申告データ（シミュレーション）では直近12か月の売上は₹{m['declared_12m'] / 1e7:,.2f}croreです"
                        f"[{m['evidence_id']}]。")
    return {
        "subject": f"インド現地パートナー候補 {name}との取引開始に関する件",
        "drafter": drafter, "company_ja": sme.get("name_ja") or sme["name"], "date": date.today().isoformat(),
        "purpose": (f"当社のインド市場参入にあたり、{SEEKING_JA.get(sme['seeking'], 'パートナー')}候補である{name}との"
                    "取引開始の可否について、Shinraiによる信用調査結果に基づきご判断をお願いするものです。"),
        "overview": overview,
        "score": inv["overall_score"], "band": inv["band"], "subscores": inv["subscores"], "families": r["families"],
        "findings": [{"severity": f["severity"], "text_ja": f["text_ja"], "text_en": f["text_en"],
                      "evidence_ids": f["evidence_ids"], "rule_id": f["rule_id"]} for f in flags[:8]],
        "measures": [{"ja": s["ja"], "en": s["en"]} for s in sugg],
        "recommendation": rec,
        "attachments": [{"ev_id": e["ev_id"], "source": e["source_name"], "summary": e["summary"], "mode": e["mode"],
                         "retrieved_at": e["retrieved_at"]} for e in r["evidence"]],
        "summary_ja": (inv.get("narrative") or {}).get("summary_ja", ""),
        "is_demo": inv["is_demo"], "audited": bool(r["audit"] and r["audit"]["status"] == "completed"),
        "money_simulated": r["money"].get("status") == "received",
        "stamps": ["担当", "課長", "部長", "社長"],
    }


# ----- PDF export (Playwright prints the same React pages) ---------------------------------------------------------
async def _print(path: str, landscape: bool) -> bytes:
    """Renders the same React page to PDF in a child process (see app/pdfprint.py)."""
    import asyncio
    import subprocess
    import sys
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "out.pdf"
        cmd = [sys.executable, "-m", "app.pdfprint", f"{config.FRONTEND_URL}{path}", str(out), "1" if landscape else "0"]
        proc = await asyncio.to_thread(subprocess.run, cmd, cwd=str(config.BASE_DIR), capture_output=True, timeout=120)
        if proc.returncode != 0 or not out.exists():
            raise HTTPException(502, f"PDF rendering failed: {proc.stderr.decode(errors='ignore')[-300:]}")
        return out.read_bytes()


@router.get("/api/investigations/{inv_id}/pdf")
async def report_pdf(inv_id: int, lang: str = "bi") -> Response:
    pdf = await _print(f"/report/{inv_id}?print=1&lang={lang}", landscape=True)
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="shinrai_report_{inv_id}.pdf"'})


@router.get("/api/investigations/{inv_id}/ringi.pdf")
async def ringi_pdf(inv_id: int) -> Response:
    pdf = await _print(f"/ringi/{inv_id}?print=1", landscape=False)
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="ringi_{inv_id}.pdf"'})
