"""复测 B18：导出排版。
- 章节标题（如 “Grid Interconnection Plan”）孤立在页尾、正文跳到下一页；
- Word 目录域里只有「右键 → 更新域」占位文字，需用户手动更新才有目录/页码。"""
import io
import re
import shutil

import pytest

from app.routers.reports import TEMPLATES, _demo_data, calc_financial_metrics, generate_docx
from app.services import report_global


def _model(filler: int):
    blocks = [("h", 1, "Overview")]
    blocks += [("p", f"Filler paragraph number {i}. " + "Lorem ipsum dolor sit amet. " * 6) for i in range(filler)]
    blocks += [("h", 1, "Grid Interconnection Plan"), ("p", "FIRSTBODYLINE interconnection text starts here.")]
    blocks += [("p", "tail " * 30)] * 3
    return {"title": "Layout test", "cover": [("Project", "X")], "blocks": blocks}


def _pdf_pages(model):
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(report_global.render_pdf(model)))
    return [re.sub(r"\s+", " ", p.extract_text() or "") for p in reader.pages]


def test_heading_is_never_left_alone_at_the_foot_of_a_page():
    seen_page_break_between = False
    for filler in range(8, 40):
        pages = _pdf_pages(_model(filler))
        head = [i for i, t in enumerate(pages) if "Grid Interconnection Plan" in t and "Contents" not in t[:20] and "Overview" not in t[:0]]
        body = [i for i, t in enumerate(pages) if "FIRSTBODYLINE" in t]
        assert head and body
        # the real heading is the last page that mentions it before the body
        assert head[-1] == body[0], f"heading orphaned with filler={filler}: heading page {head[-1]+1}, body page {body[0]+1}"
        seen_page_break_between = seen_page_break_between or head[-1] > 3
    assert seen_page_break_between  # the sweep really crossed page boundaries


def _docx(report_type, market):
    d = _demo_data()
    if market == "global":
        d.update({"country_code": "US", "currency": "USD", "province_or_region": "Arizona", "city": "Phoenix"})
    m = calc_financial_metrics(d["financial"])
    return generate_docx(d, report_type, TEMPLATES[report_type], m, "Report", "confidential", market)


@pytest.mark.parametrize("market", ["global", "cn"])
def test_docx_contents_are_prerendered_not_a_right_click_hint(market):
    from docx import Document

    payload = _docx("compliance", market)
    doc = Document(io.BytesIO(payload))
    text = "\n".join(p.text for p in doc.paragraphs)
    assert "Update Field" not in text and "更新域" not in text and "右键" not in text
    toc = [p for p in doc.paragraphs if p.style.name.startswith("TOC ")]
    headings = [p.text.strip() for p in doc.paragraphs if p.style.name.startswith("Heading ") and p.text.strip()]
    assert len(toc) == len(headings) >= 4
    assert [re.sub(r"\t.*", "", p.text) for p in toc] == headings
    xml = doc.element.xml
    assert xml.count('w:fldCharType="begin"') >= 1 and "TOC \\o" in xml and 'w:fldCharType="separate"' in xml


@pytest.mark.skipif(not (shutil.which("soffice") or shutil.which("libreoffice")), reason="needs LibreOffice to measure pages")
def test_docx_contents_carry_measured_page_numbers():
    from docx import Document

    doc = Document(io.BytesIO(_docx("compliance", "global")))
    toc = [p.text for p in doc.paragraphs if p.style.name.startswith("TOC ")]
    nums = [int(m.group(1)) for t in toc if (m := re.search(r"\t(\d+)$", t))]
    assert len(nums) == len(toc) and nums == sorted(nums) and nums[0] >= 3


@pytest.mark.parametrize("market", ["global", "cn"])
def test_docx_headings_keep_with_next(market):
    from docx import Document

    doc = Document(io.BytesIO(_docx("compliance", market)))
    paras = doc.paragraphs
    for i, p in enumerate(paras):
        if p.style.name == "Heading 1" and p.text.strip():
            assert p.paragraph_format.keep_with_next or p.style.paragraph_format.keep_with_next
            if market == "cn":  # the gold rule under a chapter title must not detach it from the body
                assert paras[i + 1].paragraph_format.keep_with_next is True
