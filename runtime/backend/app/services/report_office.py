"""Excel and PowerPoint copies of a report that was already written as Word.

web-int and the domestic Word generator stay the source of the sentences and
tables. These two functions only transcribe that document, so the spreadsheet
and the slides cannot drift to a second set of numbers.
"""
from __future__ import annotations

import io
import re
from typing import Iterable, Union

from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph
from openpyxl import Workbook
from openpyxl.styles import Font
from pptx import Presentation
from pptx.util import Emu, Pt

Block = dict


def _blocks(docx_bytes: bytes) -> list[Block]:
    document = Document(io.BytesIO(docx_bytes))
    blocks: list[Block] = []
    for item in _body_items(document):
        if isinstance(item, Paragraph):
            text = _clean(item.text)
            if not text:
                continue
            match = re.match(r"Heading\s+(\d+)", item.style.name or "")
            blocks.append({"kind": "heading" if match else "text", "level": int(match.group(1)) if match else 0, "text": text})
        else:
            rows = [[_clean(cell.text) for cell in row.cells] for row in item.rows]
            if any(cell for row in rows for cell in row):
                blocks.append({"kind": "table", "rows": rows})
    return blocks


def _body_items(document) -> Iterable[Union[Paragraph, Table]]:
    parent = document.element.body
    for child in parent.iterchildren():
        if child.tag == qn("w:p"):
            yield Paragraph(child, document)
        elif child.tag == qn("w:tbl"):
            yield Table(child, document)


def _clean(value: str) -> str:
    text = (value or "").replace("\x00", "").strip()
    return "".join(ch for ch in text if ch >= " " or ch in "\n\t")


def workbook_from_docx(docx_bytes: bytes) -> bytes:
    """One sheet. Every Word paragraph and table cell is a cell value."""
    blocks = _blocks(docx_bytes)
    book = Workbook()
    sheet = book.active
    sheet.title = "报告"
    row_index = 1
    for block in blocks:
        if block["kind"] == "table":
            for table_row in block["rows"]:
                for column, cell in enumerate(table_row, start=1):
                    _write(sheet, row_index, column, cell, bold=row_index == 1 and column == 1)
                row_index += 1
            row_index += 1
            continue
        bold = block["kind"] == "heading"
        _write(sheet, row_index, 1, block["text"], bold=bold)
        row_index += 1
    buffer = io.BytesIO()
    book.save(buffer)
    return buffer.getvalue()


def _write(sheet, row: int, column: int, value: str, bold: bool) -> None:
    text = value
    if text[:1] in ("=", "+", "-", "@"):
        text = "'" + text
    cell = sheet.cell(row, column, text)
    if bold:
        cell.font = Font(bold=True)


def slides_from_docx(docx_bytes: bytes) -> bytes:
    """One slide per heading, with the following paragraphs and table cells on it."""
    blocks = _blocks(docx_bytes)
    presentation = Presentation()
    presentation.slide_width = Emu(12192000)
    presentation.slide_height = Emu(6858000)
    blank = presentation.slide_layouts[6]
    chunks = _slide_chunks(blocks)
    if not chunks:
        chunks = [["（报告没有可导出的正文）"]]
    for lines in chunks:
        slide = presentation.slides.add_slide(blank)
        box = slide.shapes.add_textbox(Emu(457200), Emu(365760), Emu(11277600), Emu(6126480))
        frame = box.text_frame
        frame.word_wrap = True
        for index, line in enumerate(lines):
            paragraph = frame.paragraphs[0] if index == 0 else frame.add_paragraph()
            paragraph.text = line
            paragraph.font.size = Pt(18 if index == 0 else 14)
            paragraph.font.bold = index == 0
    buffer = io.BytesIO()
    presentation.save(buffer)
    return buffer.getvalue()


def _slide_chunks(blocks: list[Block]) -> list[list[str]]:
    chunks: list[list[str]] = []
    current: list[str] = []
    for block in blocks:
        lines = _block_lines(block)
        if block["kind"] == "heading" and block["level"] <= 1 and current:
            chunks.append(current)
            current = []
        current.extend(lines)
        if len(current) > 18:
            chunks.append(current)
            current = []
    if current:
        chunks.append(current)
    return chunks


def _block_lines(block: Block) -> list[str]:
    if block["kind"] != "table":
        return [block["text"]]
    lines: list[str] = []
    for row in block["rows"]:
        cells = [cell for cell in row if cell]
        if cells:
            lines.append(" | ".join(cells))
            lines.extend(cells)
    return lines
