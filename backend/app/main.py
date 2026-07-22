from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import export, geo, indicators, insights, kpi, map as map_api, search
from app.core.config import CORS_ORIGINS
from app.core.data import get_connection

app = FastAPI(title="RGPH 2024 Analytics API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def warm_up() -> None:
    get_connection()  # builds DuckDB views + ancestor closure once at boot


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(kpi.router)
app.include_router(geo.router)
app.include_router(search.router)
app.include_router(indicators.router)
app.include_router(map_api.router)
app.include_router(export.router)
app.include_router(insights.router)
