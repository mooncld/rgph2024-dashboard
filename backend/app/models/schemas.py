from pydantic import BaseModel


class SearchRequest(BaseModel):
    query: str


class UniversalExploreRequest(BaseModel):
    indicator_key: str | None = None
    category: str | None = None
    group: str = "population"
    is_rate: bool = False
    geo: list[str] = ["NATIONAL"]
    include_descendants: bool = False
    milieu: str = "ensemble"
    sexe: str = "ensemble"
    age_min: int | None = None
    age_max: int | None = None


class ExportRequest(BaseModel):
    rows: list[dict]
    format: str  # csv | excel | pdf
    title: str = "RGPH 2024 — Export"
