"""Export endpoints — CSV, JSON, PDF downloads"""
import io
import csv
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.storage.store import store

router = APIRouter(tags=["export"])


@router.get("/export/csv")
async def export_csv():
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["region", "metric"] + [f"w{i+1}" for i in range(12)])
    for row in store.heat:
        writer.writerow([row.region, row.metric] + row.vals)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=prism_metrics.csv"},
    )


@router.get("/export/json")
async def export_json():
    data = {
        "regions": [r.model_dump() for r in store.regions],
        "sources": [s.model_dump() for s in store.sources],
        "clades": [c.model_dump() for c in store.clades],
        "heat": [h.model_dump() for h in store.heat],
        "forecast": {k: v.model_dump() for k, v in store.forecast.items()},
        "mutations": [m.model_dump() for m in store.mutations],
        "inbox": [i.model_dump() for i in store.inbox],
        "drugCandidates": [d.model_dump() for d in store.drug_candidates],
    }
    content = json.dumps(data, indent=2)
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=prism_data.json"},
    )


@router.get("/export/report")
async def export_pdf():
    try:
        from fpdf import FPDF
    except ImportError:
        from fastapi import HTTPException
        raise HTTPException(500, "fpdf2 not installed")

    def safe(text: str) -> str:
        """Strip non-latin1 characters for Helvetica compatibility."""
        return text.encode("latin-1", errors="replace").decode("latin-1")

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, "P.R.I.S.M. SITUATION REPORT", ln=True, align="C")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 8, "CONFIDENTIAL · T3 · INTERNAL DISTRIBUTION", ln=True, align="C")
    pdf.ln(8)

    # At a glance
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "1. AT A GLANCE", ln=True)
    pdf.set_font("Helvetica", "", 10)
    for r in store.regions[:3]:
        pdf.cell(0, 6, safe(f"  {r.iso} - {r.name} - R(t)={r.rt:.2f} - Seeding={r.seeding:.1%} - {r.phen}"), ln=True)
    pdf.ln(4)

    # Metrics summary
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "2. METRICS HEATMAP SUMMARY", ln=True)
    pdf.set_font("Helvetica", "", 9)
    for row in store.heat[:7]:
        avg = sum(row.vals) / len(row.vals) if row.vals else 0
        pdf.cell(0, 5, safe(f"  {row.region} - {row.metric} - avg={avg:.2f} - latest={row.vals[-1]:.2f}"), ln=True)
    pdf.ln(4)

    # Forecast
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "3. FORECAST", ln=True)
    pdf.set_font("Helvetica", "", 10)
    f = store.forecast.get("global")
    if f:
        pdf.cell(0, 6, f"  26-week horizon · Current R(t) median = {f.median[f.now]:.2f}", ln=True)
        pdf.cell(0, 6, f"  95% CI: [{f.p95[f.now][0]:.2f}, {f.p95[f.now][1]:.2f}]", ln=True)
    pdf.ln(4)

    # Anomalies
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "4. ACTIVE ANOMALIES", ln=True)
    pdf.set_font("Helvetica", "", 10)
    for item in store.inbox:
        if item.status != "dismissed":
            pdf.cell(0, 6, safe(f"  [{item.tier}] {item.title} - score {item.score:.0%}"), ln=True)

    pdf.ln(8)
    pdf.set_font("Helvetica", "I", 8)
    pdf.cell(0, 5, "PRISM · EpiSplat v3.1 · Generated automatically", ln=True, align="C")

    buf = pdf.output()
    return StreamingResponse(
        io.BytesIO(buf),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=prism_sitrep.pdf"},
    )
