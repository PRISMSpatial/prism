"""Pydantic models — 1:1 mirror of frontend src/types/domain.ts"""
from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict
from typing import Literal


# ─── Enums as Literals ─────────────────────────────────────────────────────────

Tier = Literal["T3", "T2", "T1", "T0"]
TransmissionState = Literal["GROWING", "DECLINING", "UNCERTAIN"]
Phenotype = Literal["Import-Dominated", "Endemic Persistence", "Transitional"]
SourceKind = Literal["clinical", "genomic", "mobility", "avian", "wastewater"]
SourceStatus = Literal["live", "fresh", "stale", "error"]
ImpactLevel = Literal["high", "mid", "low"]
AnomalyStatus = Literal["new", "escalated", "monitoring", "dismissed"]
DrugStatus = Literal["lead", "candidate", "preclinical", "screening"]


# ─── Core models ───────────────────────────────────────────────────────────────

class EpiSplatSignals(BaseModel):
    ps: float
    rt: float
    subtype: str
    hNorm: float
    tcc: float
    eti: float
    rd: float
    asMut: float


class ConcordanceLayers(BaseModel):
    clinical: float
    genomic: float
    wastewater: float


class Region(BaseModel):
    id: str
    name: str
    country: str
    iso: str
    lat: float
    lon: float
    tier: Tier
    phen: Phenotype
    rt: float
    rtLo: float
    rtHi: float
    seeding: float
    state: TransmissionState
    concord: float
    clade: str
    splat: EpiSplatSignals
    splatTimeline: list[EpiSplatSignals]
    concordanceLayers: ConcordanceLayers


class Clade(BaseModel):
    id: str
    origin: str
    n: int
    fitness: float


class DataSource(BaseModel):
    id: str
    name: str
    kind: SourceKind
    latency: str
    status: SourceStatus
    color: str
    last: str


class Metric(BaseModel):
    id: str
    name: str
    desc: str


class HeatRow(BaseModel):
    region: str
    metric: str
    vals: list[float]


class ForecastData(BaseModel):
    weeks: int
    median: list[float]
    p50: list[tuple[float, float]]
    p80: list[tuple[float, float]]
    p95: list[tuple[float, float]]
    now: int


class IncidenceData(BaseModel):
    obs: list[float | None]
    fit: list[float]


class TreeNode(BaseModel):
    id: str
    x: float
    y: float
    parent: str | None
    clade: str
    leaf: bool
    highlight: bool


class ReassortmentBridge(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    from_node: str = Field(alias="from")
    to: str
    segment: str


class SankeyFlow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    clade: str
    from_node: str = Field(alias="from")
    to: str
    value: float
    color: str
    ps: float


class RootToTipPoint(BaseModel):
    t: float
    d: float
    seq: str
    highlight: bool


class Mutation(BaseModel):
    site: int
    wt: str
    mut: str
    koel: float
    esm: float
    freq: float
    first: str
    impact: ImpactLevel


class AlignmentChar(BaseModel):
    idx: int
    aa: str
    highlight: bool
    ss: Literal["helix", "sheet", "loop"]


class InboxItem(BaseModel):
    id: str
    region: str
    tier: Tier
    score: float
    status: AnomalyStatus
    age: str
    title: str


class NotebookCell(BaseModel):
    n: int
    kind: Literal["code", "md", "out"]
    title: str | None = None
    src: str
    lang: str | None = None


class Pathogen(BaseModel):
    name: str
    clade: str


class DrugCandidate(BaseModel):
    name: str
    affinity: float
    selectivity: float
    status: DrugStatus


# ─── Composite response models ────────────────────────────────────────────────

class TreeData(BaseModel):
    nodes: list[TreeNode]
    reassortmentBridges: list[ReassortmentBridge]


class PhylogenyResponse(BaseModel):
    tree: TreeData
    sankey: list[SankeyFlow]
    rootToTip: list[RootToTipPoint]
    clades: list[Clade]


class MoleculeResponse(BaseModel):
    mutations: list[Mutation]
    alignment: list[AlignmentChar]


# ─── Pipeline models ──────────────────────────────────────────────────────────

class PipelineStatus(BaseModel):
    run_id: str
    status: Literal["pending", "running", "completed", "failed"]
    current_stage: str | None = None
    progress: float = 0.0
    started_at: str | None = None
    completed_at: str | None = None
    error: str | None = None


class UploadResponse(BaseModel):
    upload_id: str
    filename: str
    seq_count: int
