from fastapi import APIRouter

from app.engines import insights_engine

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get("")
def insights(category: str, geo_code: str, milieu: str = "ensemble", sexe: str = "ensemble"):
    return insights_engine.compare_to_national(category, geo_code, milieu=milieu, sexe=sexe)
