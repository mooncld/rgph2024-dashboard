import io

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.engines import export_engine
from app.models.schemas import ExportRequest

router = APIRouter(prefix="/api/export", tags=["export"])

MEDIA_TYPES = {
    "csv": "text/csv",
    "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}
EXTENSIONS = {"csv": "csv", "excel": "xlsx", "pdf": "pdf"}


@router.post("")
def export(req: ExportRequest):
    if req.format not in MEDIA_TYPES:
        raise HTTPException(400, f"Unsupported format: {req.format}")

    if req.format == "csv":
        data = export_engine.to_csv_bytes(req.rows)
    elif req.format == "excel":
        data = export_engine.to_excel_bytes(req.rows)
    else:
        data = export_engine.to_pdf_bytes(req.rows, title=req.title)

    filename = f"rgph2024_export.{EXTENSIONS[req.format]}"
    return StreamingResponse(
        io.BytesIO(data),
        media_type=MEDIA_TYPES[req.format],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
