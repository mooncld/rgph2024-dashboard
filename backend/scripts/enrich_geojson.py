"""
Enriches the two public GeoJSON boundary files (regions, provinces — sourced
from geoBoundaries, see geojson/SOURCES.md) with the HCP geo_code used
throughout the app, so the frontend can join map features to KPI values on
a single key.

Régions: geoBoundaries' shapeISO ("MA-01".."MA-12") already numbers the
regions identically to HCP's own region codes — a direct lookup, no
fuzzy matching needed.

Provinces/préfectures: geoBoundaries ADM2 has no ISO code, only a
bilingual shapeName ("Province de Khémisset إقليم الخميسات" or "Rhamna
Province"). Arabic is stripped, the French "Province de/d'"/"Préfecture
de/d'" affix is removed, and the remainder is fuzzy-matched (rapidfuzz)
against the 75 HCP province/préfecture names. Every match is logged with
its score for manual review — geometry is useless if silently mismatched.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rapidfuzz import fuzz, process

from app.core.data import get_connection

GEOJSON_DIR = Path(__file__).resolve().parents[1] / "geojson"

ARABIC_RE = re.compile(r"[؀-ۿ]+")
AFFIX_RE = re.compile(
    r"^(Province|Pr[ée]fecture)\s+(de|d['’])\s+|"
    r"\s+(Province|Prefecture)$",
    re.I,
)


def clean_shape_name(name: str) -> str:
    name = ARABIC_RE.sub("", name).strip()
    name = AFFIX_RE.sub("", name).strip()
    return name


def enrich_regions() -> None:
    path = GEOJSON_DIR / "morocco_regions.geojson"
    data = json.loads(path.read_text(encoding="utf-8"))
    for feat in data["features"]:
        iso = feat["properties"]["shapeISO"]  # "MA-01" -> geo_code "1"
        code = str(int(iso.split("-")[1]))
        feat["properties"]["geo_code"] = code
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"régions: {len(data['features'])} features enriched -> {path}")


def enrich_provinces() -> None:
    con = get_connection()
    rows = con.execute(
        "SELECT geo_code, geo_name FROM geo WHERE geo_level = 'Préfecture/Province'"
    ).fetchall()
    names = [r[1] for r in rows]

    path = GEOJSON_DIR / "morocco_provinces.geojson"
    data = json.loads(path.read_text(encoding="utf-8"))

    unmatched = []
    low_confidence = []
    for feat in data["features"]:
        raw_name = feat["properties"]["shapeName"]
        cleaned = clean_shape_name(raw_name)
        match = process.extractOne(cleaned, names, scorer=fuzz.WRatio)
        if match is None:
            unmatched.append(raw_name)
            continue
        name, score, idx = match
        feat["properties"]["geo_code"] = rows[idx][0]
        feat["properties"]["matched_hcp_name"] = name
        feat["properties"]["match_score"] = score
        if score < 85:
            low_confidence.append((raw_name, cleaned, name, score))

    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"provinces: {len(data['features'])} features, {len(unmatched)} unmatched -> {path}")
    if unmatched:
        print("UNMATCHED:", unmatched)
    if low_confidence:
        print("LOW CONFIDENCE MATCHES (review manually):")
        for raw, cleaned, matched, score in low_confidence:
            print(f"  {raw!r} (cleaned: {cleaned!r}) -> {matched!r} [{score:.0f}]")


if __name__ == "__main__":
    enrich_regions()
    enrich_provinces()
