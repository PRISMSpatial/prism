"""Report generator — compiles structured intelligence briefs from live store data."""
import uuid
from datetime import datetime, timezone

from app.storage.store import store
from app.forecast.session_store import forecast_store
from app.virsift.session_store import virsift_store
from app.report.models import (
    ReportData, MetricBlock, EvidenceRow, ForecastBlock,
    AnomalyRow, PhyloBlock, VirsiftBlock, ActionItem,
)

TIER_LABELS = {"T3": "Critical", "T2": "Elevated", "T1": "Watch", "T0": "Baseline"}
STATE_LABELS = {"GROWING": "accelerating", "DECLINING": "decelerating", "UNCERTAIN": "indeterminate trajectory"}


def generate_report(
    region_id: str,
    forecast_session_id: str | None = None,
    virsift_session_id: str | None = None,
    report_type: str = "sitrep",
) -> ReportData:
    region = next((r for r in store.regions if r.id == region_id), None)
    if not region:
        raise ValueError(f"Region {region_id} not found")

    now = datetime.now(timezone.utc)
    report_id = f"RPT-{now.strftime('%Y')}-{uuid.uuid4().hex[:6].upper()}"

    pathogen_name = f"{store.pathogen.name}" if store.pathogen else "Unknown pathogen"
    clade_obj = next((c for c in store.clades if c.id == region.clade), None)

    tier_label = TIER_LABELS.get(region.tier, region.tier)
    state_label = STATE_LABELS.get(region.state, region.state)

    subtitle = (
        f"Seeding score {region.seeding * 100:.1f}%. "
        f"R(t) {region.rt:.2f} [{region.rtLo:.2f}, {region.rtHi:.2f}]. "
        f"Transmission {state_label}. "
        f"Concordance {region.concord:.2f}."
    )

    pullquote = _build_pullquote(region, clade_obj, pathogen_name)
    metrics = _build_metrics(region)
    evidence = _build_evidence(region)
    forecast_block = _build_forecast(region, forecast_session_id)
    anomalies = _build_anomalies(region)
    phylo = _build_phylo(region, clade_obj)
    virsift_block = _build_virsift(virsift_session_id)
    actions = _build_actions(region, clade_obj, forecast_block)

    return ReportData(
        report_id=report_id,
        report_type=report_type,
        generated_at=now.isoformat(),
        region_id=region.id,
        region_name=region.name,
        country=region.country,
        iso=region.iso,
        tier=region.tier,
        clade=region.clade,
        pathogen=pathogen_name,
        subtitle=subtitle,
        pullquote=pullquote,
        metrics=metrics,
        evidence=evidence,
        forecast=forecast_block,
        anomalies=anomalies,
        phylo=phylo,
        virsift=virsift_block,
        actions=actions,
        confidence=region.concord,
    )


def _build_pullquote(region, clade_obj, pathogen_name: str) -> str:
    fitness_note = ""
    if clade_obj and clade_obj.fitness > 0.1:
        fitness_note = f", driven by a {clade_obj.fitness:.2f} fitness gain in {clade_obj.id}"
    ww_note = ""
    if region.concordanceLayers.wastewater > 0.6:
        ww_note = " and wastewater signal leading clinical incidence"

    if region.rt > 1.1:
        return (
            f"{region.name} crosses the Observe → Investigate threshold "
            f"with R(t) at {region.rt:.2f}{fitness_note}{ww_note}. "
            f"Multi-stream concordance stands at {region.concord:.2f}, "
            f"indicating {'high' if region.concord > 0.8 else 'moderate'} confidence."
        )
    elif region.rt > 0.95:
        return (
            f"Transmission in {region.name} remains near the epidemic threshold "
            f"with R(t) at {region.rt:.2f}. Trajectory is uncertain. "
            f"Continued monitoring recommended."
        )
    else:
        return (
            f"{region.name} shows declining transmission with R(t) at {region.rt:.2f}. "
            f"Current signals consistent with seasonal retreat."
        )


def _build_metrics(region) -> list[MetricBlock]:
    return [
        MetricBlock(label="Seeding", value=f"{region.seeding * 100:.1f}", unit="%"),
        MetricBlock(label="R(t)", value=f"{region.rt:.2f}"),
        MetricBlock(label="R(t) CI", value=f"[{region.rtLo:.2f}, {region.rtHi:.2f}]"),
        MetricBlock(label="Concordance", value=f"{region.concord:.2f}"),
        MetricBlock(label="Phenotype", value=region.phen),
        MetricBlock(label="Tier", value=f"{region.tier} · {TIER_LABELS.get(region.tier, '')}"),
        MetricBlock(label="State", value=region.state),
    ]


def _build_evidence(region) -> list[EvidenceRow]:
    rows = []

    clinical = region.concordanceLayers.clinical
    rows.append(EvidenceRow(
        source="Clinical · FluNet",
        kind="clinical",
        body=(
            f"Clinical concordance layer at {clinical:.2f}. "
            f"Transmission state: {region.state}. "
            f"Region phenotype classified as {region.phen}."
        ),
    ))

    genomic = region.concordanceLayers.genomic
    clade_obj = next((c for c in store.clades if c.id == region.clade), None)
    n_seqs = clade_obj.n if clade_obj else 0
    mut_strs = [f"{m.wt}{m.site}{m.mut}" for m in store.mutations[:4]] if store.mutations else []
    rows.append(EvidenceRow(
        source="Genomic · GISAID",
        kind="genomic",
        body=(
            f"{n_seqs} sequences within clade {region.clade}. "
            f"Genomic concordance layer at {genomic:.2f}. "
            + (f"Key HA mutations: {', '.join(mut_strs)}." if mut_strs else "")
        ),
    ))

    ww = region.concordanceLayers.wastewater
    if ww > 0:
        rows.append(EvidenceRow(
            source="Wastewater · Biobot",
            kind="wastewater",
            body=f"Wastewater concordance layer at {ww:.2f}. Signal {'elevated' if ww > 0.6 else 'within baseline range'}.",
        ))

    src = next((s for s in store.sources if s.kind == "mobility"), None)
    if src:
        rows.append(EvidenceRow(
            source=f"Mobility · {src.name}",
            kind="mobility",
            body=f"Seeding score at {region.seeding * 100:.1f}%, indicating {'high' if region.seeding > 0.7 else 'moderate' if region.seeding > 0.3 else 'low'} importation risk.",
        ))

    avian_src = next((s for s in store.sources if s.kind == "avian"), None)
    if avian_src:
        rows.append(EvidenceRow(
            source=f"Avian · {avian_src.name}",
            kind="avian",
            body=f"Avian surveillance data status: {avian_src.status}. Last update: {avian_src.last}.",
        ))

    return rows


def _build_forecast(region, forecast_session_id: str | None) -> ForecastBlock:
    fc_session = forecast_store.get(forecast_session_id) if forecast_session_id else None

    if fc_session:
        result = fc_session.result
        params = result.get("params", {})
        baseline = result.get("scenarios", {}).get("baseline", {})
        surge = result.get("scenarios", {}).get("surge", {})
        intervention = result.get("scenarios", {}).get("intervention", {})

        fc_data = baseline.get("forecast", {})
        now_idx = fc_data.get("now", 0)
        median = fc_data.get("median", [])
        p95 = fc_data.get("p95", [])

        crossover = None
        for i in range(now_idx, len(median)):
            if median[i] < 1.0:
                crossover = f"W+{i - now_idx}"
                break

        return ForecastBlock(
            horizon_weeks=result.get("horizon", 13),
            current_rt_median=median[now_idx] if now_idx < len(median) else region.rt,
            current_rt_ci=[p95[now_idx][0], p95[now_idx][1]] if now_idx < len(p95) else [region.rtLo, region.rtHi],
            peak_week=f"W+{baseline.get('peak_week', 0)}",
            peak_incidence_baseline=baseline.get("peak_incidence", 0),
            peak_incidence_surge=surge.get("peak_incidence", 0),
            peak_incidence_intervention=intervention.get("peak_incidence", 0),
            crossover_week=crossover,
            has_seir=True,
            seir_r0=params.get("R0"),
            seir_beta=params.get("beta"),
            seir_sigma=params.get("sigma"),
            seir_gamma=params.get("gamma"),
            rt_median=median,
            rt_p50=fc_data.get("p50"),
            rt_p80=fc_data.get("p80"),
            rt_p95=p95,
            rt_now=now_idx,
        )

    fc = store.forecast.get(region.id) or store.forecast.get("global")
    if fc:
        median = fc.median
        now_idx = fc.now
        crossover = None
        for i in range(now_idx, len(median)):
            if median[i] < 1.0:
                crossover = f"W+{i - now_idx}"
                break

        return ForecastBlock(
            horizon_weeks=fc.weeks - now_idx,
            current_rt_median=median[now_idx] if now_idx < len(median) else region.rt,
            current_rt_ci=[fc.p95[now_idx][0], fc.p95[now_idx][1]] if now_idx < len(fc.p95) else [region.rtLo, region.rtHi],
            peak_week="—",
            peak_incidence_baseline=max(median[now_idx:]) if now_idx < len(median) else 0,
            peak_incidence_surge=0,
            peak_incidence_intervention=0,
            crossover_week=crossover,
            rt_median=median,
            rt_p50=[list(p) for p in fc.p50],
            rt_p80=[list(p) for p in fc.p80],
            rt_p95=[list(p) for p in fc.p95],
            rt_now=now_idx,
        )

    return ForecastBlock(
        horizon_weeks=13,
        current_rt_median=region.rt,
        current_rt_ci=[region.rtLo, region.rtHi],
        peak_week="—",
        peak_incidence_baseline=0,
        peak_incidence_surge=0,
        peak_incidence_intervention=0,
    )


def _build_anomalies(region) -> list[AnomalyRow]:
    related = [i for i in store.inbox if i.region == region.id or i.region == region.name]
    if not related:
        related = [i for i in store.inbox if i.status != "dismissed"][:3]
    return [
        AnomalyRow(id=a.id, tier=a.tier, title=a.title, score=a.score, status=a.status)
        for a in related
    ]


def _build_phylo(region, clade_obj) -> PhyloBlock | None:
    if not clade_obj:
        return None
    mut_strs = [f"{m.wt}{m.site}{m.mut}" for m in store.mutations if m.impact == "high"][:6]
    return PhyloBlock(
        clade=clade_obj.id,
        fitness=clade_obj.fitness,
        n_sequences=clade_obj.n,
        origin=clade_obj.origin,
        mutations=mut_strs,
    )


def _build_virsift(virsift_session_id: str | None) -> VirsiftBlock | None:
    if not virsift_session_id:
        return None
    session = virsift_store.get(virsift_session_id)
    if not session:
        return None
    df = session.working_df
    date_col = "collection_date" if "collection_date" in df.columns else None
    date_range = [None, None]
    if date_col:
        dates = df[date_col].dropna()
        if len(dates):
            date_range = [str(dates.min()), str(dates.max())]

    subtypes = df["subtype_clean"].value_counts().head(5).to_dict() if "subtype_clean" in df.columns else {}
    segments = df["segment"].value_counts().head(5).to_dict() if "segment" in df.columns else {}

    return VirsiftBlock(
        filename=session.filename,
        sequences_active=len(df),
        subtypes=subtypes,
        segments=segments,
        date_range=date_range,
        header_variant=session.header_variant,
    )


def _build_actions(region, clade_obj, forecast_block: ForecastBlock | None) -> list[ActionItem]:
    actions = []

    if region.tier in ("T3", "T2"):
        actions.append(ActionItem(
            verb="Escalate",
            body=f"Escalate {region.name} anomaly to Investigate status in TRACE inbox.",
            priority="high",
        ))

    if clade_obj and clade_obj.n < 100:
        actions.append(ActionItem(
            verb="Request",
            body=f"Request additional sequences from {region.name} reference lab via GISAID priority queue ({clade_obj.n} currently available).",
            priority="high",
        ))

    mutations = [m for m in store.mutations if m.impact == "high"]
    if mutations:
        actions.append(ActionItem(
            verb="Schedule",
            body=f"Schedule antigenic characterization against current vaccine strain. {len(mutations)} high-impact HA mutations identified.",
            priority="normal",
        ))

    if region.seeding > 0.5:
        actions.append(ActionItem(
            verb="Notify",
            body="Notify WHO collaborating centres and relevant regional networks.",
            priority="normal",
        ))

    if region.concordanceLayers.wastewater > 0.5:
        actions.append(ActionItem(
            verb="Monitor",
            body=f"Monitor wastewater signal concordance in adjacent regions over next 7 days (current: {region.concordanceLayers.wastewater:.2f}).",
            priority="normal",
        ))

    if forecast_block and forecast_block.has_seir:
        actions.append(ActionItem(
            verb="Review",
            body=f"Review SEIR forecast scenario outputs. Baseline peak at {forecast_block.peak_week}, surge scenario peak incidence: {forecast_block.peak_incidence_surge:.0f}.",
            priority="normal",
        ))

    if not actions:
        actions.append(ActionItem(
            verb="Monitor",
            body=f"Continue monitoring {region.name} at current cadence. No escalation required.",
            priority="low",
        ))

    return actions
