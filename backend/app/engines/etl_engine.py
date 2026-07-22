"""
ETL Engine — RGPH 2024 (HCP)

Transforms the wide-format publication workbook
(data/raw/RGPH2024_indicateurs.xlsx) into three tidy, query-ready tables:

  - geo.parquet        one row per geographic unit, with parent_code for
                        tree navigation (National > Région > Province/Préfecture
                        > Cercle > Commune/Arrondissement > Centre urbain "dont")
  - indicators.parquet one row per distinct indicator (id, category, label,
                        sexe_scope, group)
  - facts.parquet      long/tidy fact table: geo_code, milieu, sexe,
                        indicator_id, value

The source workbook has three header rows for the Population sheets
(sexe block / category / sub-label) and two for the Ménages sheets
(category / sub-label). Columns are flattened using forward-fill so a
merged-looking header cell applies to every column beneath it until the
next non-empty cell.

Conventional signs (see sheet "Signes_Conventionnels"):
  "…"  not applicable for this geographic unit -> NaN
  "."  data unavailable                        -> NaN
  "*"  collected from local administration (seasonal population) -> kept,
       flagged in a separate `estimated` column on the fact table.
"""
from __future__ import annotations

import re
import unicodedata
from pathlib import Path

import pandas as pd

RAW_PATH = Path(__file__).resolve().parents[2] / "data" / "raw" / "RGPH2024_indicateurs.xlsx"
OUT_DIR = Path(__file__).resolve().parents[2] / "data" / "processed"

NA_TOKENS = {"…", "."}
ESTIMATED_TOKEN = "*"

POPULATION_SHEETS = {
    "Population": "ensemble",
    "Population_Urbaine": "urbain",
    "Population_Rurale": "rural",
}
MENAGES_SHEETS = {
    "Ménages": "ensemble",
    "Ménages_Urbains": "urbain",
    "Ménages_Ruraux": "rural",
}

LEVEL_RULES = [
    (0, "National", re.compile(r"^Ensemble du territoire national", re.I)),
    (1, "Région", re.compile(r"^R[ée]gion", re.I)),
    # Casablanca/Rabat/Salé subdivide their préfecture into "préfectures
    # d'arrondissements" — a level nested INSIDE the préfecture, one rung
    # above the arrondissements themselves. Must be checked before the
    # generic "Préfecture" rule below (both start with "Préfecture"), and
    # is given the same depth as Cercle since the two never co-occur as
    # siblings under the same parent.
    (3, "Préfecture d'arrondissements", re.compile(r"^Pr[ée]fecture d['’]arrondissement", re.I)),
    (2, "Préfecture/Province", re.compile(r"^(Pr[ée]fecture|Province)", re.I)),
    (3, "Cercle", re.compile(r"^Cercle", re.I)),
    (4, "Commune/Arrondissement", re.compile(r"^(Commune|Arrondissement|Municipalit[ée])", re.I)),
    (5, "Centre urbain", re.compile(r"^dont", re.I)),
]


def clean_text(text: str) -> str:
    """Collapse non-breaking spaces (\\xa0 — present in several source
    headers, e.g. "...en\\xa02023/2024") and any other whitespace run into a
    single regular space, so downstream exact-string matching (RATE_BASE,
    frontend indicator catalogs) never silently breaks on an invisible
    character."""
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "_", text).strip("_").lower()
    return text


def classify_level(label: str) -> tuple[int, str]:
    label = str(label).strip()
    for depth, name, pattern in LEVEL_RULES:
        if pattern.match(label):
            return depth, name
    raise ValueError(f"Unrecognized geographic label: {label!r}")


def clean_label(label: str) -> str:
    label = str(label).strip()
    if re.match(r"^Ensemble du territoire national", label, re.I):
        return "Maroc"
    # Strip the leading admin-level word so geo_name is just the place name.
    m = re.match(
        r"^(R[ée]gion de\s*|"
        r"Pr[ée]fecture d['’]arrondissements? de\s*|Pr[ée]fecture d['’]arrondissements? d['’]\s*|"
        r"Pr[ée]fecture de\s*|Pr[ée]fecture d['’]\s*|Province de\s*|"
        r"Province d['’]\s*|Cercle de\s*|Cercle d['’]\s*|Commune de\s*|Commune d['’]\s*|"
        r"Arrondissement de\s*|Arrondissement d['’]\s*|dont le centre urbain de\s*|"
        r"dont le centre urbain d['’]\s*)",
        label,
        flags=re.I,
    )
    return label[m.end():].strip() if m else label


def build_geo_dimension(df: pd.DataFrame) -> pd.DataFrame:
    """df has columns 0=code, 1=label, in original sheet row order (pre-order tree traversal)."""
    records = []
    stack: list[tuple[int, str]] = []  # (depth, geo_code)

    for _, row in df.iterrows():
        raw_code = row[0]
        label = row[1]
        if pd.isna(label):
            continue
        label = clean_text(str(label))
        depth, level_name = classify_level(label)
        code = "NATIONAL" if depth == 0 else str(raw_code).split(".")[0]

        while stack and stack[-1][0] >= depth:
            stack.pop()
        parent_code = stack[-1][1] if stack else None
        stack.append((depth, code))

        records.append(
            {
                "geo_code": code,
                "geo_name": clean_label(label),
                "full_label": str(label).strip(),
                "geo_level": level_name,
                "depth": depth,
                "parent_code": parent_code,
            }
        )
    geo = pd.DataFrame.from_records(records).drop_duplicates(subset="geo_code")
    return geo


def _normalize_scalar_sublabels(meta: list[dict]) -> list[dict]:
    """If a (category, sexe) pair has only one column in this sheet, its
    sublabel is a genuine scalar metric, not a breakdown — but the source
    workbook's row-1 text for those scalar columns is not consistent across
    the Ensemble/Urbain/Rural tabs (e.g. "Ménages" carries "Ménages
    population" in one tab and nothing in another for the same column).
    Blanking the sublabel there keeps the indicator_id identical across
    tabs; real breakdowns (category appearing >1 time, e.g. "Âge
    quinquennal (%)") keep their sublabel untouched since it's what
    differentiates them."""
    from collections import Counter

    counts = Counter((m["category"], m["sexe"]) for m in meta)
    for m in meta:
        if counts[(m["category"], m["sexe"])] == 1 and m["sublabel"]:
            m["sublabel"] = ""
            m["label"] = m["category"]
    return meta


def flatten_population_headers(raw: pd.DataFrame) -> list[dict]:
    """3 header rows: sexe-block / category / sub-label. Returns per-column metadata."""
    h0, h1, h2 = raw.iloc[0], raw.iloc[1], raw.iloc[2]
    h0 = h0.ffill()
    h1 = h1.ffill()
    meta = []
    for col in raw.columns:
        if col in (0, 1):
            continue
        sexe_block = str(h0[col]) if pd.notna(h0[col]) else ""
        sexe = "ensemble"
        m = re.search(r"Sexe\s*:\s*(Ensemble|Masculin|F[ée]minin)", sexe_block, re.I)
        if m:
            v = m.group(1).lower()
            sexe = "feminin" if v.startswith("f") else v
        category = clean_text(str(h1[col])) if pd.notna(h1[col]) else ""
        sublabel = clean_text(str(h2[col])) if pd.notna(h2[col]) else ""
        label = f"{category} - {sublabel}" if sublabel else category
        if not category and not sublabel:
            continue
        meta.append(
            {
                "col": col,
                "sexe": sexe,
                "category": category,
                "sublabel": sublabel,
                "label": label,
            }
        )
    return _normalize_scalar_sublabels(meta)


def flatten_menages_headers(raw: pd.DataFrame) -> list[dict]:
    """2 header rows: category / sub-label. No sexe dimension."""
    h0, h1 = raw.iloc[0], raw.iloc[1]
    h0 = h0.ffill()
    meta = []
    for col in raw.columns:
        if col in (0, 1):
            continue
        category = clean_text(str(h0[col])) if pd.notna(h0[col]) else ""
        sublabel = clean_text(str(h1[col])) if pd.notna(h1[col]) else ""
        label = f"{category} - {sublabel}" if sublabel else category
        if not category and not sublabel:
            continue
        meta.append({"col": col, "sexe": "ensemble", "category": category, "sublabel": sublabel, "label": label})
    return _normalize_scalar_sublabels(meta)


def clean_value(v):
    if pd.isna(v):
        return None, False
    s = str(v).strip()
    if s in NA_TOKENS or s == "":
        return None, False
    estimated = s.endswith(ESTIMATED_TOKEN)
    s = s.rstrip(ESTIMATED_TOKEN).strip()
    try:
        return float(s), estimated
    except ValueError:
        return None, estimated


def process_group(sheets: dict[str, str], header_rows: int, group: str) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    all_geo = []
    all_facts = []
    indicators: dict[str, dict] = {}

    for sheet_name, milieu in sheets.items():
        raw = pd.read_excel(RAW_PATH, sheet_name=sheet_name, header=None)
        data = raw.iloc[header_rows:].reset_index(drop=True)

        geo_df = build_geo_dimension(data[[0, 1]])
        geo_df["milieu_present"] = milieu
        all_geo.append(geo_df)

        col_meta = flatten_population_headers(raw) if group == "population" else flatten_menages_headers(raw)

        # geo_code per data row, in the same order as build_geo_dimension emitted them
        # (build_geo_dimension iterates rows in order and skips blank labels, matching data row order)
        codes = []
        stack_depth_seen = []
        for _, row in data.iterrows():
            if pd.isna(row[1]):
                continue
            depth, _ = classify_level(row[1])
            code = "NATIONAL" if depth == 0 else str(row[0]).split(".")[0]
            codes.append(code)
        data_indexed = data[data[1].notna()].reset_index(drop=True)
        data_indexed["__geo_code"] = codes

        for meta in col_meta:
            indicator_id = slugify(f"{group}__{meta['category']}__{meta['sublabel']}__{meta['sexe']}")
            if indicator_id not in indicators:
                indicators[indicator_id] = {
                    "indicator_id": indicator_id,
                    "group": group,
                    "category": meta["category"],
                    "sublabel": meta["sublabel"],
                    "label": meta["label"],
                    "sexe_scope": meta["sexe"],
                    "is_percentage": "(%)" in meta["category"],
                }
            col_idx = meta["col"]
            series = data_indexed[col_idx]
            for geo_code, raw_val in zip(data_indexed["__geo_code"], series):
                value, estimated = clean_value(raw_val)
                if value is None and not estimated:
                    continue
                all_facts.append(
                    {
                        "geo_code": geo_code,
                        "milieu": milieu,
                        "indicator_id": indicator_id,
                        "value": value,
                        "estimated": estimated,
                    }
                )

    geo_final = pd.concat(all_geo, ignore_index=True).drop_duplicates(subset="geo_code", keep="first")
    facts_final = pd.DataFrame.from_records(all_facts)
    indicators_final = pd.DataFrame.from_records(list(indicators.values()))
    return geo_final, indicators_final, facts_final


def run() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    geo_pop, ind_pop, facts_pop = process_group(POPULATION_SHEETS, header_rows=3, group="population")
    geo_men, ind_men, facts_men = process_group(MENAGES_SHEETS, header_rows=2, group="menages")

    geo = pd.concat([geo_pop, geo_men], ignore_index=True).drop_duplicates(subset="geo_code", keep="first")
    geo = geo.drop(columns=["milieu_present"])
    indicators = pd.concat([ind_pop, ind_men], ignore_index=True)
    facts = pd.concat([facts_pop, facts_men], ignore_index=True)

    geo.to_parquet(OUT_DIR / "geo.parquet", index=False)
    indicators.to_parquet(OUT_DIR / "indicators.parquet", index=False)
    facts.to_parquet(OUT_DIR / "facts.parquet", index=False)

    print(f"geo:        {len(geo):>8} rows -> {OUT_DIR / 'geo.parquet'}")
    print(f"indicators: {len(indicators):>8} rows -> {OUT_DIR / 'indicators.parquet'}")
    print(f"facts:      {len(facts):>8} rows -> {OUT_DIR / 'facts.parquet'}")
    print()
    print("geo_level distribution:")
    print(geo["geo_level"].value_counts())
    print()
    print("sample indicators:")
    print(indicators.sample(min(10, len(indicators)))[["indicator_id", "category", "sublabel", "sexe_scope"]])


if __name__ == "__main__":
    run()
