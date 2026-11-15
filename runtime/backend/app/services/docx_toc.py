"""Word 目录预渲染（B18）。

以前 TOC 域里只有一行「右键 → 更新域」的占位文字：除 Word 外的查看器（预览、WPS 手机版、LibreOffice、
Google Docs）永远看不到目录，Word 里也要用户手动更新。这里在生成 docx 之后：

1. 把每个 Heading 1-3 预渲染成域结果里的目录条目（标题 + 点线 + 页码）；
2. 页码：本机有 LibreOffice (`soffice`) 时先转一遍 PDF 量出每个标题所在页；没有或失败时只留标题、不写页码
   （绝不写估算出来的页码）；
3. 保留 ``w:updateFields``，Word 打开时仍会按它自己的排版刷新一次。
"""

from __future__ import annotations

import io
import logging
import re
import shutil
import subprocess
import tempfile
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

PLACEHOLDER_PAGE = "99"
_HEADING_RE = re.compile(r"^Heading\s+([1-3])$")


def _collect_headings(doc) -> List[Tuple[int, str]]:
    out: List[Tuple[int, str]] = []
    for p in doc.paragraphs:
        m = _HEADING_RE.match(p.style.name or "")
        text = p.text.strip()
        if m and text:
            out.append((int(m.group(1)), text))
    return out


def _find_toc_paragraph(doc):
    from docx.oxml.ns import qn

    for p in doc.paragraphs:
        for el in p._p.iter(qn("w:instrText")):
            if (el.text or "").strip().startswith("TOC"):
                return p
    return None


def _ensure_toc_styles(doc, text_width) -> None:
    from docx.enum.style import WD_STYLE_TYPE
    from docx.enum.text import WD_TAB_ALIGNMENT, WD_TAB_LEADER
    from docx.shared import Pt, Cm

    for lvl in (1, 2, 3):
        name = f"TOC {lvl}"
        try:
            style = doc.styles[name]
        except KeyError:
            style = doc.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
            style.base_style = doc.styles["Normal"]
        pf = style.paragraph_format
        pf.left_indent = Cm(0.6 * (lvl - 1))
        pf.space_after = Pt(3)
        pf.tab_stops.add_tab_stop(text_width, WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)


def _fld(run, kind: str, instr: Optional[str] = None) -> None:
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    if instr is not None:
        el = OxmlElement("w:instrText")
        el.set(qn("xml:space"), "preserve")
        el.text = instr
    else:
        el = OxmlElement("w:fldChar")
        el.set(qn("w:fldCharType"), kind)
    run._r.append(el)


def _instr_of(par) -> str:
    from docx.oxml.ns import qn

    for el in par._p.iter(qn("w:instrText")):
        if (el.text or "").strip().startswith("TOC"):
            return el.text
    return 'TOC \\o "1-3" \\h \\z \\u'


def _write_entries(doc, toc_par, headings, pages: List[Optional[int]]) -> None:
    from docx.shared import Emu

    sec = doc.sections[0]
    width = Emu(sec.page_width - sec.left_margin - sec.right_margin)
    _ensure_toc_styles(doc, width)
    instr = _instr_of(toc_par)
    paras = []
    for i, ((lvl, text), page) in enumerate(zip(headings, pages)):
        p = toc_par.insert_paragraph_before(style=f"TOC {lvl}")
        if i == 0:
            r = p.add_run()
            _fld(r, "begin")
            r = p.add_run()
            _fld(r, "", instr)
            r = p.add_run()
            _fld(r, "separate")
        p.add_run(text)
        if page is not None:
            p.add_run("\t")
            p.add_run(str(page))
        paras.append(p)
    r = paras[-1].add_run()
    _fld(r, "end")
    toc_par._p.getparent().remove(toc_par._p)


def _norm(s: str) -> str:
    return re.sub(r"\s+", "", s)


def measure_pages(docx_bytes: bytes, headings: List[Tuple[int, str]], timeout: int = 90) -> Optional[List[Optional[int]]]:
    """Page number of each heading as laid out by LibreOffice, or None when it can't be measured."""
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice:
        return None
    try:
        from pypdf import PdfReader

        with tempfile.TemporaryDirectory() as tmp:
            src = f"{tmp}/in.docx"
            with open(src, "wb") as fh:
                fh.write(docx_bytes)
            subprocess.run(
                [soffice, f"-env:UserInstallation=file://{tmp}/profile", "--headless", "--convert-to", "pdf", "--outdir", tmp, src],
                check=True, timeout=timeout, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            reader = PdfReader(f"{tmp}/in.pdf")
            texts = [_norm(pg.extract_text() or "") for pg in reader.pages]
    except Exception as exc:  # no soffice, timeout, bad pdf: leave page numbers out
        logger.warning("TOC page measurement unavailable (%s)", type(exc).__name__)
        return None
    last = _norm(headings[-1][1]) + PLACEHOLDER_PAGE
    toc_end = -1
    for i, t in enumerate(texts):
        if re.search(re.escape(_norm(headings[-1][1])) + r"[.\u2026\u00b7]*" + PLACEHOLDER_PAGE, t):
            toc_end = i
    if toc_end < 0 and not any(last in t for t in texts):
        return None
    cursor = toc_end + 1
    pages: List[Optional[int]] = []
    for _, text in headings:
        needle = _norm(text)
        found = next((i for i in range(cursor, len(texts)) if needle in texts[i]), None)
        if found is None:
            pages.append(None)
        else:
            pages.append(found + 1)
            cursor = found
    return pages


def prerender_toc(docx_bytes: bytes) -> bytes:
    """Return the same document with the TOC field pre-filled (see module docstring)."""
    from docx import Document

    doc = Document(io.BytesIO(docx_bytes))
    toc_par = _find_toc_paragraph(doc)
    headings = _collect_headings(doc)
    if toc_par is None or not headings:
        return docx_bytes
    _write_entries(doc, toc_par, headings, [int(PLACEHOLDER_PAGE)] * len(headings))
    buf = io.BytesIO()
    doc.save(buf)
    measured_input = buf.getvalue()
    pages = measure_pages(measured_input, headings)
    if pages is None:
        pages = [None] * len(headings)
    doc = Document(io.BytesIO(docx_bytes))
    _write_entries(doc, _find_toc_paragraph(doc), headings, pages)
    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()
