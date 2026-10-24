"""Shinrai Analytics (Vizro): Market Explorer, Partner Portfolio, Model Cards, Ground Overview.

Reads the same SQLite database and knowledge base through a read-only data layer; no copies. Mounted in FastAPI at
/analytics (Dash is WSGI) and shown inside the React Analytics tab.
"""
from __future__ import annotations

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import vizro.models as vm
from sqlmodel import select
from vizro import Vizro
from vizro.managers import data_manager
from vizro.models.types import capture

from app.advisor.fit import support_scores
from app.advisor.kb import kb
from app.intel import distress
from app.models import Flag, Investigation, Partner, session

INK, RED, NAVY, TEAL, AMBER, MUTED = "#141414", "#E3122B", "#1E3A5F", "#2BB3A3", "#D97706", "#9AA0AB"
BAND_COLOURS = {"low": "#15803D", "standard": INK, "caution": AMBER, "high": RED, "insufficient": MUTED}
LAYOUT = dict(font=dict(family="Inter, sans-serif", size=12, color=INK), paper_bgcolor="#FFFFFF", plot_bgcolor="#FFFFFF",
              margin=dict(l=40, r=20, t=40, b=40), colorway=[NAVY, RED, TEAL, AMBER, MUTED])


# ----- read-only data layer ------------------------------------------------------------------------------------
def market_df() -> pd.DataFrame:
    sup = support_scores()
    rows = []
    for s in kb().section("states", "states"):
        rows.append({"state": s["name"], "asi_gva_share_pct": s.get("asi_gva_share_pct"),
                     "asi_employment_share_pct": s.get("asi_employment_share_pct"),
                     "jp_companies_2021": s.get("jp_companies_2021"), "fdi_h1_fy25_usd_mn": s.get("fdi_h1_fy25_usd_mn"),
                     "jits": len(s.get("jits") or []), "support": round(sup[s["name"]]["score"] * 100, 1),
                     "nearest_office": sup[s["name"]]["nearest_office"], "nearest_km": sup[s["name"]]["nearest_km"]})
    df = pd.DataFrame(rows)
    # Opportunity proxy for the scatter: mean of the available normalised market factors (no imputation of missing values).
    cols = ["asi_gva_share_pct", "asi_employment_share_pct", "jp_companies_2021", "fdi_h1_fy25_usd_mn"]
    norm = df[cols].apply(lambda c: (c - c.min()) / (c.max() - c.min()) if c.max() > c.min() else c * 0)
    df["opportunity"] = (norm.mean(axis=1, skipna=True) * 100).round(1)
    return df


def portfolio_df() -> pd.DataFrame:
    rows = []
    with session() as s:
        for inv in s.exec(select(Investigation).where(Investigation.status == "done")):
            p = s.get(Partner, inv.partner_id)
            flags = list(s.exec(select(Flag).where(Flag.inv_id == inv.id)))
            rows.append({"inv_id": inv.id, "company": inv.company.get("name") or p.input_name, "state": inv.company.get("state"),
                         "score": inv.overall_score, "band": inv.band, "fit": inv.fit_score, "flags": len(flags),
                         "mode": inv.mode_used, "illustrative": inv.is_demo,
                         **{f"flags_{fam}": sum(f.family == fam for f in flags) for fam in
                            ("identity", "compliance", "legal", "network", "claims", "reputation", "ground", "money", "audit")}})
    df = pd.DataFrame(rows)
    if df.empty:
        return pd.DataFrame(columns=["inv_id", "company", "state", "score", "band", "fit", "flags", "mode", "illustrative"])
    return df.sort_values("inv_id").drop_duplicates("company", keep="last")


def ground_df() -> pd.DataFrame:
    rows = []
    with session() as s:
        for inv in s.exec(select(Investigation).where(Investigation.status == "done")):
            g = (inv.state or {}).get("facts", {}).get("ground") or {}
            for r in (g.get("buildings") or {}).get("series", []):
                rows.append({"company": inv.company.get("name"), "year": r["year"], "built_area_m2": r["built_area_m2"],
                             "activity_ratio": (g.get("nightlights") or {}).get("activity_ratio")})
    df = pd.DataFrame(rows)
    return df.drop_duplicates(["company", "year"]) if not df.empty else pd.DataFrame(columns=["company", "year", "built_area_m2", "activity_ratio"])


data_manager["market"] = market_df
data_manager["portfolio"] = portfolio_df
data_manager["ground"] = ground_df


# ----- charts ------------------------------------------------------------------------------------------------------
@capture("graph")
def bar_metric(data_frame: pd.DataFrame, x: str, y: str, title: str) -> go.Figure:
    df = data_frame.dropna(subset=[y]).sort_values(y)
    fig = px.bar(df, x=y, y=x, orientation="h", title=title, color_discrete_sequence=[NAVY])
    fig.update_layout(**LAYOUT, yaxis_title=None, xaxis_title=None)
    return fig


@capture("graph")
def support_vs_opportunity(data_frame: pd.DataFrame) -> go.Figure:
    fig = px.scatter(data_frame, x="support", y="opportunity", text="state", size=[18] * len(data_frame),
                     title="Support coverage vs opportunity (complements JETRO)", color_discrete_sequence=[NAVY])
    fig.add_shape(type="rect", x0=0, x1=data_frame["support"].median(), y0=data_frame["opportunity"].median(), y1=105,
                  fillcolor="rgba(217,119,6,0.08)", line_width=0)
    fig.add_annotation(x=5, y=102, text="White space: high opportunity, thinner support", showarrow=False, xanchor="left",
                       font=dict(color=AMBER, size=11))
    fig.update_traces(textposition="top center")
    fig.update_layout(**LAYOUT, xaxis_title="Support coverage (0–100)", yaxis_title="Market opportunity (0–100)",
                      xaxis_range=[0, 105], yaxis_range=[0, 110], showlegend=False)
    return fig


@capture("graph")
def fit_vs_trust(data_frame: pd.DataFrame) -> go.Figure:
    fig = px.scatter(data_frame, x="fit", y="score", color="band", text="company", color_discrete_map=BAND_COLOURS,
                     title="Fit with your needs vs trust score")
    fig.update_traces(marker=dict(size=14, line=dict(width=1, color="#FFFFFF")), textposition="top center")
    fig.update_layout(**LAYOUT, xaxis_title="Fit (0–100)", yaxis_title="Trust score (0–100)", xaxis_range=[0, 105], yaxis_range=[-5, 105])
    return fig


@capture("graph")
def band_counts(data_frame: pd.DataFrame) -> go.Figure:
    counts = data_frame["band"].value_counts().reindex(["low", "standard", "caution", "high", "insufficient"]).dropna().reset_index()
    counts.columns = ["band", "partners"]
    fig = px.bar(counts, x="band", y="partners", color="band", color_discrete_map=BAND_COLOURS, title="Partners by band")
    fig.update_layout(**LAYOUT, showlegend=False, xaxis_title=None)
    return fig


@capture("graph")
def flags_by_family(data_frame: pd.DataFrame) -> go.Figure:
    fams = [c for c in data_frame.columns if c.startswith("flags_")]
    long = data_frame.melt(id_vars=["company"], value_vars=fams, var_name="family", value_name="flags")
    long["family"] = long["family"].str.replace("flags_", "")
    fig = px.bar(long[long["flags"] > 0], x="flags", y="company", color="family", orientation="h", title="Flags by family")
    fig.update_layout(**LAYOUT, yaxis_title=None)
    return fig


@capture("graph")
def model_curve(data_frame: pd.DataFrame, kind: str) -> go.Figure:
    card = distress.card()
    fig = go.Figure()
    if not card["trained"]:
        fig.add_annotation(text="Distress model not trained yet:<br>real MCA records are required (scripts/train_distress.py)",
                           showarrow=False, font=dict(size=13, color=MUTED))
        fig.update_layout(**LAYOUT, xaxis_visible=False, yaxis_visible=False, title="Distress model")
        return fig
    c = card["curves"]
    if kind == "roc":
        fig.add_scatter(x=c["roc"]["fpr"], y=c["roc"]["tpr"], line=dict(color=RED, width=2.5), name="ROC")
        fig.add_scatter(x=[0, 1], y=[0, 1], line=dict(color=MUTED, dash="dash"), name="chance")
        fig.update_layout(title=f"ROC curve · AUC {card['roc_auc']}", xaxis_title="False positive rate", yaxis_title="True positive rate")
    elif kind == "pr":
        fig.add_scatter(x=c["pr"]["recall"], y=c["pr"]["precision"], line=dict(color=NAVY, width=2.5), name="PR")
        fig.update_layout(title=f"Precision-recall · AP {card['pr_auc']}", xaxis_title="Recall", yaxis_title="Precision")
    elif kind == "calibration":
        fig.add_scatter(x=c["calibration"]["mean_predicted"], y=c["calibration"]["fraction_positive"], mode="lines+markers",
                        line=dict(color=TEAL, width=2.5), name="model")
        fig.add_scatter(x=[0, 1], y=[0, 1], line=dict(color=MUTED, dash="dash"), name="perfect")
        fig.update_layout(title=f"Calibration · Brier {card['brier']}", xaxis_title="Mean predicted", yaxis_title="Observed rate")
    else:
        imp = pd.DataFrame(c["shap_global"]).sort_values("mean_abs_shap")
        fig = px.bar(imp, x="mean_abs_shap", y="feature", orientation="h", title="Global feature importance (mean |SHAP|)",
                     color_discrete_sequence=[INK])
    fig.update_layout(**LAYOUT, showlegend=False)
    return fig


@capture("graph")
def built_area(data_frame: pd.DataFrame) -> go.Figure:
    fig = px.line(data_frame, x="year", y="built_area_m2", color="company", markers=True, title="Built area at investigated sites (m²)")
    fig.update_layout(**LAYOUT, xaxis_title=None, yaxis_title="m²")
    return fig


def _model_text() -> str:
    card = distress.card()
    if not card["trained"]:
        return ("**Shinrai Distress Model** · status: not trained. Trains on real MCA company master data only "
                "(label: struck off, dormant or in liquidation vs active). Run `python -m scripts.train_distress` with a data.gov.in key.")
    return (f"**Shinrai Distress Model v{card['version']}** · trained {card['trained_at']} on {card['n_rows']:,} MCA records "
            f"({card['n_positive']:,} distressed) · ROC-AUC **{card['roc_auc']}** · PR-AUC **{card['pr_auc']}** · Brier **{card['brier']}** · "
            f"{card['cv']}. Limitations: master-record features only; a signal, not a finding.")


def build() -> Vizro:
    pages = [
        vm.Page(title="Market Explorer", components=[
            vm.Graph(figure=support_vs_opportunity(data_frame="market")),
            vm.Graph(figure=bar_metric(data_frame="market", x="state", y="asi_gva_share_pct", title="Share of manufacturing GVA, ASI 2022-23 (%)")),
            vm.Graph(figure=bar_metric(data_frame="market", x="state", y="jp_companies_2021", title="Japanese companies, Oct 2021")),
            vm.Graph(figure=bar_metric(data_frame="market", x="state", y="fdi_h1_fy25_usd_mn", title="FDI equity inflows Apr–Sep 2024 (US$ m)")),
        ], layout=vm.Grid(grid=[[0, 0, 1], [0, 0, 2], [3, 3, 3]])),
        vm.Page(title="Partner Portfolio", components=[
            vm.Graph(figure=fit_vs_trust(data_frame="portfolio")),
            vm.Graph(figure=band_counts(data_frame="portfolio")),
            vm.Graph(figure=flags_by_family(data_frame="portfolio")),
            vm.Table(title="Investigated partners", figure=__import__("vizro.tables", fromlist=["dash_ag_grid"]).dash_ag_grid(
                data_frame="portfolio", columnDefs=[{"field": f} for f in ("company", "state", "score", "band", "fit", "flags", "mode")])),
        ], layout=vm.Grid(grid=[[0, 1], [2, 2], [3, 3]])),
        vm.Page(title="Model Cards", components=[
            vm.Text(text=_model_text()),
            vm.Graph(figure=model_curve(data_frame="portfolio", kind="roc")),
            vm.Graph(figure=model_curve(data_frame="portfolio", kind="pr")),
            vm.Graph(figure=model_curve(data_frame="portfolio", kind="calibration")),
            vm.Graph(figure=model_curve(data_frame="portfolio", kind="shap")),
        ], layout=vm.Grid(grid=[[0, 0], [1, 2], [3, 4]], row_min_height="320px")),
        vm.Page(title="Ground Overview", components=[
            vm.Graph(figure=built_area(data_frame="ground")),
        ]),
    ]
    dashboard = vm.Dashboard(title="Shinrai Analytics", pages=pages, theme="vizro_light")
    return Vizro(requests_pathname_prefix="/analytics/", routes_pathname_prefix="/").build(dashboard)
