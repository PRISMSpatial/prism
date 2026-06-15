"""VirSift REST API — sequence curation endpoints."""

import uuid

import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import PlainTextResponse

from app.virsift.parser import parse_gisaid_fasta, decompress_if_needed, convert_df_to_fasta
from app.virsift.filters import VectorizedFilterEngine
from app.virsift.sampler import AdaptiveBiologicalSampler
from app.virsift.peak_detector import EpiWaveDetector
from app.virsift.session_store import virsift_store
from app.virsift.models import (
    ParseSummary, FilterRequest, FilterResult,
    QualityFilterRequest, SampleRequest, SampleResult,
    FieldInfo, TimelineResult, TimelinePoint, WavePeak, SessionInfo,
)

router = APIRouter(prefix="/virsift", tags=["virsift"])

_filter_engine = VectorizedFilterEngine()
_sampler = AdaptiveBiologicalSampler()
_wave_detector = EpiWaveDetector()


def _get_session(session_id: str):
    session = virsift_store.get(session_id)
    if not session:
        raise HTTPException(404, f"Session {session_id} not found")
    return session


def _date_to_str(val) -> str | None:
    if val is None or pd.isna(val):
        return None
    try:
        return pd.Timestamp(val).strftime("%Y-%m-%d")
    except Exception:
        return str(val)


def _build_summary(session_id: str, filename: str, df: pd.DataFrame, parse_time: float) -> ParseSummary:
    subtypes = df["subtype_clean"].value_counts().head(20).to_dict()
    hosts = df["host"].value_counts().head(20).to_dict()
    segments = df["segment"].value_counts().head(10).to_dict()
    locations = df["location"].value_counts().head(30).to_dict()

    dates = pd.to_datetime(df["collection_date"], errors="coerce").dropna()
    date_range = [
        _date_to_str(dates.min()) if not dates.empty else None,
        _date_to_str(dates.max()) if not dates.empty else None,
    ]

    return ParseSummary(
        session_id=session_id,
        filename=filename,
        total_sequences=len(df),
        parse_time_seconds=round(parse_time, 3),
        subtypes=subtypes,
        hosts=hosts,
        segments=segments,
        date_range=date_range,
        locations=locations,
    )


@router.post("/parse", response_model=ParseSummary)
async def parse_fasta(file: UploadFile = File(...)):
    raw_bytes = await file.read()
    filename = file.filename or "unknown.fa"

    file_content = decompress_if_needed(raw_bytes, filename)
    sequences, parse_time = parse_gisaid_fasta(file_content, filename)

    if not sequences:
        raise HTTPException(400, "No valid FASTA sequences found in file")

    df = pd.DataFrame(sequences)
    session_id = str(uuid.uuid4())[:12]
    virsift_store.create(session_id, filename, df)

    return _build_summary(session_id, filename, df, parse_time)


@router.get("/sessions/{session_id}", response_model=SessionInfo)
async def get_session(session_id: str):
    s = _get_session(session_id)
    df = s.working_df
    subtypes = df["subtype_clean"].value_counts().head(20).to_dict() if "subtype_clean" in df.columns else {}
    hosts = df["host"].value_counts().head(20).to_dict() if "host" in df.columns else {}

    return SessionInfo(
        session_id=s.session_id,
        filename=s.filename,
        total_sequences=s.original_count,
        current_count=s.current_count,
        subtypes=subtypes,
        hosts=hosts,
    )


@router.get("/sessions/{session_id}/sequences")
async def get_sequences(session_id: str, offset: int = 0, limit: int = 100):
    s = _get_session(session_id)
    df = s.working_df
    page = df.iloc[offset:offset + limit]

    cols_to_drop = ["sequence"]
    drop = [c for c in cols_to_drop if c in page.columns]
    rows = page.drop(columns=drop).fillna("Unknown")

    if "collection_date" in rows.columns:
        rows["collection_date"] = rows["collection_date"].apply(_date_to_str)

    return {
        "total": len(df),
        "offset": offset,
        "limit": limit,
        "rows": rows.to_dict(orient="records"),
    }


@router.get("/sessions/{session_id}/fields", response_model=dict[str, FieldInfo])
async def get_available_fields(session_id: str):
    s = _get_session(session_id)
    raw = _filter_engine.auto_detect_available_fields(s.working_df)
    return {k: FieldInfo(**v) for k, v in raw.items()}


@router.post("/filter", response_model=FilterResult)
async def apply_filters(req: FilterRequest):
    s = _get_session(req.session_id)
    before = len(s.working_df)

    rules = [r.model_dump() for r in req.rules]
    s.working_df = _filter_engine.apply_header_component_filters(s.working_df, rules)

    after = len(s.working_df)
    return FilterResult(before_count=before, after_count=after, removed_count=before - after)


@router.post("/quality-filter", response_model=FilterResult)
async def apply_quality_filters(req: QualityFilterRequest):
    s = _get_session(req.session_id)
    before = len(s.working_df)

    if req.min_length is not None:
        s.working_df = _filter_engine.filter_min_length(s.working_df, req.min_length)
    if req.max_n_run is not None:
        s.working_df = _filter_engine.filter_max_n_run(s.working_df, req.max_n_run)
    if req.deduplicate:
        s.working_df = _filter_engine.deduplicate(s.working_df, req.dedup_mode)

    after = len(s.working_df)
    return FilterResult(before_count=before, after_count=after, removed_count=before - after)


@router.post("/sample", response_model=SampleResult)
async def apply_sampling(req: SampleRequest):
    s = _get_session(req.session_id)
    before = len(s.working_df)

    category = req.category or _sampler.calculate_lifespan_category(s.working_df)
    s.working_df = _sampler.apply_proportionality_rule(s.working_df, category)

    after = len(s.working_df)
    reduction = round(100 * (1 - after / before), 1) if before > 0 else 0.0

    return SampleResult(
        before_count=before,
        after_count=after,
        lifespan_category=category,
        reduction_pct=reduction,
    )


@router.get("/timeline/{session_id}", response_model=TimelineResult)
async def get_timeline(session_id: str, sensitivity: float = 0.5):
    s = _get_session(session_id)
    df = s.working_df

    category = _sampler.calculate_lifespan_category(df)
    wave_data = _wave_detector.detect_epi_waves(df, sensitivity=sensitivity)

    weekly = []
    if not wave_data["ts"].empty:
        for period, count in wave_data["ts"].items():
            weekly.append(TimelinePoint(period=str(period), count=int(count)))

    peaks = [WavePeak(date=p, count=c, type="Major Peak", rank=i + 1)
             for i, (p, c) in enumerate(sorted(wave_data["peaks"], key=lambda x: -x[1]))]
    troughs = [WavePeak(date=p, count=c, type="Wave Trough")
               for p, c in wave_data["troughs"]]

    off_season = _wave_detector._detect_off_season_clusters(df)
    clusters = [WavePeak(date=x["date"], count=x["count"], type="Off-Season Cluster")
                for x in off_season]

    return TimelineResult(
        weekly_counts=weekly,
        peaks=peaks,
        troughs=troughs,
        off_season_clusters=clusters,
        wave_count=wave_data["wave_count"],
        lifespan_category=category,
    )


@router.post("/reset/{session_id}")
async def reset_session(session_id: str):
    s = _get_session(session_id)
    s.reset()
    return {"session_id": session_id, "count": s.current_count, "status": "reset"}


@router.get("/export/{session_id}")
async def export_fasta(session_id: str):
    s = _get_session(session_id)
    fasta_str = convert_df_to_fasta(s.working_df)
    filename = f"curated_{s.filename}"
    return PlainTextResponse(
        content=fasta_str,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
