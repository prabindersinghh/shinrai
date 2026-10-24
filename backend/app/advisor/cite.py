"""Advice post-check: a sentence stating a number, deadline, fee or legal requirement must cite the KB."""
from __future__ import annotations

import re

KB_CITE = re.compile(r"\[kb:([a-z0-9_]+)\]")
NEEDS_CITE = re.compile(
    r"\d|₹|¥|\$|%|\bwithin\b|\bdeadline\b|\bfee\b|\bpenalt|\bmust\b|\brequired?\b|\bAct\b|\bsection\b|\bs\.\d|"
    r"日以内|期限|手数料|罰|義務|必要|法", re.I)


def postcheck(text: str, valid_ids: set[str], lang: str = "en") -> tuple[str, int]:
    """Drop sentences that need a citation but lack a valid one, or cite an unknown KB id."""
    parts = re.split(r"(?<=。)" if lang == "ja" else r"(?<=[.!?])\s+", text.strip())
    kept, dropped = [], 0
    for s in (p.strip() for p in parts):
        if not s:
            continue
        cites = KB_CITE.findall(s)
        bare = KB_CITE.sub("", s)
        if any(c not in valid_ids for c in cites) or (NEEDS_CITE.search(bare) and not cites):
            dropped += 1
            continue
        kept.append(s)
    return ("" if lang == "ja" else " ").join(kept), dropped
