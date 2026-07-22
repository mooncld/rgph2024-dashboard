from fastapi import APIRouter, HTTPException

from app.engines import filter_engine, kpi_engine
from app.models.schemas import UniversalExploreRequest

router = APIRouter(prefix="/api/kpi", tags=["kpi"])


@router.get("/executive")
def executive(geo_code: str = "NATIONAL"):
    try:
        return kpi_engine.get_executive_kpis(geo_code)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/explore")
def explore(req: UniversalExploreRequest):
    """The 'Explorateur universel': any combination of geography + démographie
    + socio-économie funnels through here into a single KPI computation."""
    f = filter_engine.build_filter(
        geo=req.geo,
        include_descendants=req.include_descendants,
        milieu=req.milieu,
        sexe=req.sexe,
        age_min=req.age_min,
        age_max=req.age_max,
    )
    if req.category is None:
        raise HTTPException(400, "category is required")

    try:
        if f.age_min is not None:
            result = kpi_engine.compute_age_band(f.age_min, f.age_max, f.geo_codes, milieu=f.milieu, sexe=f.sexe)
        elif req.is_rate:
            result = kpi_engine.compute_rate(req.category, f.geo_codes, milieu=f.milieu, sexe=f.sexe, group=req.group)
        else:
            result = kpi_engine.compute_count(req.category, f.geo_codes, milieu=f.milieu, sexe=f.sexe, group=req.group)
    except ValueError as e:
        raise HTTPException(400, str(e))

    return result.__dict__ if hasattr(result, "__dict__") else result


@router.get("/literacy")
def literacy(geo_code: str = "NATIONAL", milieu: str = "ensemble", sexe: str = "ensemble"):
    return kpi_engine.compute_literacy([geo_code], milieu=milieu, sexe=sexe)


@router.get("/age-pyramid")
def age_pyramid(geo_code: str = "NATIONAL", milieu: str = "ensemble"):
    return kpi_engine.age_pyramid(geo_code, milieu=milieu)


@router.get("/breakdown")
def breakdown(category: str, geo_code: str = "NATIONAL", milieu: str = "ensemble", sexe: str = "ensemble", group: str = "population"):
    return kpi_engine.category_breakdown(category, geo_code, milieu=milieu, sexe=sexe, group=group)
