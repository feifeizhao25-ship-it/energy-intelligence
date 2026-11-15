"""PDF helpers shared by the domestic and international report builders.

* ``sanitize_for_cid`` - the built-in Adobe-GB1 font (STSong-Light) has no glyph for U+00B7 "·" or
  U+2022 "•"; they print as empty boxes ("tofu"). When that font is the only CJK font on the machine
  we swap those characters for U+30FB "・", which it does have. A real TrueType CJK font (WenQuanYi,
  installed in the Docker image) needs no swap.
* ``ReportDocTemplate`` - reports a table of contents with real page numbers and PDF bookmarks, by
  notifying the TOC from every heading (style names ``H1``/``H2``/``H3``).
"""

from __future__ import annotations

from typing import Any

from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, SimpleDocTemplate
from reportlab.platypus.tableofcontents import TableOfContents

CID_FALLBACK_FONT = "STSong-Light"
_CID_SWAP = {"\u00b7": "\u30fb", "\u2022": "\u30fb", "\u2219": "\u30fb", "\u22c5": "\u30fb",
             "\u2713": "\u221a", "\u2717": "\u00d7"}
_SWAP_TABLE = str.maketrans(_CID_SWAP)


def needs_swap(font_name: str) -> bool:
    """True when ``font_name`` cannot draw U+00B7 (the built-in CID font, or a TTF without it)."""
    if font_name == CID_FALLBACK_FONT:
        return True
    try:
        from reportlab.pdfbase import pdfmetrics

        face = pdfmetrics.getFont(font_name).face
        return ord("\u00b7") not in face.charToGlyph
    except Exception:
        return False  # core fonts etc.: nothing to swap


def sanitize_text(text: str) -> str:
    return text.translate(_SWAP_TABLE)


def sanitize_for_cid(obj: Any) -> Any:
    """Return a deep copy of ``obj`` with unsupported glyphs swapped (strings only)."""
    if isinstance(obj, str):
        return sanitize_text(obj)
    if isinstance(obj, dict):
        return {k: sanitize_for_cid(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return type(obj)(sanitize_for_cid(v) for v in obj)
    return obj


HEADING_LEVELS = {"H1": 0, "H2": 1, "H3": 2}


class ReportDocTemplate(SimpleDocTemplate):
    """SimpleDocTemplate that feeds headings to the TableOfContents and to the PDF outline."""

    def afterFlowable(self, flowable):
        if not isinstance(flowable, Paragraph):
            return
        level = HEADING_LEVELS.get(flowable.style.name)
        if level is None:
            return
        text = flowable.getPlainText()
        if getattr(flowable, "_no_toc", False):
            return
        key = f"h{self.seq.nextf('toc')}"
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(text, key, level=level, closed=level > 0)
        self.notify("TOCEntry", (level, text, self.page, key))


def build_toc(font: str, size_scale: float = 1.0) -> TableOfContents:
    toc = TableOfContents()
    toc.dotsMinLevel = 0
    toc.levelStyles = [
        ParagraphStyle("TOC1", fontName=font, fontSize=11 * size_scale, leading=20, leftIndent=0,
                       firstLineIndent=0, spaceBefore=4),
        ParagraphStyle("TOC2", fontName=font, fontSize=9.5 * size_scale, leading=16, leftIndent=18,
                       firstLineIndent=0),
        ParagraphStyle("TOC3", fontName=font, fontSize=9 * size_scale, leading=14, leftIndent=36,
                       firstLineIndent=0),
    ]
    return toc
