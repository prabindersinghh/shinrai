"""SQLModel tables (TRD §3)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import Column
from sqlalchemy.types import JSON
from sqlmodel import Field, Session, SQLModel, create_engine

from .config import DB_PATH


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def JsonField(default: Any = None) -> Any:  # noqa: N802 - reads like a type
    factory = (lambda: list(default)) if isinstance(default, list) else (lambda: dict(default or {}))
    return Field(default_factory=factory, sa_column=Column(JSON))


class Sme(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    name_ja: str = ""
    industry: str = ""
    seeking: str = "distributor"  # distributor | jv | supplier | contract_mfg
    target_states: list[str] = JsonField([])
    deal_band: str = "mid"  # small | mid | large
    risk_appetite: str = "balanced"  # conservative | balanced | aggressive
    language: str = "ja"
    products: str = ""
    hs_chapter: str = ""
    export_markets: list[str] = JsonField([])
    goal: str = "sell"  # sell | manufacture | source | export_hub
    investment_band: str = "50m_300m"  # lt50m | 50m_300m | 300m_1b | gt1b
    headcount_y1: int = 0
    timeline_months: int = 12
    entry_mode: str = "undecided"  # distributor | jv | wos | liaison | contract_mfg | undecided
    must_haves: list[str] = JsonField([])
    advisor_state: dict = JsonField({})  # compliance step statuses, slider weights
    created_at: datetime = Field(default_factory=utcnow)


class Partner(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    sme_id: int = Field(index=True)
    input_name: str = ""
    cin: Optional[str] = None
    gstin: Optional[str] = None
    doc_path: Optional[str] = None
    doc_name: Optional[str] = None
    status: str = "new"  # new | investigating | done
    created_at: datetime = Field(default_factory=utcnow)


class Investigation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    partner_id: int = Field(index=True)
    mode: str = "auto"  # requested: auto | live | cached | seed
    mode_used: str = "seed"  # strongest mode actually used across adapters
    status: str = "queued"  # queued | running | done | failed
    started_at: datetime = Field(default_factory=utcnow)
    finished_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    overall_score: Optional[int] = None
    band: Optional[str] = None
    subscores: dict = JsonField({})
    fit_score: Optional[int] = None
    fit_detail: dict = JsonField({})
    company: dict = JsonField({})
    narrative: dict = JsonField({})
    outlook: list = JsonField([])
    coverage: dict = JsonField({})
    is_demo: bool = False
    state: dict = JsonField({})  # pipeline snapshot so consent / pin / audit can reassess


class Entity(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    inv_id: int = Field(index=True)
    node_id: str = Field(index=True)
    type: str  # company | person | address | gstin | case | news | doc_claim
    key: str = ""
    label: str = ""
    attrs: dict = JsonField({})
    risk: str = "none"  # none | low | med | high | critical
    community: Optional[int] = None


class Edge(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    inv_id: int = Field(index=True)
    src: str
    dst: str
    type: str  # director_of | registered_at | has_gstin | party_in | mentioned_in | claims
    attrs: dict = JsonField({})


class Evidence(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    inv_id: int = Field(index=True)
    ev_id: str = Field(index=True)
    adapter: str
    source_name: str = ""
    query: dict = JsonField({})
    url: str = ""
    retrieved_at: datetime = Field(default_factory=utcnow)
    mode: str = "seed"
    payload: Any = Field(default=None, sa_column=Column(JSON))
    summary: str = ""
    sha256: str = ""


class Flag(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    inv_id: int = Field(index=True)
    rule_id: str
    severity: str
    deduction: int
    family: str
    entity_ids: list[str] = JsonField([])
    evidence_ids: list[str] = JsonField([])
    text_en: str = ""
    text_ja: str = ""


class Claim(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    inv_id: int = Field(index=True)
    text: str
    field: str = "other"
    value: str = ""
    verdict: str = "unverifiable"  # verified | contradicted | unverifiable
    evidence_ids: list[str] = JsonField([])
    explanation_en: str = ""
    explanation_ja: str = ""


class TraceEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    inv_id: int = Field(index=True)
    seq: int
    ts: datetime = Field(default_factory=utcnow)
    type: str
    payload: dict = JsonField({})


class Consent(SQLModel, table=True):
    """SIMULATED Account Aggregator consent artefact."""
    id: Optional[int] = Field(default=None, primary_key=True)
    inv_id: int = Field(index=True)
    token: str = Field(index=True)
    status: str = "requested"  # requested | approved | denied
    fi_types: list[str] = JsonField(["GSTR-1", "GSTR-3B"])
    months: int = 18
    purpose: str = ""
    created_at: datetime = Field(default_factory=utcnow)
    decided_at: Optional[datetime] = None


class Audit(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    inv_id: int = Field(index=True)
    audit_type: str = "site_existence"
    status: str = "scheduled"  # scheduled | in_progress | completed
    auditor: dict = JsonField({})
    window_start: Optional[datetime] = None
    window_end: Optional[datetime] = None
    price_jpy: int = 0
    pin: dict = JsonField({})
    created_at: datetime = Field(default_factory=utcnow)
    completed_at: Optional[datetime] = None
    is_demo: bool = False


class AuditItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    audit_id: int = Field(index=True)
    source: str = ""  # rule id, claim:<field>, or custom
    claim_node: Optional[str] = None
    text_en: str = ""
    text_ja: str = ""
    status: str = "pending"  # pending | pass | fail | unverified
    note: str = ""


class AuditPhoto(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    audit_id: int = Field(index=True)
    item_id: int = Field(index=True)
    path: str = ""
    sha256: str = ""
    lat: Optional[float] = None
    lon: Optional[float] = None
    taken_at: Optional[datetime] = None
    distance_m: Optional[float] = None
    location_verified: bool = False
    time_verified: bool = False
    ev_id: str = ""


class LlmCache(SQLModel, table=True):
    key: str = Field(primary_key=True)
    purpose: str = ""
    output: Any = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utcnow)


engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _add_missing_columns()


def _add_missing_columns() -> None:
    """Additive migration: new nullable/defaulted columns on existing SQLite tables."""
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    with engine.begin() as conn:
        for table in SQLModel.metadata.sorted_tables:
            if not insp.has_table(table.name):
                continue
            have = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name not in have:
                    ddl = col.type.compile(engine.dialect)
                    conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {ddl}'))


def session() -> Session:
    return Session(engine, expire_on_commit=False)
