"""PRISM API — FastAPI application"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import data, upload, pipeline, export
from app.virsift.router import router as virsift_router
from app.forecast.router import router as forecast_router
from app.report.router import router as report_router
from app.auth.router import router as auth_router


_DEFAULT_SECRET = "prism-dev-secret-change-in-production"


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.DEMO_MODE and settings.JWT_SECRET == _DEFAULT_SECRET:
        raise RuntimeError(
            "PRISM_JWT_SECRET must be set to a unique value in production. "
            "Export PRISM_JWT_SECRET before starting the server."
        )
    if settings.DEMO_MODE:
        from app.demo.generator import seed_demo_data
        await seed_demo_data()
        print("✓ Demo data seeded")
    yield


app = FastAPI(
    title="P.R.I.S.M. API",
    description="Pathogen Reconnaissance & Intelligence for Spatial Multi-omics",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(data.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(pipeline.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(virsift_router, prefix="/api")
app.include_router(forecast_router, prefix="/api")
app.include_router(report_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "demo_mode": settings.DEMO_MODE}
