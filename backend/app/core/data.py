"""
Central data access layer.

Registers the three processed parquet files (geo, indicators, facts) as
DuckDB views so every engine can query them with plain SQL instead of
re-implementing filtering/aggregation in pandas. DuckDB reads parquet
directly (no import/copy step), which keeps startup fast even though the
fact table has ~1M rows.
"""
from __future__ import annotations

from functools import lru_cache

import duckdb

from app.core.config import FACTS_PARQUET, GEO_PARQUET, INDICATORS_PARQUET


@lru_cache
def get_connection() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect(database=":memory:")
    con.execute(f"CREATE VIEW geo AS SELECT * FROM read_parquet('{GEO_PARQUET.as_posix()}')")
    con.execute(f"CREATE VIEW indicators AS SELECT * FROM read_parquet('{INDICATORS_PARQUET.as_posix()}')")
    con.execute(f"CREATE VIEW facts AS SELECT * FROM read_parquet('{FACTS_PARQUET.as_posix()}')")
    # Pre-computed ancestor closure so "give me every descendant of region X"
    # is a single indexed lookup instead of a recursive query per request.
    con.execute(
        """
        CREATE TABLE geo_ancestors AS
        WITH RECURSIVE chain(geo_code, ancestor_code, depth) AS (
            SELECT geo_code, geo_code, 0 FROM geo
            UNION ALL
            SELECT chain.geo_code, geo.parent_code, chain.depth + 1
            FROM chain JOIN geo ON geo.geo_code = chain.ancestor_code
            WHERE geo.parent_code IS NOT NULL
        )
        SELECT geo_code, ancestor_code, depth FROM chain
        """
    )
    con.execute("CREATE INDEX idx_ancestors_ancestor ON geo_ancestors(ancestor_code)")
    # facts/geo/indicators stay DuckDB views over parquet (read_parquet already
    # pushes filters down efficiently); only real tables accept CREATE INDEX.
    return con


def get_cursor() -> duckdb.DuckDBPyConnection:
    """A DuckDB connection is not safe to share across threads. FastAPI runs
    sync `def` endpoints in a thread pool, so every query must go through its
    own cursor()  — otherwise concurrent requests intermittently see each
    other's query state (observed as spurious "unknown indicator" errors
    under load). cursor() is cheap: it shares the same in-memory database
    and its views/tables, just gives the calling thread its own handle."""
    return get_connection().cursor()


def descendants_of(geo_code: str) -> list[str]:
    """All geo_codes in the subtree rooted at geo_code, geo_code included."""
    con = get_cursor()
    rows = con.execute(
        "SELECT geo_code FROM geo_ancestors WHERE ancestor_code = ?", [geo_code]
    ).fetchall()
    return [r[0] for r in rows]
