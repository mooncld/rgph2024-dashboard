import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data" / "processed"

GEO_PARQUET = DATA_DIR / "geo.parquet"
INDICATORS_PARQUET = DATA_DIR / "indicators.parquet"
FACTS_PARQUET = DATA_DIR / "facts.parquet"

# Comma-separated list of allowed frontend origins, e.g.
# "https://rgph2024.vercel.app,https://rgph2024-git-main-yourteam.vercel.app"
# Local dev origins are always included so `npm run dev` keeps working.
_DEFAULT_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
_env_origins = os.environ.get("CORS_ORIGINS", "")
CORS_ORIGINS = _DEFAULT_ORIGINS + [o.strip() for o in _env_origins.split(",") if o.strip()]
