"""VirSift REST API — sequence curation endpoints."""

import re
import uuid

import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import PlainTextResponse

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_DECOMPRESSED_BYTES = 200 * 1024 * 1024  # 200 MB

from app.virsift.parser import parse_gisaid_fasta, decompress_if_needed, convert_df_to_fasta
from app.virsift.filters import VectorizedFilterEngine
from app.virsift.sampler import AdaptiveBiologicalSampler
from app.virsift.peak_detector import EpiWaveDetector
from app.virsift.session_store import virsift_store
from app.virsift.models import (
    ParseSummary, FilterRequest, FilterResult,
    QualityFilterRequest, SampleRequest, SampleResult,
    FieldInfo, TimelineResult, TimelinePoint, WavePeak, SessionInfo,
    ValidationResult, FieldCoverage, HeaderIssue,
    WorkspaceFile, MergeRequest, FetchUrlRequest, DatasetSummary,
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


def _detect_header_variant(df: pd.DataFrame) -> tuple[str, float]:
    if df.empty:
        return "Unknown", 0.0
    sample = df.head(20)
    has_segment = "segment" in df.columns and df["segment"].notna().mean() > 0.5
    has_clade = "clade" in df.columns and (df["clade"] != "Unknown").mean() > 0.3
    has_host = "host" in df.columns and (df["host"] != "Unknown").mean() > 0.5
    n_fields = sum([
        "isolate" in df.columns, "accession" in df.columns,
        "subtype" in df.columns, has_segment, has_clade, has_host,
    ])
    if n_fields >= 6:
        if has_clade and has_host:
            return "GISAID 6-Field", min(0.99, 0.85 + 0.02 * n_fields)
        return "GISAID 6-Field (Avian)", min(0.99, 0.80 + 0.02 * n_fields)
    if n_fields >= 4:
        return "GISAID 5-Field", min(0.99, 0.75 + 0.03 * n_fields)
    if n_fields >= 2:
        return "hRSV 3-Field", min(0.99, 0.70 + 0.03 * n_fields)
    return "Unknown", 0.5


def _detect_source(filename: str, variant: str) -> str:
    fn = filename.lower()
    if "rsv" in fn or "hrsv" in fn:
        return "GISAID RSV"
    if "ncbi" in fn or "genbank" in fn:
        return "NCBI"
    if "avian" in fn or "bird" in fn or "waterfowl" in fn:
        return "GISAID EpiFlu"
    if "epiflu" in fn or "gisaid" in fn:
        return "GISAID EpiFlu"
    if "sars" in fn or "cov" in fn:
        return "GISAID EpiCoV"
    return "GISAID EpiFlu"


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
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"File too large. Maximum upload size is {MAX_UPLOAD_BYTES // (1024*1024)} MB")
    filename = file.filename or "unknown.fa"

    try:
        file_content = decompress_if_needed(raw_bytes, filename, MAX_DECOMPRESSED_BYTES)
    except ValueError as e:
        raise HTTPException(413, str(e))
    sequences, parse_time = parse_gisaid_fasta(file_content, filename)

    if not sequences:
        raise HTTPException(400, "No valid FASTA sequences found in file")

    df = pd.DataFrame(sequences)
    session_id = str(uuid.uuid4())[:12]
    variant, confidence = _detect_header_variant(df)
    source = _detect_source(filename, variant)
    virsift_store.create(session_id, filename, df,
                         header_variant=variant, confidence=confidence,
                         parse_time=parse_time, source=source)

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
    if offset < 0:
        offset = 0
    if limit < 1 or limit > 500:
        limit = min(max(limit, 1), 500)
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
    safe_name = re.sub(r'[^\w.\-]', '_', s.filename)
    filename = f"curated_{safe_name}"
    return PlainTextResponse(
        content=fasta_str,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─── Workspace endpoints ──────────────────────────────────────────────────────

@router.get("/workspace", response_model=list[WorkspaceFile])
async def list_workspace():
    virsift_store._evict_expired()
    files = []
    for s in virsift_store.sessions.values():
        df = s.original_df
        subtypes = df["subtype_clean"].nunique() if "subtype_clean" in df.columns else 0
        segments = df["segment"].nunique() if "segment" in df.columns else 0
        dates = pd.to_datetime(df.get("collection_date"), errors="coerce").dropna()
        date_range = [
            _date_to_str(dates.min()) if not dates.empty else None,
            _date_to_str(dates.max()) if not dates.empty else None,
        ]
        warnings = 0
        if "collection_date" in df.columns:
            warnings += int(df["collection_date"].isna().sum())
        if "host" in df.columns:
            warnings += int((df["host"] == "Unknown").sum() > df.shape[0] * 0.1)
        if "segment" in df.columns:
            warnings += int((df["segment"] == "Unknown").sum())

        files.append(WorkspaceFile(
            session_id=s.session_id,
            filename=s.filename,
            source=s.source,
            sequences=s.original_count,
            subtypes=subtypes,
            segments=segments,
            date_range=date_range,
            parse_time=round(s.parse_time, 2),
            status=s.status,
            warnings=min(warnings, 99),
            header_variant=s.header_variant,
            confidence=round(s.confidence * 100),
        ))
    return files


@router.get("/sessions/{session_id}/validation", response_model=ValidationResult)
async def get_validation(session_id: str):
    s = _get_session(session_id)
    df = s.original_df

    coverage = []
    field_notes = {
        "subtype_clean": "Derived", "host_species": "Derived",
        "sequence_length": "Computed", "sequence_hash": "Computed",
        "collection_date": "Some partial", "host": "Often Inferred",
        "clade": "GISAID only",
    }
    for col in df.columns:
        if col in ("sequence",):
            continue
        non_null = df[col].replace({"Unknown": None, "": None}).dropna()
        pct = round(100 * len(non_null) / len(df), 1) if len(df) > 0 else 0
        missing = len(df) - len(non_null)
        example = str(non_null.iloc[0]) if len(non_null) > 0 else None
        coverage.append(FieldCoverage(
            field=col, coverage_pct=pct, missing=missing,
            example=example, notes=field_notes.get(col),
        ))

    issues = []
    if "collection_date" in df.columns:
        null_dates = df[df["collection_date"].isna()]
        for idx in null_dates.index[:5]:
            issues.append(HeaderIssue(
                line=int(idx) + 1,
                original_header=str(df.at[idx, "isolate"]) if "isolate" in df.columns else "—",
                issue="Partial date (YYYY only)",
                suggested_fix="Use YYYY-MM-DD for full date precision",
            ))
    if "segment" in df.columns:
        unknown_seg = df[df["segment"] == "Unknown"]
        for idx in unknown_seg.index[:3]:
            issues.append(HeaderIssue(
                line=int(idx) + 1,
                original_header=str(df.at[idx, "isolate"]) if "isolate" in df.columns else "—",
                issue="Missing segment field",
                suggested_fix="Add segment (e.g. HA) as field[2]",
            ))
    if "host" in df.columns:
        unknown_host = df[df["host"] == "Unknown"]
        for idx in unknown_host.index[:3]:
            issues.append(HeaderIssue(
                line=int(idx) + 1,
                original_header=str(df.at[idx, "isolate"]) if "isolate" in df.columns else "—",
                issue="Non-standard host name",
                suggested_fix="Host 'Unknown' not in reference list — will fall back to Human",
            ))

    return ValidationResult(
        session_id=session_id,
        header_variant=s.header_variant,
        confidence=round(s.confidence * 100),
        field_coverage=coverage,
        header_issues=issues[:20],
        warnings_count=len(issues),
    )


@router.get("/sessions/{session_id}/summary", response_model=DatasetSummary)
async def get_dataset_summary(session_id: str):
    s = _get_session(session_id)
    df = s.working_df
    avg_len = float(df["sequence_length"].mean()) if "sequence_length" in df.columns else 0
    dates = pd.to_datetime(df.get("collection_date"), errors="coerce").dropna()

    return DatasetSummary(
        session_id=session_id,
        sequences_active=len(df),
        avg_length=round(avg_len, 0),
        earliest=_date_to_str(dates.min()) if not dates.empty else None,
        latest=_date_to_str(dates.max()) if not dates.empty else None,
        source_file=s.filename,
        header_variant=s.header_variant,
        confidence=round(s.confidence * 100),
        subtypes=df["subtype_clean"].value_counts().head(10).to_dict() if "subtype_clean" in df.columns else {},
        segments=df["segment"].value_counts().head(10).to_dict() if "segment" in df.columns else {},
        locations=df["location"].value_counts().head(10).to_dict() if "location" in df.columns else {},
        hosts=df["host"].value_counts().head(10).to_dict() if "host" in df.columns else {},
    )


@router.post("/merge")
async def merge_sessions(req: MergeRequest):
    if len(req.session_ids) < 2:
        raise HTTPException(400, "Need at least 2 sessions to merge")
    dfs = []
    filenames = []
    for sid in req.session_ids:
        s = _get_session(sid)
        dfs.append(s.original_df)
        filenames.append(s.filename)

    merged_df = pd.concat(dfs, ignore_index=True)
    merged_id = str(uuid.uuid4())[:12]
    merged_name = f"merged_{len(filenames)}_files.fasta"
    variant, confidence = _detect_header_variant(merged_df)
    virsift_store.create(merged_id, merged_name, merged_df,
                         header_variant=variant, confidence=confidence,
                         parse_time=0, source="Merged")

    return {
        "session_id": merged_id,
        "filename": merged_name,
        "total_sequences": len(merged_df),
        "source_files": filenames,
    }


@router.post("/fetch-url")
async def fetch_from_url(req: FetchUrlRequest):
    import httpx

    url = req.url.strip()
    if not url.startswith(("http://", "https://", "ftp://")):
        raise HTTPException(400, "URL must start with http://, https://, or ftp://")

    try:
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            resp = await client.head(url)
            content_length = int(resp.headers.get("content-length", 0))
            if content_length > MAX_UPLOAD_BYTES:
                raise HTTPException(413, f"Remote file too large ({content_length} bytes)")

            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Failed to fetch URL: {e}")

    raw_bytes = resp.content
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"Downloaded file too large ({len(raw_bytes)} bytes)")

    filename = url.split("/")[-1].split("?")[0] or "remote.fasta"
    try:
        file_content = decompress_if_needed(raw_bytes, filename, MAX_DECOMPRESSED_BYTES)
    except ValueError as e:
        raise HTTPException(413, str(e))

    sequences, parse_time = parse_gisaid_fasta(file_content, filename)
    if not sequences:
        raise HTTPException(400, "No valid FASTA sequences found in remote file")

    df = pd.DataFrame(sequences)
    session_id = str(uuid.uuid4())[:12]
    variant, confidence = _detect_header_variant(df)
    source = _detect_source(filename, variant)
    virsift_store.create(session_id, filename, df,
                         header_variant=variant, confidence=confidence,
                         parse_time=parse_time, source=source)

    return _build_summary(session_id, filename, df, parse_time)
