"""Pydantic models for the FORECAST module."""

from pydantic import BaseModel, Field
from app.models.domain import ForecastData, IncidenceData


class ForecastRunRequest(BaseModel):
    observed_weekly: list[float] = Field(
        ..., min_length=4, max_length=104,
        description="Weekly case counts (raw, not per-100k)",
    )
    population: int = Field(default=1_000_000, ge=1_000, le=10_000_000_000)
    horizon_weeks: int = Field(default=13, ge=4, le=52)
    n_draws: int = Field(default=200, ge=50, le=2000)


class ForecastFromVirsiftRequest(BaseModel):
    population: int = Field(default=1_000_000, ge=1_000, le=10_000_000_000)
    horizon_weeks: int = Field(default=13, ge=4, le=52)
    n_draws: int = Field(default=200, ge=50, le=2000)


class SEIRParams(BaseModel):
    beta: float
    sigma: float
    gamma: float
    R0: float
    I0: float
    E0: float
    incubation_days: float
    infectious_days: float
    fit_loss: float


class ScenarioResult(BaseModel):
    forecast: ForecastData
    incidence: IncidenceData
    peak_incidence: float
    peak_week: int
    valid_draws: int


class ForecastRunResult(BaseModel):
    session_id: str
    params: SEIRParams
    n_observed: int
    horizon: int
    population: int
    scenarios: dict[str, ScenarioResult]
