"""Train the Shinrai Distress Model on real MCA company master data (data.gov.in). Reproducible.

Label: 1 = Strike Off / Under process of Striking Off / Dormant / Under Liquidation; 0 = Active; other statuses
excluded. Features come only from the master record (no leakage from the label). Saves the model, metrics,
curves, calibration, SHAP global importance and a percentile table to models/distress/.

Data, either:
  python -m scripts.train_distress --fetch 200000      # pages the data.gov.in API (needs DATA_GOV_IN_KEY)
  python -m scripts.train_distress --csv path/to.csv   # a CSV downloaded from data.gov.in (RoC-wise master data)
then:
  python -m scripts.train_distress --train
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import time
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from app.config import BASE_DIR, DATA_DIR, DATA_GOV_IN_KEY, DATA_GOV_IN_RESOURCE  # noqa: E402

RAW = DATA_DIR / "distress" / "pages"
OUT = BASE_DIR / "models" / "distress"
POSITIVE = {"strike off", "under process of striking off", "dormant", "under liquidation", "struck off", "liquidated"}
NEGATIVE = {"active"}
MODEL_VERSION = "1.0"


def fetch(n: int, page: int = 1000) -> None:
    import httpx

    if not DATA_GOV_IN_KEY:
        raise SystemExit("Set DATA_GOV_IN_KEY (free from data.gov.in → My Account → API key)")
    RAW.mkdir(parents=True, exist_ok=True)
    url = f"https://api.data.gov.in/resource/{DATA_GOV_IN_RESOURCE}"
    with httpx.Client(timeout=60, headers={"User-Agent": "Shinrai/1.0 (research)"}) as client:
        for offset in range(0, n, page):
            f = RAW / f"page_{offset:08d}.json"
            if f.exists():
                continue
            for attempt in range(6):
                r = client.get(url, params={"api-key": DATA_GOV_IN_KEY, "format": "json", "limit": page, "offset": offset})
                if r.status_code == 429:
                    time.sleep(30 * (attempt + 1))
                    continue
                r.raise_for_status()
                break
            else:
                raise SystemExit(f"rate limited at offset {offset}; rerun later to resume")
            recs = r.json().get("records", [])
            f.write_text(json.dumps(recs), encoding="utf-8")
            print(f"offset {offset}: {len(recs)} records")
            if not recs:
                break
            time.sleep(1.2)


def load(csv: str | None) -> pd.DataFrame:
    if csv:
        df = pd.read_csv(csv, low_memory=False)
    else:
        rows = [r for f in sorted(RAW.glob("page_*.json")) for r in json.loads(f.read_text(encoding="utf-8"))]
        df = pd.DataFrame(rows)
    rename = {"CORPORATE_IDENTIFICATION_NUMBER": "CIN", "COMPANY_STATUS": "CompanyStatus", "COMPANY_CLASS": "CompanyClass",
              "COMPANY_CATEGORY": "CompanyCategory", "COMPANY_SUB_CATEGORY": "CompanySubCategory", "AUTHORIZED_CAP": "AuthorizedCapital",
              "PAIDUP_CAPITAL": "PaidupCapital", "DATE_OF_REGISTRATION": "CompanyRegistrationdate_date", "REGISTERED_STATE": "CompanyStateCode"}
    return df.rename(columns={k: v for k, v in rename.items() if k in df.columns})


def features(df: pd.DataFrame, today: date | None = None) -> pd.DataFrame:
    """Model features from the master record only. Shared by training and inference."""
    today = today or date.today()
    cin = df["CIN"].astype(str).str.upper()
    reg = pd.to_datetime(df["CompanyRegistrationdate_date"], errors="coerce", dayfirst=False)
    paid = pd.to_numeric(df["PaidupCapital"], errors="coerce").fillna(0).clip(lower=0)
    auth = pd.to_numeric(df["AuthorizedCapital"], errors="coerce").fillna(0).clip(lower=0)
    out = pd.DataFrame({
        "age_years": ((pd.Timestamp(today) - reg).dt.days / 365.25).clip(lower=0),
        "log_paid_up": np.log10(paid + 1),
        "log_authorised": np.log10(auth + 1),
        "paid_to_auth": np.where(auth > 0, paid / auth.replace(0, np.nan), np.nan),
        "listed": (cin.str[0] == "L").astype(int),
        "industry2": cin.str[1:3],
        "state": cin.str[6:8],
        "cin_class": cin.str[12:15],
        "company_class": df.get("CompanyClass", pd.Series(["?"] * len(df))).astype(str).str.lower(),
        "category": df.get("CompanyCategory", pd.Series(["?"] * len(df))).astype(str).str.lower(),
    })
    return out


CATEGORICAL = ["industry2", "state", "cin_class", "company_class", "category"]


def target_encode(train: pd.DataFrame, y: pd.Series, test: pd.DataFrame, cols: list[str], k: int = 5, prior_w: float = 20.0):
    """Out-of-fold mean encoding for state × industry base rates (no leakage)."""
    from sklearn.model_selection import KFold

    key_tr = train[cols].astype(str).agg("|".join, axis=1)
    key_te = test[cols].astype(str).agg("|".join, axis=1)
    prior = y.mean()
    oof = pd.Series(prior, index=train.index, dtype=float)
    for tr_idx, va_idx in KFold(k, shuffle=True, random_state=7).split(train):
        stats = y.iloc[tr_idx].groupby(key_tr.iloc[tr_idx]).agg(["sum", "count"])
        enc = (stats["sum"] + prior * prior_w) / (stats["count"] + prior_w)
        oof.iloc[va_idx] = key_tr.iloc[va_idx].map(enc).fillna(prior).values
    stats = y.groupby(key_tr).agg(["sum", "count"])
    full = (stats["sum"] + prior * prior_w) / (stats["count"] + prior_w)
    return oof, key_te.map(full).fillna(prior), {"prior": prior, "table": full.to_dict()}


def train(csv: str | None) -> None:
    import lightgbm as lgb
    import shap
    from sklearn.calibration import calibration_curve
    from sklearn.metrics import average_precision_score, brier_score_loss, precision_recall_curve, roc_auc_score, roc_curve
    from sklearn.model_selection import StratifiedKFold

    df = load(csv)
    status = df["CompanyStatus"].astype(str).str.strip().str.lower()
    keep = status.isin(POSITIVE | NEGATIVE)
    df, status = df[keep].reset_index(drop=True), status[keep].reset_index(drop=True)
    y = status.isin(POSITIVE).astype(int)
    if len(df) < 5000 or y.sum() < 200:
        raise SystemExit(f"Not enough labelled records to train honestly: {len(df)} rows, {int(y.sum())} distressed. Fetch more data.")
    X = features(df)
    for c in CATEGORICAL:
        X[c] = X[c].astype("category")
    oof = np.zeros(len(X))
    skf = StratifiedKFold(5, shuffle=True, random_state=7)
    models = []
    params = dict(n_estimators=400, learning_rate=0.05, num_leaves=63, min_child_samples=50, subsample=0.8, subsample_freq=1,
                  colsample_bytree=0.8, reg_lambda=1.0, verbose=-1)
    for tr, va in skf.split(X, y):
        Xtr, Xva = X.iloc[tr].copy(), X.iloc[va].copy()
        te_tr, te_va, _ = target_encode(Xtr, y.iloc[tr], Xva, ["state", "industry2"])
        Xtr["state_industry_rate"], Xva["state_industry_rate"] = te_tr.values, te_va.values
        m = lgb.LGBMClassifier(**params).fit(Xtr, y.iloc[tr])
        oof[va] = m.predict_proba(Xva)[:, 1]
        models.append(m)
    # Final model on all data with full-data encoding table (for inference).
    _, _, enc = target_encode(X, y, X, ["state", "industry2"])
    te_all, _, _ = target_encode(X, y, X, ["state", "industry2"])
    Xall = X.copy()
    Xall["state_industry_rate"] = te_all.values
    final = lgb.LGBMClassifier(**params).fit(Xall, y)
    metrics = {
        "model": "shinrai-distress", "version": MODEL_VERSION, "trained_at": date.today().isoformat(), "n_rows": int(len(X)),
        "n_positive": int(y.sum()), "positive_rate": round(float(y.mean()), 4),
        "roc_auc": round(float(roc_auc_score(y, oof)), 4), "pr_auc": round(float(average_precision_score(y, oof)), 4),
        "brier": round(float(brier_score_loss(y, oof)), 4), "cv": "stratified 5-fold, out-of-fold predictions",
        "data_source": "data.gov.in RoC-wise Company Master Data (MCA)", "label": sorted(POSITIVE),
    }
    fpr, tpr, _ = roc_curve(y, oof)
    prec, rec, _ = precision_recall_curve(y, oof)
    frac_pos, mean_pred = calibration_curve(y, oof, n_bins=10, strategy="quantile")
    idx = np.linspace(0, len(fpr) - 1, 120).astype(int)
    idx_pr = np.linspace(0, len(prec) - 1, 120).astype(int)
    sample = Xall.sample(min(3000, len(Xall)), random_state=7)
    sv = shap.TreeExplainer(final).shap_values(sample)
    sv = sv[1] if isinstance(sv, list) else sv
    importance = sorted(zip(sample.columns, np.abs(sv).mean(0)), key=lambda t: -t[1])
    OUT.mkdir(parents=True, exist_ok=True)
    final.booster_.save_model(str(OUT / "model.txt"))
    (OUT / "metrics.json").write_text(json.dumps(metrics, indent=1), encoding="utf-8")
    (OUT / "curves.json").write_text(json.dumps({
        "roc": {"fpr": fpr[idx].round(4).tolist(), "tpr": tpr[idx].round(4).tolist()},
        "pr": {"precision": prec[idx_pr].round(4).tolist(), "recall": rec[idx_pr].round(4).tolist()},
        "calibration": {"mean_predicted": mean_pred.round(4).tolist(), "fraction_positive": frac_pos.round(4).tolist()},
        "shap_global": [{"feature": f, "mean_abs_shap": round(float(v), 5)} for f, v in importance],
        "percentiles": np.quantile(oof, np.linspace(0, 1, 101)).round(5).tolist(),
        "categories": {c: [str(x) for x in X[c].cat.categories] for c in CATEGORICAL},
        "encoding": {"prior": enc["prior"], "table": {k: round(v, 5) for k, v in enc["table"].items()}},
    }), encoding="utf-8")
    print(json.dumps(metrics, indent=1))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", type=int, default=0)
    ap.add_argument("--csv")
    ap.add_argument("--train", action="store_true")
    a = ap.parse_args()
    if a.fetch:
        fetch(a.fetch)
    if a.train or a.csv:
        train(a.csv)
