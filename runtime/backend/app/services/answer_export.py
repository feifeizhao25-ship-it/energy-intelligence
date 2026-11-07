"""PDF and Word for one stored AI answer.

The bytes are produced only for an answer the server already returned to that user.
A synthetic source URL is labelled in the file. A free plan gets a watermarked PDF,
not Word.
"""

from __future__ import annotations

import io
from typing import Any, Dict, List

from app.services.citation_record import format_citation, is_synthetic_source, synthetic_banner


def sources_are_synthetic(sources: List[Dict[str, Any]]) -> bool:
    return any(is_synthetic_source(src) for src in sources)


def render_answer_file(record: Dict[str, Any], kind: str) -> bytes:
    lang = "en" if record.get("market") == "global" else "zh"
    en = lang == "en"
    lines = [record.get("message") or ""]
    sources = list(record.get("sources") or [])
    if sources_are_synthetic(sources) or record.get("synthetic"):
        lines.insert(0, synthetic_banner(lang))
    if record.get("stand_in"):
        lines.insert(0, (
            "No model was called. This file repeats the library record or the no-source reply. It is not a signed model answer."
            if en else
            "未调用模型。本文件重复资料库记录或无来源说明，不是正式模型回答。"
        ))
    if record.get("watermark"):
        lines.append(
            "Evaluation copy. Watermarked. This download is not a paid Word export."
            if en else
            "免费档水印版本。这不是付费 Word 导出。"
        )
    lines.append(
        "This file was produced by software from the answer and sources above. It is not a signed human review and it does not name a reviewer."
        if en else
        "本文件由软件根据上述回答和来源生成，不是经人工签字的审核结论，也不填写审核人。"
    )
    if sources:
        lines.append("Sources" if en else "来源")
        for index, src in enumerate(sources, 1):
            lines.append(format_citation(index, src, lang))
    else:
        lines.append("No source was attached to this answer." if en else "这条回答没有附来源。")
    title = "AI answer export" if en else "AI 回答导出"
    body = "\n\n".join(line for line in lines if line)
    if kind == "docx":
        return _docx(title, body)
    return _pdf(title, body, lang)


def _pdf(title: str, body: str, lang: str) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    from app.services.citation_record import pdf_link_markup

    font = "Helvetica"
    if lang != "en":
        try:
            from app.routers.reports import _register_cn_font
            font = _register_cn_font()
        except Exception:
            font = "Helvetica"
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm, title=title)
    style = ParagraphStyle("Body", parent=getSampleStyleSheet()["Normal"], fontName=font, fontSize=10, leading=14, spaceAfter=8)
    story = [Paragraph(pdf_link_markup(title), style), Spacer(1, 8)]
    for block in body.split("\n\n"):
        for line in block.split("\n"):
            if line.strip():
                story.append(Paragraph(pdf_link_markup(line), style))

    def footer(canvas, document):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        label = f"Page {document.page}" if lang == "en" else f"Page {document.page}"
        canvas.drawCentredString(A4[0] / 2, 10 * mm, label)
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()


def _docx(title: str, body: str) -> bytes:
    from docx import Document
    from docx.shared import Pt

    from app.services.report_global import _add_paragraph_with_links

    document = Document()
    document.core_properties.title = title
    document.core_properties.comments = "Software-generated answer export. No reviewer is named."
    heading = document.add_paragraph()
    run = heading.add_run(title)
    run.bold = True
    run.font.size = Pt(16)
    for block in body.split("\n\n"):
        _add_paragraph_with_links(document, block)
    buf = io.BytesIO()
    document.save(buf)
    return buf.getvalue()
