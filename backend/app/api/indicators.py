from fastapi import APIRouter

from app.core.data import get_cursor
from app.engines.kpi_engine import MENAGES_PCT_CATEGORIES, RATE_BASE

router = APIRouter(prefix="/api/indicators", tags=["indicators"])


@router.get("")
def list_indicators(group: str | None = None):
    con = get_cursor()
    if group:
        rows = con.execute(
            'SELECT DISTINCT "group", category, sexe_scope FROM indicators WHERE "group" = ? ORDER BY category', [group]
        ).fetchall()
    else:
        rows = con.execute('SELECT DISTINCT "group", category, sexe_scope FROM indicators ORDER BY "group", category').fetchall()

    catalog = {}
    for grp, category, sexe in rows:
        key = (grp, category)
        entry = catalog.setdefault(key, {"group": grp, "category": category, "sexe_scopes": set(),
                                          "is_rate": category in RATE_BASE or category in MENAGES_PCT_CATEGORIES})
        entry["sexe_scopes"].add(sexe)

    return [
        {**v, "sexe_scopes": sorted(v["sexe_scopes"])} for v in catalog.values()
    ]


@router.get("/breakdown")
def breakdown(category: str, group: str = "population"):
    """Sublabels available for a breakdown category, e.g. 'Type de logement (%)' -> [Villa, Appartement, ...]."""
    con = get_cursor()
    rows = con.execute(
        'SELECT DISTINCT sublabel FROM indicators WHERE "group" = ? AND category = ? AND sublabel != \'\' ORDER BY sublabel',
        [group, category],
    ).fetchall()
    return [r[0] for r in rows]
