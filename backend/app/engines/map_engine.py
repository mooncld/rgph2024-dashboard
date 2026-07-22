"""
Map Engine — feeds the SIG module (choropleth / bubble / heatmap layers).

Returns, for every geo unit at a given level (and optionally under a given
parent), the value of one indicator — ready to join against a GeoJSON
FeatureCollection client-side on `geo_code`.
"""
from __future__ import annotations

from app.core.data import get_cursor
from app.engines.kpi_engine import MENAGES_PCT_CATEGORIES, RATE_BASE, compute_count, compute_rate


def choropleth_data(
    category: str,
    level: str,
    parent_code: str | None = None,
    milieu: str = "ensemble",
    sexe: str = "ensemble",
    group: str = "population",
    sublabel: str | None = None,
) -> list[dict]:
    """One row per geo unit at `level` (optionally restricted to descendants
    of `parent_code`), each carrying the exact value + percentage for `category`.
    """
    con = get_cursor()
    if parent_code:
        rows = con.execute(
            """
            SELECT g.geo_code, g.geo_name, g.full_label
            FROM geo g
            JOIN geo_ancestors a ON a.geo_code = g.geo_code
            WHERE g.geo_level = ? AND a.ancestor_code = ?
            """,
            [level, parent_code],
        ).fetchall()
    else:
        rows = con.execute(
            "SELECT geo_code, geo_name, full_label FROM geo WHERE geo_level = ?", [level]
        ).fetchall()

    is_rate = category in RATE_BASE or category in MENAGES_PCT_CATEGORIES
    out = []
    for geo_code, geo_name, full_label in rows:
        try:
            if is_rate:
                result = compute_rate(category, [geo_code], milieu=milieu, sexe=sexe, group=group)
            else:
                result = compute_count(category, [geo_code], milieu=milieu, sexe=sexe, group=group, sublabel=sublabel)
        except ValueError:
            continue
        out.append(
            {
                "geo_code": geo_code,
                "geo_name": geo_name,
                "full_label": full_label,
                "value": result.percentage if is_rate else result.exact_value,
                "exact_value": result.exact_value,
                "percentage": result.percentage,
            }
        )
    return out
