"""
Search Engine — natural-language query parsing for the RGPH 2024 explorer.

Pipeline: parse_query() runs a light NLP pre-processing pass (lowercase,
accent-folding for matching only — display strings keep their accents),
then detect_indicator() / detect_geography() / detect_filters() each
extract one dimension using regex + a synonym dictionary + rapidfuzz
fuzzy matching (typo/plural tolerant). generate_response() turns the
parsed intent into an actual KPI computation via kpi_engine.

Example queries this handles:
  "Nombre total de chômeurs à Agadir"
  "Taux d'alphabétisation des femmes à Rabat"
  "Nombre de ménages urbains à Marrakech"
  "Population âgée de 15 à 24 ans dans la région Souss-Massa"
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from rapidfuzz import fuzz

from app.engines import filter_engine, insights_engine, kpi_engine
from app.engines.kpi_engine import KpiResult


def fold(text: str) -> str:
    """Lowercase + strip accents, for matching only (never for display)."""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return text.lower().strip()


# indicator_key -> (synonyms, resolver kind, resolver args)
# "rate" resolvers call kpi_engine.compute_rate(category, ...)
# "count" resolvers call kpi_engine.compute_count(category, ..., group=...)
# "literacy" is the dedicated 100%-taux d'analphabétisme helper.
INDICATOR_CATALOG: list[dict] = [
    {
        "key": "chomage",
        "synonyms": ["chomage", "chomeurs", "chomeuses", "sans emploi", "taux de chomage"],
        "kind": "rate", "category": "Taux de chômage (%)", "group": "population",
    },
    {
        "key": "activite",
        "synonyms": ["taux d'activite", "population active", "actifs"],
        "kind": "rate", "category": "Taux d'activité des 15 ans et plus (%)", "group": "population",
    },
    {
        "key": "emploi",
        "synonyms": ["emploi", "actifs occupes", "population occupee", "travailleurs"],
        "kind": "count", "category": "Population active occupée de 15 ans et plus", "group": "population",
    },
    {
        "key": "alphabetisation",
        "synonyms": ["alphabetisation", "alphabetes", "sait lire et ecrire", "lettres"],
        "kind": "literacy",
    },
    {
        "key": "analphabetisme",
        "synonyms": ["analphabetisme", "analphabetes", "illettrisme", "ne sait pas lire"],
        "kind": "rate", "category": "Taux d'analphabétisme des 15 ans et plus (%)", "group": "population",
    },
    {
        "key": "scolarisation",
        "synonyms": ["scolarisation", "scolarite", "ecole", "education", "scolarises"],
        "kind": "rate", "category": "Taux de scolarisation des 6-11 ans en 2023/2024 (%)", "group": "population",
    },
    {
        "key": "menages",
        "synonyms": ["menages", "foyers", "nombre de menages"],
        "kind": "count", "category": "Ménages", "group": "menages",
    },
    {
        "key": "logement",
        "synonyms": ["logement", "habitat", "type de logement", "maison", "villa", "appartement"],
        "kind": "count", "category": "Ménages", "group": "menages",
    },
    {
        "key": "population",
        "synonyms": ["population", "habitants", "nombre d'habitants", "combien de personnes"],
        "kind": "count", "category": "Population légale", "group": "population",
    },
    {
        "key": "handicap",
        "synonyms": ["handicap", "prevalence du handicap"],
        "kind": "rate", "category": "Taux de prévalence du handicap (%)", "group": "population",
    },
]

SEXE_PATTERNS = [
    (re.compile(r"\bfemmes?\b|\bfeminin(e)?s?\b|\bfilles?\b"), "feminin"),
    (re.compile(r"\bhommes?\b|\bmasculin(e)?s?\b|\bgarcons?\b"), "masculin"),
]
MILIEU_PATTERNS = [
    (re.compile(r"\burbaine?s?\b|\bvilles?\b"), "urbain"),
    (re.compile(r"\brurale?s?\b|\bcampagne\b"), "rural"),
]
AGE_RANGE_RE = re.compile(r"(\d{1,2})\s*(?:-|a|à|et)\s*(\d{1,2})\s*ans")
AGE_PLUS_RE = re.compile(r"(\d{1,2})\s*ans\s*(?:ou\s*plus|et\s*plus)")

GEO_LEVEL_HINTS = {
    "region": "Région", "région": "Région",
    "province": "Préfecture/Province", "prefecture": "Préfecture/Province", "préfecture": "Préfecture/Province",
    "commune": "Commune/Arrondissement", "ville": "Commune/Arrondissement",
}

STOPWORDS = {
    "de", "des", "du", "la", "le", "les", "un", "une", "et", "a", "à", "en", "dans", "au", "aux",
    "pour", "sur", "quel", "quelle", "est", "combien", "nombre", "total", "totale", "ans",
}


@dataclass
class ParsedQuery:
    raw_text: str
    indicator_key: str | None = None
    geo_code: str | None = None
    geo_name: str | None = None
    sexe: str = "ensemble"
    milieu: str = "ensemble"
    age_min: int | None = None
    age_max: int | None = None
    unresolved_tokens: list[str] = field(default_factory=list)


def detect_indicator(folded_text: str) -> str | None:
    best_key, best_score = None, 0
    for entry in INDICATOR_CATALOG:
        for syn in entry["synonyms"]:
            if syn in folded_text:
                return entry["key"]  # exact substring match wins immediately
            score = fuzz.partial_ratio(syn, folded_text)
            if score > best_score:
                best_score, best_key = score, entry["key"]
    return best_key if best_score >= 85 else None


def detect_filters(folded_text: str) -> dict:
    sexe = "ensemble"
    for pattern, value in SEXE_PATTERNS:
        if pattern.search(folded_text):
            sexe = value
            break
    milieu = "ensemble"
    for pattern, value in MILIEU_PATTERNS:
        if pattern.search(folded_text):
            milieu = value
            break
    age_min = age_max = None
    m = AGE_RANGE_RE.search(folded_text)
    if m:
        age_min, age_max = int(m.group(1)), int(m.group(2))
    else:
        m2 = AGE_PLUS_RE.search(folded_text)
        if m2:
            age_min, age_max = int(m2.group(1)), None
    return {"sexe": sexe, "milieu": milieu, "age_min": age_min, "age_max": age_max}


def detect_geography(raw_text: str, folded_text: str) -> tuple[str | None, str | None]:
    level_hint = None
    for kw, level in GEO_LEVEL_HINTS.items():
        if kw in folded_text:
            level_hint = level
            break

    # Strip known non-geo vocabulary so fuzzy matching isn't distracted by
    # e.g. "chômage" matching a place name by accident.
    words = [w for w in re.split(r"[^a-zàâäéèêëïîôöùûüç'-]+", raw_text.lower()) if w and w not in STOPWORDS]
    candidate_phrase = " ".join(words)

    matches = filter_engine.search_geo_by_name(candidate_phrase, level=level_hint, limit=1)
    if not matches:
        matches = filter_engine.search_geo_by_name(candidate_phrase, limit=1)
    if matches and matches[0].score >= 70:
        return matches[0].geo_code, matches[0].geo_name
    return None, None


def parse_query(text: str) -> ParsedQuery:
    folded = fold(text)
    indicator_key = detect_indicator(folded)
    filters = detect_filters(folded)
    geo_code, geo_name = detect_geography(text, folded)
    return ParsedQuery(
        raw_text=text,
        indicator_key=indicator_key,
        geo_code=geo_code,
        geo_name=geo_name,
        sexe=filters["sexe"],
        milieu=filters["milieu"],
        age_min=filters["age_min"],
        age_max=filters["age_max"],
    )


def _catalog_entry(key: str) -> dict:
    return next(e for e in INDICATOR_CATALOG if e["key"] == key)


def generate_response(text: str) -> dict:
    parsed = parse_query(text)
    geo_code = parsed.geo_code or "NATIONAL"
    geo_codes = [geo_code]

    if parsed.age_min is not None:
        result: KpiResult | dict = kpi_engine.compute_age_band(
            parsed.age_min, parsed.age_max, geo_codes, milieu=parsed.milieu, sexe=parsed.sexe
        )
        result_dict = result.__dict__
    elif parsed.indicator_key is None:
        return {
            "query": text,
            "understood": False,
            "message": "Je n'ai pas identifié d'indicateur dans cette requête. "
            "Essayez par exemple : \"Taux de chômage des femmes à Agadir\".",
            "parsed": parsed.__dict__,
        }
    else:
        entry = _catalog_entry(parsed.indicator_key)
        if entry["kind"] == "literacy":
            result_dict = kpi_engine.compute_literacy(geo_codes, milieu=parsed.milieu, sexe=parsed.sexe)
        elif entry["kind"] == "rate":
            result_dict = kpi_engine.compute_rate(
                entry["category"], geo_codes, milieu=parsed.milieu, sexe=parsed.sexe, group=entry["group"]
            ).__dict__
        else:
            kw_sexe = parsed.sexe if entry["group"] == "population" else "ensemble"
            result_dict = kpi_engine.compute_count(
                entry["category"], geo_codes, milieu=parsed.milieu, sexe=kw_sexe, group=entry["group"]
            ).__dict__

    insight = None
    if parsed.indicator_key:
        entry = _catalog_entry(parsed.indicator_key)
        rate_category = entry["category"] if entry["kind"] == "rate" else (
            "Taux d'analphabétisme des 15 ans et plus (%)" if entry["kind"] == "literacy" else None
        )
        if rate_category and geo_code != "NATIONAL":
            insight = insights_engine.compare_to_national(rate_category, geo_code, milieu=parsed.milieu, sexe=parsed.sexe)

    return {
        "query": text,
        "understood": True,
        "parsed": {
            "indicator": parsed.indicator_key,
            "geo_code": geo_code,
            "geo_name": parsed.geo_name or "Maroc (national)",
            "sexe": parsed.sexe,
            "milieu": parsed.milieu,
            "age_min": parsed.age_min,
            "age_max": parsed.age_max,
        },
        "result": result_dict,
        "insight": insight,
    }
