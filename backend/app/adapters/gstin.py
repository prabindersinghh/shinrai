"""Local GSTIN validation: structure, state code, embedded PAN and the mod-36 checksum."""
from __future__ import annotations

import re

STATE_CODES: dict[str, str] = {
    "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
    "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
}
STATE_TO_CODE = {v.lower(): k for k, v in STATE_CODES.items()}

# CIN chars 7-8 are the state of registration.
CIN_STATE = {
    "HR": "Haryana", "DL": "Delhi", "MH": "Maharashtra", "KA": "Karnataka", "TN": "Tamil Nadu",
    "GJ": "Gujarat", "UP": "Uttar Pradesh", "RJ": "Rajasthan", "WB": "West Bengal", "TG": "Telangana",
    "TS": "Telangana", "AP": "Andhra Pradesh", "KL": "Kerala", "PB": "Punjab", "MP": "Madhya Pradesh",
    "OR": "Odisha", "CH": "Chandigarh", "GA": "Goa", "UR": "Uttarakhand", "HP": "Himachal Pradesh",
}

_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
GSTIN_RE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
PAN_RE = re.compile(r"^[A-Z]{5}\d{4}[A-Z]$")
CIN_RE = re.compile(r"^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$")
PAN_HOLDER = {"C": "Company", "P": "Individual", "H": "HUF", "F": "Firm/LLP", "A": "AOP", "T": "Trust"}


def checksum_char(first14: str) -> str:
    total = 0
    for i, ch in enumerate(first14):
        product = _CHARS.index(ch) * (2 if i % 2 else 1)
        total += product // 36 + product % 36
    return _CHARS[(36 - total % 36) % 36]


def make_gstin(state_code: str, pan: str, entity_no: str = "1") -> str:
    body = f"{state_code}{pan}{entity_no}Z"
    return body + checksum_char(body)


def check_gstin(gstin: str) -> dict:
    """Pure offline checks. Never raises; returns a dict of findings."""
    g = (gstin or "").strip().upper()
    result = {"gstin": g, "format_ok": bool(GSTIN_RE.match(g)), "state_code": g[:2], "state": None,
              "pan": g[2:12], "pan_holder": None, "checksum_ok": False}
    if not result["format_ok"]:
        return result
    result["state"] = STATE_CODES.get(g[:2])
    result["pan_holder"] = PAN_HOLDER.get(g[5])
    result["checksum_ok"] = checksum_char(g[:14]) == g[14]
    return result


def cin_state(cin: str) -> str | None:
    c = (cin or "").upper()
    return CIN_STATE.get(c[6:8]) if CIN_RE.match(c) else None


def cin_year(cin: str) -> int | None:
    c = (cin or "").upper()
    return int(c[8:12]) if CIN_RE.match(c) else None
