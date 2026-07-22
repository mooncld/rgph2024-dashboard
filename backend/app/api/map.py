from fastapi import APIRouter

from app.engines import map_engine

router = APIRouter(prefix="/api/map", tags=["map"])


@router.get("/choropleth")
def choropleth(
    category: str,
    level: str,
    parent_code: str | None = None,
    milieu: str = "ensemble",
    sexe: str = "ensemble",
    group: str = "population",
):
    return map_engine.choropleth_data(category, level, parent_code=parent_code, milieu=milieu, sexe=sexe, group=group)
