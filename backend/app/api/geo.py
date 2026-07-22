from fastapi import APIRouter

from app.core.data import get_cursor
from app.engines import filter_engine

router = APIRouter(prefix="/api/geo", tags=["geo"])


@router.get("/children")
def children(parent_code: str | None = None):
    if parent_code is None:
        con = get_cursor()
        national = con.execute("SELECT geo_code, geo_name, geo_level, full_label FROM geo WHERE geo_code = 'NATIONAL'").fetchone()
        return {
            "node": {"geo_code": national[0], "geo_name": national[1], "geo_level": national[2], "full_label": national[3]},
            "children": filter_engine.get_children("NATIONAL"),
        }
    return {"children": filter_engine.get_children(parent_code)}


@router.get("/search")
def search(q: str, level: str | None = None, limit: int = 8):
    matches = filter_engine.search_geo_by_name(q, level=level, limit=limit)
    return [m.__dict__ for m in matches]


@router.get("/path/{geo_code}")
def path(geo_code: str):
    return filter_engine.get_geo_path(geo_code)


@router.get("/levels")
def levels():
    con = get_cursor()
    rows = con.execute("SELECT geo_level, count(*) FROM geo GROUP BY geo_level ORDER BY min(depth)").fetchall()
    return [{"level": r[0], "count": r[1]} for r in rows]
