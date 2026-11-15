"""中文 Word 标题层级：1 后面才能到 2，2 后面才能到 3。"""
import io

from docx import Document

from app.routers.reports import TEMPLATES, _demo_data, calc_financial_metrics, generate_docx


def _levels(report_type: str) -> list[int]:
    data = _demo_data()
    payload = generate_docx(
        data,
        report_type,
        TEMPLATES[report_type],
        calc_financial_metrics(data["financial"]),
        "公式层级测试",
        "confidential",
        "cn",
    )
    document = Document(io.BytesIO(payload))
    levels = []
    for paragraph in document.paragraphs:
        name = paragraph.style.name or ""
        if name.startswith("Heading ") and paragraph.text.strip():
            levels.append(int(name.split()[-1]))
    text = "\n".join(paragraph.text for paragraph in document.paragraphs)
    assert "计算公式" in text
    assert "NPV" in text
    return levels


def test_cn_report_heading_outline_does_not_skip():
    for report_type in ("feasibility", "investment"):
        levels = _levels(report_type)
        assert 1 in levels and 2 in levels and 3 in levels
        previous = 0
        for level in levels:
            assert level <= previous + 1, (report_type, levels)
            previous = level
