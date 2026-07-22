"""
Insights Engine — automated narrative observations ("storytelling des données").

Compares a rate KPI for a chosen geo unit against the national average and
against its sibling units (same level, same parent), and phrases the result
as a plain-language sentence, e.g.:
  "Le chômage féminin dans la région Souss-Massa (27.4%) est supérieur de
   1.5 point à la moyenne nationale (25.9%)."
"""
from __future__ import annotations

from app.core.data import get_cursor
from app.engines.kpi_engine import compute_rate


def compare_to_national(category: str, geo_code: str, milieu: str = "ensemble", sexe: str = "ensemble") -> dict:
    con = get_cursor()
    geo_row = con.execute("SELECT geo_name, geo_level, parent_code FROM geo WHERE geo_code = ?", [geo_code]).fetchone()
    if not geo_row:
        return {"insight": None}
    geo_name, geo_level, parent_code = geo_row

    local = compute_rate(category, [geo_code], milieu=milieu, sexe=sexe)
    national = compute_rate(category, ["NATIONAL"], milieu=milieu, sexe=sexe)
    if local.percentage is None or national.percentage is None:
        return {"insight": None}

    diff = round(local.percentage - national.percentage, 1)
    direction = "supérieur" if diff > 0 else ("inférieur" if diff < 0 else "égal")
    sexe_label = {"feminin": " féminin", "masculin": " masculin", "ensemble": ""}[sexe]

    sentence = (
        f"{category.replace(' (%)', '')}{sexe_label} dans {geo_name} ({local.percentage}%) est {direction} "
        f"{'de ' + str(abs(diff)) + ' point' + ('s' if abs(diff) >= 2 else '') + ' ' if diff != 0 else ''}"
        f"à la moyenne nationale ({national.percentage}%)."
    )

    siblings_insight = None
    if parent_code:
        siblings = con.execute(
            "SELECT geo_code, geo_name FROM geo WHERE parent_code = ? AND geo_code != ?", [parent_code, geo_code]
        ).fetchall()
        sibling_values = []
        for code, name in siblings:
            r = compute_rate(category, [code], milieu=milieu, sexe=sexe)
            if r.percentage is not None:
                sibling_values.append((name, r.percentage))
        if sibling_values:
            ranked = sorted(sibling_values + [(geo_name, local.percentage)], key=lambda x: -x[1])
            rank = [n for n, _ in ranked].index(geo_name) + 1
            siblings_insight = f"{geo_name} se classe {rank}{'er' if rank == 1 else 'e'} sur {len(ranked)} unités comparables pour cet indicateur."

    return {
        "insight": sentence,
        "ranking_insight": siblings_insight,
        "local_value": local.percentage,
        "national_value": national.percentage,
        "diff": diff,
    }
