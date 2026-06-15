from __future__ import annotations
from pydantic import BaseModel
from typing import Literal


class ParsedSequence(BaseModel):
    isolate: str
    subtype: str
    subtype_clean: str
    segment: str
    collection_date: str | None = None
    accession: str
    clade: str
    host: str
    host_species: str = "Unknown"
    location: str
    sequence_length: int
    sequence_hash: str
    clade_l1: str | None = None
    clade_l2: str | None = None
    clade_l3: str | None = None
    clade_l4: str | None = None
    clade_l5: str | None = None
    clade_l6: str | None = None


class ParseSummary(BaseModel):
    session_id: str
    filename: str
    total_sequences: int
    parse_time_seconds: float
    subtypes: dict[str, int]
    hosts: dict[str, int]
    segments: dict[str, int]
    date_range: list[str | None]
    locations: dict[str, int]


class FilterRule(BaseModel):
    field: str
    operator: Literal[
        "equals", "not_equals", "contains", "not_contains",
        "starts_with", "regex", "in_list", "date_range"
    ]
    value: str | list[str]


class FilterRequest(BaseModel):
    session_id: str
    rules: list[FilterRule]


class FilterResult(BaseModel):
    before_count: int
    after_count: int
    removed_count: int


class QualityFilterRequest(BaseModel):
    session_id: str
    min_length: int | None = None
    max_n_run: int | None = None
    deduplicate: bool = False
    dedup_mode: Literal["sequence", "seq+subtype"] = "sequence"


class SampleRequest(BaseModel):
    session_id: str
    category: Literal["Micro", "Seasonal", "Endemic"] | None = None


class SampleResult(BaseModel):
    before_count: int
    after_count: int
    lifespan_category: str
    reduction_pct: float


class FieldInfo(BaseModel):
    populated_pct: float
    n_unique: int
    sample_values: list[str]


class TimelinePoint(BaseModel):
    period: str
    count: int


class WavePeak(BaseModel):
    date: str
    count: int
    type: str
    rank: int | None = None


class TimelineResult(BaseModel):
    weekly_counts: list[TimelinePoint]
    peaks: list[WavePeak]
    troughs: list[WavePeak]
    off_season_clusters: list[WavePeak]
    wave_count: int
    lifespan_category: str


class SessionInfo(BaseModel):
    session_id: str
    filename: str
    total_sequences: int
    current_count: int
    subtypes: dict[str, int]
    hosts: dict[str, int]
