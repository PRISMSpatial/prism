"""Report Pydantic models."""
from pydantic import BaseModel, Field


class ReportRequest(BaseModel):
    region_id: str
    forecast_session_id: str | None = None
    virsift_session_id: str | None = None
    report_type: str = Field(default="sitrep", pattern="^(sitrep|weekly|outbreak)$")


class MetricBlock(BaseModel):
    label: str
    value: str
    unit: str = ""


class EvidenceRow(BaseModel):
    source: str
    kind: str
    body: str


class ForecastBlock(BaseModel):
    horizon_weeks: int
    current_rt_median: float
    current_rt_ci: list[float]
    peak_week: str
    peak_incidence_baseline: float
    peak_incidence_surge: float
    peak_incidence_intervention: float
    crossover_week: str | None = None
    has_seir: bool = False
    seir_r0: float | None = None
    seir_beta: float | None = None
    seir_sigma: float | None = None
    seir_gamma: float | None = None
    rt_median: list[float] | None = None
    rt_p50: list[list[float]] | None = None
    rt_p80: list[list[float]] | None = None
    rt_p95: list[list[float]] | None = None
    rt_now: int | None = None


class AnomalyRow(BaseModel):
    id: str
    tier: str
    title: str
    score: float
    status: str


class PhyloBlock(BaseModel):
    clade: str
    fitness: float
    n_sequences: int
    origin: str
    mutations: list[str]


class VirsiftBlock(BaseModel):
    filename: str
    sequences_active: int
    subtypes: dict[str, int]
    segments: dict[str, int]
    date_range: list[str | None]
    header_variant: str


class ActionItem(BaseModel):
    verb: str
    body: str
    priority: str = "normal"


class ReportData(BaseModel):
    report_id: str
    report_type: str
    generated_at: str
    region_id: str
    region_name: str
    country: str
    iso: str
    tier: str
    clade: str
    pathogen: str
    subtitle: str
    pullquote: str
    metrics: list[MetricBlock]
    evidence: list[EvidenceRow]
    forecast: ForecastBlock | None = None
    anomalies: list[AnomalyRow]
    phylo: PhyloBlock | None = None
    virsift: VirsiftBlock | None = None
    actions: list[ActionItem]
    confidence: float
    analyst: str = "PRISM · auto-generated"
    classification: str = "CONFIDENTIAL · INTERNAL DISTRIBUTION"
