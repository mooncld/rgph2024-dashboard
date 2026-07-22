"""
Filter Engine — geographic resolution + combinable filter model.

The "Explorateur universel" lets a user combine any geography with any
demographic/socio-economic filter (e.g. Chômage + Femme + Souss-Massa).
Geography is resolved here (name or code -> list of geo_codes, optionally
expanded to every descendant); the resulting geo_codes list, milieu and
sexe are then handed to kpi_engine, which does the actual computation.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from rapidfuzz import fuzz, process

from app.core.data import descendants_of, get_cursor

VALID_MILIEUX = {"ensemble", "urbain", "rural"}
VALID_SEXE = {"ensemble", "masculin", "feminin"}


@dataclass
class GeoMatch:
    geo_code: str
    geo_name: str
    geo_level: str
    full_label: str
    score: float


@dataclass
class UniversalFilter:
    geo_codes: list[str] = field(default_factory=lambda: ["NATIONAL"])
    milieu: str = "ensemble"
    sexe: str = "ensemble"
    age_min: int | None = None
    age_max: int | None = None


def search_geo_by_name(query: str, level: str | None = None, limit: int = 8) -> list[GeoMatch]:
    """Fuzzy-match a place name against the geo dimension (accent/typo tolerant)."""
    con = get_cursor()
    if level:
        rows = con.execute(
            "SELECT geo_code, geo_name, geo_level, full_label FROM geo WHERE geo_level = ?", [level]
        ).fetchall()
    else:
        rows = con.execute("SELECT geo_code, geo_name, geo_level, full_label FROM geo").fetchall()

    names = [r[1] for r in rows]
    matches = process.extract(query, names, scorer=fuzz.WRatio, limit=limit)
    results = []
    for name, score, idx in matches:
        if score < 60:
            continue
        r = rows[idx]
        results.append(GeoMatch(geo_code=r[0], geo_name=r[1], geo_level=r[2], full_label=r[3], score=score))
    return results


def resolve_geo_token(token: str) -> str | None:
    """token is either an exact geo_code or a place name. Returns best-match geo_code."""
    con = get_cursor()
    if token.upper() == "MAROC" or token.upper() == "NATIONAL":
        return "NATIONAL"
    exact = con.execute("SELECT geo_code FROM geo WHERE geo_code = ?", [token]).fetchone()
    if exact:
        return exact[0]
    matches = search_geo_by_name(token, limit=1)
    return matches[0].geo_code if matches else None


def expand_with_descendants(geo_code: str, include_descendants: bool = False) -> list[str]:
    if not include_descendants:
        return [geo_code]
    return descendants_of(geo_code)


def get_children(geo_code: str) -> list[dict]:
    con = get_cursor()
    rows = con.execute(
        "SELECT geo_code, geo_name, geo_level, full_label FROM geo WHERE parent_code = ? ORDER BY geo_name",
        [geo_code],
    ).fetchall()
    return [{"geo_code": r[0], "geo_name": r[1], "geo_level": r[2], "full_label": r[3]} for r in rows]


def get_geo_path(geo_code: str) -> list[dict]:
    """Breadcrumb from National down to geo_code."""
    con = get_cursor()
    path = []
    current = geo_code
    seen = set()
    while current and current not in seen:
        seen.add(current)
        row = con.execute(
            "SELECT geo_code, geo_name, geo_level, parent_code FROM geo WHERE geo_code = ?", [current]
        ).fetchone()
        if not row:
            break
        path.append({"geo_code": row[0], "geo_name": row[1], "geo_level": row[2]})
        current = row[3]
    return list(reversed(path))


def build_filter(
    geo: str | list[str] | None = None,
    include_descendants: bool = False,
    milieu: str = "ensemble",
    sexe: str = "ensemble",
    age_min: int | None = None,
    age_max: int | None = None,
) -> UniversalFilter:
    milieu = milieu if milieu in VALID_MILIEUX else "ensemble"
    sexe = sexe if sexe in VALID_SEXE else "ensemble"

    tokens = [geo] if isinstance(geo, str) else (geo or ["NATIONAL"])
    codes: list[str] = []
    for tok in tokens:
        resolved = resolve_geo_token(tok)
        if resolved is None:
            continue
        codes.extend(expand_with_descendants(resolved, include_descendants))
    if not codes:
        codes = ["NATIONAL"]

    return UniversalFilter(geo_codes=list(dict.fromkeys(codes)), milieu=milieu, sexe=sexe, age_min=age_min, age_max=age_max)
