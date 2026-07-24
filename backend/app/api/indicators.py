from fastapi import APIRouter

from app.core.data import get_cursor
from app.engines.kpi_engine import RATE_BASE

router = APIRouter(prefix="/api/indicators", tags=["indicators"])


@router.get("")
def list_indicators(group: str | None = None):
    """Full catalog of every category found in the source workbook, classified so the
    frontend can build its indicator pickers without hardcoding a curated subset:

    - is_rate: a published percentage with a *single scalar* known base (Taux de
      chômage (%), ...) — compute_rate() can turn it into one exact headcount.
      Ménages composition categories (Type de logement (%), ...) are deliberately
      excluded here even though they also resolve to a base: they only exist as a
      set of sublabels, so they're breakdown-only, not a standalone rate.
    - has_standalone: at least one row for this category carries no sublabel, i.e. it's
      a single value on its own (Population légale, Ménages, Population active...) and
      can be used directly as a count KPI via compute_count().
    - Categories that are is_rate=False and has_standalone=False only exist as a set of
      sublabels (Type de logement (%), État matrimonial..., Statut professionnel...) —
      meaningful as a breakdown/composition (treemap), not as a single number.
    """
    con = get_cursor()
    if group:
        rows = con.execute(
            'SELECT "group", category, sexe_scope, sublabel FROM indicators WHERE "group" = ?', [group]
        ).fetchall()
    else:
        rows = con.execute('SELECT "group", category, sexe_scope, sublabel FROM indicators').fetchall()

    catalog = {}
    for grp, category, sexe, sublabel in rows:
        key = (grp, category)
        entry = catalog.setdefault(
            key,
            {
                "group": grp,
                "category": category,
                "sexe_scopes": set(),
                "is_rate": category in RATE_BASE,
                "has_standalone": False,
            },
        )
        entry["sexe_scopes"].add(sexe)
        if sublabel == "":
            entry["has_standalone"] = True

    return sorted(
        ({**v, "sexe_scopes": sorted(v["sexe_scopes"])} for v in catalog.values()),
        key=lambda v: (v["group"], v["category"]),
    )


@router.get("/breakdown")
def breakdown(category: str, group: str = "population"):
    """Sublabels available for a breakdown category, e.g. 'Type de logement (%)' -> [Villa, Appartement, ...]."""
    con = get_cursor()
    rows = con.execute(
        'SELECT DISTINCT sublabel FROM indicators WHERE "group" = ? AND category = ? AND sublabel != \'\' ORDER BY sublabel',
        [group, category],
    ).fetchall()
    return [r[0] for r in rows]
