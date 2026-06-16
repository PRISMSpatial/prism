"""Report generation endpoints."""
import time
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.report.models import ReportRequest, ReportData
from app.report.generator import generate_report

router = APIRouter(prefix="/report", tags=["report"])

_report_cache: dict[str, tuple[ReportData, float]] = {}
CACHE_TTL = 3600


def _evict():
    now = time.time()
    expired = [k for k, (_, t) in _report_cache.items() if now - t > CACHE_TTL]
    for k in expired:
        del _report_cache[k]


@router.post("/generate", response_model=ReportData)
async def create_report(req: ReportRequest):
    try:
        report = generate_report(
            region_id=req.region_id,
            forecast_session_id=req.forecast_session_id,
            virsift_session_id=req.virsift_session_id,
            report_type=req.report_type,
        )
    except ValueError as e:
        raise HTTPException(404, str(e))

    _evict()
    _report_cache[report.report_id] = (report, time.time())
    return report


@router.get("/history", response_model=list[dict])
async def list_reports():
    _evict()
    return [
        {
            "report_id": r.report_id,
            "region_id": r.region_id,
            "region_name": r.region_name,
            "report_type": r.report_type,
            "generated_at": r.generated_at,
            "tier": r.tier,
        }
        for r, _ in sorted(_report_cache.values(), key=lambda x: x[1], reverse=True)
    ]


@router.get("/{report_id}", response_model=ReportData)
async def get_report(report_id: str):
    _evict()
    entry = _report_cache.get(report_id)
    if not entry:
        raise HTTPException(404, f"Report {report_id} not found or expired")
    return entry[0]


@router.get("/{report_id}/export/{fmt}")
async def export_report(report_id: str, fmt: str):
    _evict()
    entry = _report_cache.get(report_id)
    if not entry:
        raise HTTPException(404, f"Report {report_id} not found or expired")
    report = entry[0]
    safe_name = report.report_id.replace(" ", "_")

    if fmt == "json":
        return Response(
            content=report.model_dump_json(indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.json"'},
        )
    elif fmt == "csv":
        import csv
        import io
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["section", "key", "value"])
        w.writerow(["meta", "report_id", report.report_id])
        w.writerow(["meta", "region", report.region_name])
        w.writerow(["meta", "tier", report.tier])
        w.writerow(["meta", "generated_at", report.generated_at])
        for m in report.metrics:
            w.writerow(["metric", m.label, f"{m.value}{m.unit}"])
        for ev in report.evidence:
            w.writerow(["evidence", ev.source, ev.body])
        for a in report.actions:
            w.writerow(["action", a.verb, a.body])
        return Response(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.csv"'},
        )
    else:
        raise HTTPException(400, f"Unsupported format: {fmt}. Use 'json' or 'csv'.")
