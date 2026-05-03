"""Data serving endpoints — matches frontend React Query hooks in queries.ts"""
from fastapi import APIRouter
from app.storage.store import store
from app.models.domain import (
    Region, DataSource, HeatRow, ForecastData, InboxItem, DrugCandidate,
    PhylogenyResponse, MoleculeResponse,
)

router = APIRouter(tags=["data"])


@router.get("/regions", response_model=list[Region])
async def get_regions():
    return store.regions


@router.get("/sources", response_model=list[DataSource])
async def get_sources():
    return store.sources


@router.get("/heatmap", response_model=list[HeatRow])
async def get_heatmap():
    return store.heat


@router.get("/forecast", response_model=ForecastData)
async def get_forecast_global():
    return store.forecast.get("global", store.forecast.get(next(iter(store.forecast), ""), ForecastData(weeks=0, median=[], p50=[], p80=[], p95=[], now=0)))


@router.get("/forecast/{region_id}", response_model=ForecastData)
async def get_forecast(region_id: str):
    return store.forecast.get(region_id, store.forecast.get("global", ForecastData(weeks=0, median=[], p50=[], p80=[], p95=[], now=0)))


@router.get("/phylogeny")
async def get_phylogeny():
    return PhylogenyResponse(
        tree=store.tree,
        sankey=store.sankey,
        rootToTip=store.root_to_tip,
        clades=store.clades,
    ).model_dump(by_alias=True)


@router.get("/molecule")
async def get_molecule():
    return MoleculeResponse(
        mutations=store.mutations,
        alignment=store.alignment,
    ).model_dump(by_alias=True)


@router.get("/inbox", response_model=list[InboxItem])
async def get_inbox():
    return store.inbox


@router.get("/drugs", response_model=list[DrugCandidate])
async def get_drugs():
    return store.drug_candidates
