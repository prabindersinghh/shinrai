"""Shinrai Distress Model inference. Active only when FEATURE_DISTRESS_MODEL is on and a trained model exists.

The model never sets a score by itself: its output is Evidence, and only the NET_DISTRESS_HIGH rule acts on it.
"""
from __future__ import annotations

import json
from datetime import date
from functools import lru_cache

import numpy as np
import pandas as pd

from ..config import BASE_DIR, env

MODEL_DIR = BASE_DIR / "models" / "distress"


def enabled() -> bool:
    return env("FEATURE_DISTRESS_MODEL", "1") == "1" and (MODEL_DIR / "model.txt").exists()


@lru_cache(maxsize=1)
def _load():
    import lightgbm as lgb

    booster = lgb.Booster(model_file=str(MODEL_DIR / "model.txt"))
    curves = json.loads((MODEL_DIR / "curves.json").read_text(encoding="utf-8"))
    metrics = json.loads((MODEL_DIR / "metrics.json").read_text(encoding="utf-8"))
    return booster, curves, metrics


def card() -> dict:
    """Model card for the UI: real metrics if trained, otherwise an honest 'not trained' state."""
    if not (MODEL_DIR / "metrics.json").exists():
        return {"trained": False, "model": "shinrai-distress",
                "note": "Not trained yet: needs real MCA company master data (set DATA_GOV_IN_KEY and run scripts/train_distress.py)."}
    _, curves, metrics = _load()
    return {"trained": True, **metrics, "curves": curves}


def score(records: list[dict]) -> list[dict]:
    """Distress probability, percentile and SHAP top-5 for MCA master records (seed/live schema)."""
    from scripts.train_distress import CATEGORICAL, features  # same feature code as training

    booster, curves, metrics = _load()
    df = pd.DataFrame([{
        "CIN": r.get("cin", ""), "CompanyRegistrationdate_date": r.get("date_of_incorporation"),
        "PaidupCapital": r.get("paid_up_capital"), "AuthorizedCapital": r.get("authorized_capital"),
        "CompanyClass": r.get("company_class"), "CompanyCategory": r.get("category"),
    } for r in records])
    X = features(df, date.today())
    for c in CATEGORICAL:
        X[c] = pd.Categorical(X[c], categories=curves["categories"][c])
    enc = curves["encoding"]
    X["state_industry_rate"] = (X["state"].astype(str) + "|" + X["industry2"].astype(str)).map(enc["table"]).fillna(enc["prior"])
    p = booster.predict(X)
    contrib = booster.predict(X, pred_contrib=True)
    pct = np.searchsorted(curves["percentiles"], p) / (len(curves["percentiles"]) - 1) * 100
    out = []
    for i, r in enumerate(records):
        pairs = sorted(zip(X.columns, contrib[i][:-1]), key=lambda t: -abs(t[1]))[:5]
        out.append({"cin": r.get("cin"), "probability": round(float(p[i]), 4), "percentile": round(float(pct[i]), 1),
                    "shap_top5": [{"feature": f, "contribution": round(float(v), 4)} for f, v in pairs],
                    "model": metrics["model"], "version": metrics["version"]})
    return out
