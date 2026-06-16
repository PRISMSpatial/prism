"""FORECAST REST API — SEIR model fitting and ensemble projection."""

import uuid

from fastapi import APIRouter, HTTPException

from app.forecast.seir import SEIRModel
from app.forecast.models import (
    ForecastRunRequest, ForecastFromVirsiftRequest, ForecastRunResult,
)
from app.forecast.session_store import forecast_store

router = APIRouter(prefix="/forecast", tags=["forecast"])


def _run_seir(observed: list[float], population: int, horizon: int, n_draws: int) -> dict:
    model = SEIRModel(population)
    try:
        result = model.run_full(observed, population, horizon, n_draws)
    except ValueError as e:
        raise HTTPException(422, f"Model fitting failed: {e}")
    except Exception as e:
        raise HTTPException(500, f"Unexpected model error: {e}")
    session_id = str(uuid.uuid4())[:12]
    result["session_id"] = session_id
    forecast_store.create(session_id, result)
    return result


@router.post("/run", response_model=ForecastRunResult)
async def run_forecast(req: ForecastRunRequest):
    return _run_seir(req.observed_weekly, req.population, req.horizon_weeks, req.n_draws)


@router.post("/from-virsift/{virsift_session_id}", response_model=ForecastRunResult)
async def run_from_virsift(virsift_session_id: str, req: ForecastFromVirsiftRequest):
    from app.virsift.session_store import virsift_store
    from app.virsift.peak_detector import EpiWaveDetector

    session = virsift_store.get(virsift_session_id)
    if not session:
        raise HTTPException(404, f"VirSift session {virsift_session_id} not found")

    detector = EpiWaveDetector()
    wave_data = detector.detect_epi_waves(session.working_df, sensitivity=0.5)
    if wave_data["ts"].empty:
        raise HTTPException(422, "VirSift session has no temporal data for forecasting")

    weekly_counts = wave_data["ts"].values.tolist()
    if len(weekly_counts) < 4:
        raise HTTPException(422, f"Need at least 4 weeks of data, got {len(weekly_counts)}")

    return _run_seir(weekly_counts, req.population, req.horizon_weeks, req.n_draws)


@router.get("/session/{session_id}", response_model=ForecastRunResult)
async def get_forecast_session(session_id: str):
    s = forecast_store.get(session_id)
    if not s:
        raise HTTPException(404, f"Forecast session {session_id} not found")
    return s.result
