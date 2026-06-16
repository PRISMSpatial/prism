"""Data serving endpoints — matches frontend React Query hooks in queries.ts"""
from fastapi import APIRouter, HTTPException
from app.storage.store import store
from app.auth.security import ProtectedUser
from app.models.domain import (
    Region, DataSource, HeatRow, ForecastData, IncidenceData, InboxItem,
    DrugCandidate, Metric, NotebookCell, Pathogen,
    PhylogenyResponse, MoleculeResponse,
)

router = APIRouter(tags=["data"])


@router.get("/regions", response_model=list[Region])
async def get_regions(_user: ProtectedUser):
    return store.regions


@router.get("/sources", response_model=list[DataSource])
async def get_sources(_user: ProtectedUser):
    return store.sources


@router.get("/heatmap", response_model=list[HeatRow])
async def get_heatmap(_user: ProtectedUser):
    return store.heat


@router.get("/forecast", response_model=ForecastData)
async def get_forecast_global(_user: ProtectedUser):
    return store.forecast.get("global", store.forecast.get(next(iter(store.forecast), ""), ForecastData(weeks=0, median=[], p50=[], p80=[], p95=[], now=0)))


@router.get("/forecast/{region_id}", response_model=ForecastData)
async def get_forecast(region_id: str, _user: ProtectedUser):
    return store.forecast.get(region_id, store.forecast.get("global", ForecastData(weeks=0, median=[], p50=[], p80=[], p95=[], now=0)))


@router.get("/phylogeny")
async def get_phylogeny(_user: ProtectedUser):
    return PhylogenyResponse(
        tree=store.tree,
        sankey=store.sankey,
        rootToTip=store.root_to_tip,
        clades=store.clades,
    ).model_dump(by_alias=True)


@router.get("/molecule")
async def get_molecule(_user: ProtectedUser):
    return MoleculeResponse(
        mutations=store.mutations,
        alignment=store.alignment,
    ).model_dump(by_alias=True)


@router.get("/pathogen")
async def get_pathogen(_user: ProtectedUser):
    if not store.pathogen:
        raise HTTPException(404, "No pathogen data loaded")
    return store.pathogen


@router.get("/metrics", response_model=list[Metric])
async def get_metrics(_user: ProtectedUser):
    return store.metrics


@router.get("/incidence", response_model=IncidenceData)
async def get_incidence(_user: ProtectedUser):
    if store.incidence:
        return store.incidence
    return IncidenceData(obs=[], fit=[])


@router.get("/notebook", response_model=list[NotebookCell])
async def get_notebook(_user: ProtectedUser):
    return store.notebook


@router.get("/inbox", response_model=list[InboxItem])
async def get_inbox(_user: ProtectedUser):
    return store.inbox


@router.get("/drugs", response_model=list[DrugCandidate])
async def get_drugs(_user: ProtectedUser):
    return store.drug_candidates
