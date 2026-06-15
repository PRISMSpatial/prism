"""Pipeline execution and status endpoints"""
import uuid
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.storage.store import store
from app.models.domain import PipelineStatus

router = APIRouter(tags=["pipeline"])

STAGES = ["virsift", "metrics", "antigenic", "phylogeny", "seir", "clustering", "episplat"]

_background_tasks: set[asyncio.Task] = set()


async def _run_pipeline(run_id: str, upload_id: str):
    """Background task: execute pipeline stages sequentially."""
    run = store.pipeline_runs[run_id]
    run.status = "running"
    try:
        for i, stage in enumerate(STAGES):
            run.current_stage = stage
            run.progress = (i + 1) / len(STAGES)
            store.pipeline_runs[run_id] = run
            await asyncio.sleep(1.5)
        run.status = "completed"
        run.progress = 1.0
        run.current_stage = None
        run.completed_at = datetime.now(timezone.utc).isoformat()
    except Exception as exc:
        run.status = "failed"
        run.error = str(exc)
    store.pipeline_runs[run_id] = run


@router.post("/pipeline/run", response_model=PipelineStatus)
async def run_pipeline(upload_id: str = "demo"):
    run_id = str(uuid.uuid4())[:12]
    run = PipelineStatus(
        run_id=run_id,
        status="pending",
        started_at=datetime.now(timezone.utc).isoformat(),
    )
    store.pipeline_runs[run_id] = run
    task = asyncio.create_task(_run_pipeline(run_id, upload_id))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return run


@router.get("/pipeline/status", response_model=list[PipelineStatus])
async def get_pipeline_status():
    return list(store.pipeline_runs.values())


@router.get("/pipeline/status/{run_id}", response_model=PipelineStatus)
async def get_pipeline_run(run_id: str):
    run = store.pipeline_runs.get(run_id)
    if not run:
        raise HTTPException(404, "Pipeline run not found")
    return run
