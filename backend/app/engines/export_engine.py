"""
Export Engine — CSV / Excel / PDF generation for a filtered result table.

PNG export (charts) is handled client-side (the charting library rasterizes
its own canvas/SVG) — nothing to generate server-side for that format.
"""
from __future__ import annotations

import io

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def to_csv_bytes(rows: list[dict]) -> bytes:
    df = pd.DataFrame(rows)
    return df.to_csv(index=False).encode("utf-8-sig")  # BOM so Excel opens accented text correctly


def to_excel_bytes(rows: list[dict], sheet_name: str = "RGPH 2024") -> bytes:
    df = pd.DataFrame(rows)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False, sheet_name=sheet_name)
        workbook = writer.book
        worksheet = writer.sheets[sheet_name]
        header_fmt = workbook.add_format({"bold": True, "bg_color": "#0F172A", "font_color": "white"})
        for col_idx, col in enumerate(df.columns):
            worksheet.write(0, col_idx, col, header_fmt)
            width = max(12, min(40, int(df[col].astype(str).str.len().max() if len(df) else 12) + 2))
            worksheet.set_column(col_idx, col_idx, width)
    return buf.getvalue()


def to_pdf_bytes(rows: list[dict], title: str = "RGPH 2024 — Export") -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4))
    styles = getSampleStyleSheet()
    elements = [Paragraph(title, styles["Title"]), Spacer(1, 12)]

    if rows:
        columns = list(rows[0].keys())
        data = [columns] + [[str(r.get(c, "")) for c in columns] for r in rows]
        table = Table(data, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F5F9")]),
                ]
            )
        )
        elements.append(table)
    else:
        elements.append(Paragraph("Aucune donnée pour cette sélection.", styles["Normal"]))

    doc.build(elements)
    return buf.getvalue()
