"""
KPI Engine.

The source table already publishes, for every geographic unit, both a rate
(e.g. "Taux de chômage (%)") and the population base it was computed from
(e.g. "Population active de 15 ans et plus") as separate columns. RATE_BASE
records that pairing so every rate-type KPI can report an exact headcount,
not just a percentage — e.g. chômage 21.3% x population active 12.9M =
2 747 000 chômeurs, not just "21.3%".

Two aggregation paths:
  - a single geo_code reads HCP's own published row directly (this is the
    authoritative aggregate for that unit — never re-derived).
  - multiple geo_codes (an ad-hoc multi-select that doesn't correspond to
    one published row) sums the base counts and recomputes a
    population-weighted rate from them.
"""
from __future__ import annotations

from dataclasses import dataclass

import duckdb

from app.core.data import get_cursor

# rate category -> (base category, base sublabel) providing its denominator.
# Sexe scope and milieu always match between rate and base.
RATE_BASE: dict[str, tuple[str, str | None]] = {
    "Taux de chômage (%)": ("Population active de 15 ans et plus", None),
    "Taux d'activité des 15 ans et plus (%)": ("Population de 15 ans et plus", None),
    "Taux d'analphabétisme des 10 ans et plus (%)": ("Population de 10 ans et plus", None),
    "Taux d'analphabétisme des 15 ans et plus (%)": ("Population de 15 ans et plus", None),
    "Taux de scolarisation des 6-11 ans en 2023/2024 (%)": ("Population de 7-12 ans", None),
    "Taux de prévalence du handicap (%)": ("Population municipale", None),
}
# Ménages (%) indicators are all shares of the total number of ménages.
MENAGES_PCT_CATEGORIES = {
    "Type de logement (%)",
    "Statut d'occupation du logement (%)",
    "Âge du logement (%)",
    "Disponibilité des éléments essentiels de confort (%)",
    "Mode d’évacuation des eaux usées (%)",
    "Mode d’évacuation des déchets ménagers (%)",
    "Combustible de cuisson utilisé (%)",
}
MENAGES_BASE_CATEGORY = "Ménages"


def fmt(n: float) -> str:
    """1234567 -> '1 234 567' (space thousands separator, French convention)."""
    return f"{n:,.0f}".replace(",", " ")


@dataclass
class KpiResult:
    label: str
    geo_codes: list[str]
    milieu: str
    sexe: str
    percentage: float | None
    exact_value: float | None
    base_label: str | None
    base_value: float | None
    calculation_method: str
    is_estimated: bool = False


def _indicator_id(con: duckdb.DuckDBPyConnection, group: str, category: str, sublabel: str | None, sexe: str) -> str | None:
    row = con.execute(
        'SELECT indicator_id FROM indicators WHERE "group" = ? AND category = ? '
        "AND coalesce(sublabel,'') = coalesce(?, '') AND sexe_scope = ?",
        [group, category, sublabel, sexe],
    ).fetchone()
    return row[0] if row else None


def _values_for(con: duckdb.DuckDBPyConnection, indicator_id: str, geo_codes: list[str], milieu: str) -> list[tuple[str, float, bool]]:
    placeholders = ",".join("?" for _ in geo_codes)
    rows = con.execute(
        f"SELECT geo_code, value, estimated FROM facts "
        f"WHERE indicator_id = ? AND milieu = ? AND geo_code IN ({placeholders})",
        [indicator_id, milieu, *geo_codes],
    ).fetchall()
    return rows


def compute_count(
    category: str,
    geo_codes: list[str],
    milieu: str = "ensemble",
    sexe: str = "ensemble",
    group: str = "population",
    sublabel: str | None = None,
) -> KpiResult:
    """Sums an absolute-count indicator (e.g. Population légale, Ménages) across geo_codes."""
    con = get_cursor()
    indicator_id = _indicator_id(con, group, category, sublabel, sexe)
    if indicator_id is None:
        raise ValueError(f"Unknown count indicator: group={group} category={category!r} sublabel={sublabel!r} sexe={sexe}")
    rows = _values_for(con, indicator_id, geo_codes, milieu)
    total = sum(v for _, v, _ in rows)
    estimated = any(e for *_, e in rows)
    label = f"{category}" + (f" — {sublabel}" if sublabel else "")
    return KpiResult(
        label=label,
        geo_codes=geo_codes,
        milieu=milieu,
        sexe=sexe,
        percentage=None,
        exact_value=total,
        base_label=None,
        base_value=None,
        calculation_method=(
            f"Valeur publiée directement par le RGPH 2024 pour {geo_codes[0]}."
            if len(geo_codes) == 1
            else f"Somme des valeurs publiées pour {len(geo_codes)} unités géographiques sélectionnées."
        ),
        is_estimated=estimated,
    )


def compute_rate(
    category: str,
    geo_codes: list[str],
    milieu: str = "ensemble",
    sexe: str = "ensemble",
    group: str = "population",
) -> KpiResult:
    """Computes a rate KPI together with its exact headcount, using RATE_BASE / MENAGES_PCT.

    For a single geo_code the published percentage is used as-is and the
    exact count is derived (base x rate / 100). For multiple geo_codes the
    rate itself is recomputed as sum(base_i x rate_i) / sum(base_i) so the
    aggregate stays population-weighted rather than a naive average.
    """
    con = get_cursor()
    is_menages_pct = category in MENAGES_PCT_CATEGORIES
    if is_menages_pct:
        base_category, base_sublabel = MENAGES_BASE_CATEGORY, None
        group, sexe = "menages", "ensemble"
    elif category in RATE_BASE:
        base_category, base_sublabel = RATE_BASE[category]
    else:
        raise ValueError(f"No base indicator registered for rate category {category!r}")

    rate_id = _indicator_id(con, group, category, None, sexe)
    base_id = _indicator_id(con, group, base_category, base_sublabel, sexe)
    if rate_id is None or base_id is None:
        raise ValueError(f"Missing indicator mapping for rate category {category!r}")

    rate_rows = {g: (v, e) for g, v, e in _values_for(con, rate_id, geo_codes, milieu)}
    base_rows = {g: (v, e) for g, v, e in _values_for(con, base_id, geo_codes, milieu)}

    common_codes = [g for g in geo_codes if g in rate_rows and g in base_rows]
    if not common_codes:
        return KpiResult(
            label=category, geo_codes=geo_codes, milieu=milieu, sexe=sexe,
            percentage=None, exact_value=None, base_label=base_category,
            base_value=None, calculation_method="Donnée non disponible pour cette combinaison de filtres.",
        )

    total_base = sum(base_rows[g][0] for g in common_codes)
    weighted_exact = sum(base_rows[g][0] * rate_rows[g][0] / 100 for g in common_codes)
    estimated = any(rate_rows[g][1] or base_rows[g][1] for g in common_codes)

    if len(common_codes) == 1:
        percentage = rate_rows[common_codes[0]][0]
        method = (
            f"{category} publié par le RGPH 2024 = {percentage:.1f}%. "
            f"Effectif exact = {base_category} ({fmt(total_base)}) × {percentage:.1f}% = {fmt(weighted_exact)}."
        )
    else:
        percentage = (weighted_exact / total_base * 100) if total_base else None
        method = (
            f"Agrégation pondérée sur {len(common_codes)} unités : "
            f"Σ({base_category} × taux) / Σ({base_category}) = {percentage:.1f}%." if percentage is not None
            else "Base nulle pour cette sélection."
        )

    return KpiResult(
        label=category,
        geo_codes=common_codes,
        milieu=milieu,
        sexe=sexe,
        percentage=round(percentage, 1) if percentage is not None else None,
        exact_value=round(weighted_exact),
        base_label=base_category,
        base_value=total_base,
        calculation_method=method,
        is_estimated=estimated,
    )


AGE_BUCKETS = [
    (0, 4), (5, 9), (10, 14), (15, 19), (20, 24), (25, 29), (30, 34), (35, 39),
    (40, 44), (45, 49), (50, 54), (55, 59), (60, 64), (65, 69), (70, 74),
]  # "75 ans ou plus" handled separately (open-ended)


def compute_age_band(
    age_min: int,
    age_max: int | None,
    geo_codes: list[str],
    milieu: str = "ensemble",
    sexe: str = "ensemble",
) -> KpiResult:
    """Sums the quinquennal (%) buckets overlapping [age_min, age_max] and
    applies them to Population municipale to get an exact headcount. This
    is an approximation (rounded 5-year percentages summed), the only
    granularity the source table publishes below whole-population totals.
    """
    con = get_cursor()
    sublabels = []
    for lo, hi in AGE_BUCKETS:
        if lo <= (age_max if age_max is not None else lo) and hi >= age_min:
            sublabels.append(f"{lo}-{hi} ans")
    if age_max is None or age_max >= 75:
        sublabels.append("75 ans ou plus")

    pop = compute_count("Population municipale", geo_codes, milieu=milieu, sexe=sexe)
    total_pct = 0.0
    for sub in sublabels:
        ind_id = _indicator_id(con, "population", "Âge quinquennal (%)", sub, sexe)
        if ind_id is None:
            continue
        rows = _values_for(con, ind_id, geo_codes, milieu)
        if len(geo_codes) == 1 and rows:
            total_pct += rows[0][1]
        elif rows:
            # weighted by each geo unit's own population share
            for g, v, _ in rows:
                g_pop = compute_count("Population municipale", [g], milieu=milieu, sexe=sexe).exact_value
                total_pct += v * (g_pop / pop.exact_value) if pop.exact_value else 0

    exact = round(pop.exact_value * total_pct / 100) if pop.exact_value else None
    label_range = f"{age_min}-{age_max} ans" if age_max is not None else f"{age_min} ans ou plus"
    return KpiResult(
        label=f"Population {label_range}",
        geo_codes=geo_codes,
        milieu=milieu,
        sexe=sexe,
        percentage=round(total_pct, 1),
        exact_value=exact,
        base_label="Population municipale",
        base_value=pop.exact_value,
        calculation_method=(
            f"Somme des tranches quinquennales {', '.join(sublabels)} = {total_pct:.1f}% "
            f"× Population municipale ({fmt(pop.exact_value)}) = {fmt(exact)}."
        ) if exact is not None else "Non disponible",
    )


def age_pyramid(geo_code: str, milieu: str = "ensemble") -> list[dict]:
    """One row per quinquennal age band with exact Homme/Femme headcounts —
    feeds the age-pyramid chart. Same percentage x population-municipale
    derivation as compute_age_band, just for every bucket at once instead
    of a single summed range."""
    con = get_cursor()
    buckets = AGE_BUCKETS + [(75, None)]
    pop_m = compute_count("Population municipale", [geo_code], milieu=milieu, sexe="masculin").exact_value or 0
    pop_f = compute_count("Population municipale", [geo_code], milieu=milieu, sexe="feminin").exact_value or 0

    rows = []
    for lo, hi in buckets:
        sublabel = f"{lo}-{hi} ans" if hi is not None else "75 ans ou plus"
        row = {"band": sublabel, "sort_key": lo, "hommes": 0, "femmes": 0}
        for sexe, pop_total, key in (("masculin", pop_m, "hommes"), ("feminin", pop_f, "femmes")):
            ind_id = _indicator_id(con, "population", "Âge quinquennal (%)", sublabel, sexe)
            if ind_id is None:
                continue
            vals = _values_for(con, ind_id, [geo_code], milieu)
            if vals:
                row[key] = round(pop_total * vals[0][1] / 100)
        rows.append(row)
    return sorted(rows, key=lambda r: r["sort_key"])


def category_breakdown(
    category: str,
    geo_code: str,
    milieu: str = "ensemble",
    sexe: str = "ensemble",
    group: str = "population",
) -> list[dict]:
    """All sublabels of a breakdown category (e.g. "Type de logement (%)")
    for one geo unit, each with its share and exact headcount — feeds
    treemap/sunburst-style composition charts."""
    con = get_cursor()
    rows = con.execute(
        'SELECT DISTINCT sublabel FROM indicators WHERE "group" = ? AND category = ? AND sexe_scope = ? AND sublabel != \'\' ORDER BY sublabel',
        [group, category, sexe],
    ).fetchall()
    sublabels = [r[0] for r in rows]

    is_menages_pct = category in MENAGES_PCT_CATEGORIES
    base_category = MENAGES_BASE_CATEGORY if is_menages_pct else (
        "Population municipale" if group == "population" else "Ménages population"
    )
    base_group = "menages" if is_menages_pct else group
    base_sexe = "ensemble" if is_menages_pct else sexe
    try:
        base = compute_count(base_category, [geo_code], milieu=milieu, sexe=base_sexe, group=base_group).exact_value
    except ValueError:
        base = None

    out = []
    for sub in sublabels:
        ind_id = _indicator_id(con, group, category, sub, sexe)
        if ind_id is None:
            continue
        vals = _values_for(con, ind_id, [geo_code], milieu)
        if not vals:
            continue
        pct = vals[0][1]
        out.append({
            "sublabel": sub,
            "percentage": pct,
            "exact_value": round(base * pct / 100) if base else None,
        })
    return out


def compute_literacy(geo_codes: list[str], milieu: str = "ensemble", sexe: str = "ensemble") -> dict:
    """Taux d'alphabétisation (15 ans et plus) = 100% - taux d'analphabétisme, with exact headcount."""
    analphabetisme = compute_rate("Taux d'analphabétisme des 15 ans et plus (%)", geo_codes, milieu=milieu, sexe=sexe)
    if analphabetisme.percentage is None:
        return {
            "label": "Taux d'alphabétisation (15 ans et plus)",
            "percentage": None, "exact_value": None,
            "base_label": analphabetisme.base_label, "base_value": None,
            "calculation_method": "Non disponible",
        }
    percentage = round(100 - analphabetisme.percentage, 1)
    exact = analphabetisme.base_value - analphabetisme.exact_value
    return {
        "label": "Taux d'alphabétisation (15 ans et plus)",
        "percentage": percentage,
        "exact_value": round(exact),
        "base_label": analphabetisme.base_label,
        "base_value": analphabetisme.base_value,
        "calculation_method": (
            f"100% − taux d'analphabétisme ({analphabetisme.percentage}%). "
            f"Effectif exact = {analphabetisme.base_label} ({fmt(analphabetisme.base_value)}) − "
            f"analphabètes ({fmt(analphabetisme.exact_value)}) = {fmt(exact)}."
        ),
    }


def get_executive_kpis(geo_code: str = "NATIONAL") -> dict:
    """The 7 cards for the Vue exécutive, for a single geo unit."""
    geo_codes = [geo_code]
    population_totale = compute_count("Population légale", geo_codes)
    menages = compute_count("Ménages", geo_codes, group="menages")
    chomage = compute_rate("Taux de chômage (%)", geo_codes)
    pop_urbaine = compute_count("Population municipale", geo_codes, milieu="urbain")
    pop_rurale = compute_count("Population municipale", geo_codes, milieu="rural")
    hommes = compute_count("Population municipale", geo_codes, sexe="masculin")
    femmes = compute_count("Population municipale", geo_codes, sexe="feminin")

    return {
        "geo_code": geo_code,
        "population_totale": population_totale.__dict__,
        "menages": menages.__dict__,
        "taux_chomage": chomage.__dict__,
        "taux_alphabetisation": compute_literacy(geo_codes),
        "population_urbaine": pop_urbaine.__dict__,
        "population_rurale": pop_rurale.__dict__,
        "hommes": hommes.__dict__,
        "femmes": femmes.__dict__,
    }
