"""CN Word export, opened with python-docx.

The model is not called. Answer text comes from the library stand-in over the
checked-in source file. Project reports use that same source plus the demo
project fixture, through generate_docx and the report download route.
"""
import ast
import inspect
import io
import json
from pathlib import Path

import pytest
from docx import Document
from docx.oxml.ns import qn

from app.api.v1 import ai_assistant as ask_api
from app.routers import reports as R
from app.services.answer_export import render_answer_file

RAG_SOURCES = Path(__file__).resolve().parents[1] / "data" / "rag_sources.json"
SOURCE_ID = "policy-cn-688"
ANSWER_QUERY = "能源保供中长期合同管理办法"

FEASIBILITY_HEADINGS = [
    (1, "第一章  项目概述"),
    (2, "1.1 项目背景"),
    (2, "1.2 项目目标"),
    (2, "1.3 项目基本信息"),
    (1, "第二章  资源评估"),
    (2, "2.1 太阳能/风能资源概况"),
    (2, "2.2 发电量预测"),
    (1, "第三章  技术方案"),
    (2, "3.1 系统设计"),
    (2, "3.2 主要设备选型"),
    (1, "第四章  财务分析"),
    (2, "4.1 投资估算"),
    (2, "4.2 核心财务指标"),
    (3, "计算公式"),
    (2, "4.3 前10年净现金流"),
    (1, "第五章  风险评估"),
    (2, "风险矩阵"),
    (1, "第六章  方法与假设"),
    (1, "附录"),
    (2, "A. 假设条件"),
    (2, "B. 数据来源"),
    (2, "C. 免责声明"),
]
INVESTMENT_HEADINGS = [
    (1, "第一章  执行摘要"),
    (1, "第二章  已发布数据"),
    (2, "2.1 已发布装机统计"),
    (2, "2.2 电价数据来源"),
    (3, "计算公式"),
    (1, "第三章  财务测算"),
    (1, "第四章  敏感性分析"),
    (1, "第五章  排放核算"),
    (1, "第六章  测算结果"),
    (1, "附录"),
    (2, "A. 假设条件"),
    (2, "B. 数据来源"),
    (2, "C. 免责声明"),
]
COMPLIANCE_HEADINGS = [
    (1, "第一章  法规清单"),
    (1, "第二章  许可证状态"),
    (1, "第三章  环境影响评估"),
    (1, "第四章  土地使用分析"),
    (1, "第五章  电网接入方案"),
    (1, "附录"),
    (2, "A. 假设条件"),
    (2, "B. 数据来源"),
    (2, "C. 免责声明"),
]
ESG_HEADINGS = [
    (1, "第一章  碳排放与减排"),
    (1, "第二章  社会影响"),
    (1, "第三章  公司治理"),
    (1, "第四章  SDG 对接"),
    (1, "第五章  持续改进"),
    (1, "附录"),
    (2, "A. 假设条件"),
    (2, "B. 数据来源"),
    (2, "C. 免责声明"),
]

FEASIBILITY_HEADERS = [
    ["项目参数", "数值"],
    ["年份", "预计发电量"],
    ["设备类别", "规格（示例）", "数量"],
    ["财务指标", "数值"],
    ["指标", "数值", "对照"],
    ["年度", "净现金流"],
    ["假设参数", "数值"],
]
INVESTMENT_HEADERS = [
    ["核心指标", "数值", "行业基准"],
    ["电价变动", "调整后 IRR", "IRR 变化"],
    ["假设参数", "数值"],
]
COMPLIANCE_HEADERS = [
    ["法规名称", "适用范围", "核对状态"],
    ["许可证/批文", "主管部门", "状态", "参考周期（经验估计）"],
    ["假设参数", "数值"],
]
ESG_HEADERS = [
    ["减排指标", "年度值", "25年累计"],
    ["治理维度", "实施情况"],
    ["SDG 目标", "项目贡献"],
    ["假设参数", "数值"],
]

PROJECT_REPORTS = [
    ("feasibility", FEASIBILITY_HEADINGS, FEASIBILITY_HEADERS),
    ("investment", INVESTMENT_HEADINGS, INVESTMENT_HEADERS),
    ("compliance", COMPLIANCE_HEADINGS, COMPLIANCE_HEADERS),
    ("esg", ESG_HEADINGS, ESG_HEADERS),
]

SOLAR = {
    "capacity_mw": 100,
    "capex_per_w": 1.1,
    "opex_per_kw_yr": 17,
    "electricity_price": 45,
    "capacity_factor": 0.25,
    "currency": "CNY",
}


def _legal_paragraph(fn) -> str:
    """The disclaimer string the generator itself writes, not a paraphrase."""
    tree = ast.parse(inspect.getsource(fn))
    found = [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant)
        and isinstance(node.value, str)
        and "不是经人工签字的审核结论，也不填写审核人。" in node.value
    ]
    assert len(found) == 1
    return found[0]


def _source_fixture() -> dict:
    rows = json.loads(RAG_SOURCES.read_text(encoding="utf-8"))["sources"]
    row = next(item for item in rows if item["source_id"] == SOURCE_ID)
    excerpt = row["content"].strip()[:24]
    return {
        "title": row["title"],
        "url": row["source_url"],
        "authors": row.get("authors"),
        "published_at": row.get("published_at"),
        "locator": row.get("locator"),
        "retrieved_at": row.get("last_verified_at") or "2026-10-31",
        "excerpt": excerpt,
        "source_org": row.get("source_org"),
        "license_note": "政府公开发布文件，引用须给出原文链接。",
        "evidence_status": row.get("evidence_status"),
    }


def _structural_run(run_elm) -> bool:
    tags = {qn("w:fldChar"), qn("w:instrText"), qn("w:br"), qn("w:drawing"), qn("w:pict")}
    return any(child.tag in tags for child in run_elm.iter())


def _assert_runs_hold_text(paragraph):
    """Visible characters survive the file round trip.

    python-docx maps a line break to ``\\n`` and a page break to nothing. A run
    with no text is a defect when it sits in a paragraph that also has text
    (the table cells used to start with one). A blank spacer paragraph is not.
    """
    pieces = []
    for child in paragraph._p.xpath("w:r | w:hyperlink"):
        text = child.text or ""
        if child.tag == qn("w:hyperlink"):
            assert text.strip(), f"empty hyperlink in {paragraph.text!r}"
            assert "\ufffd" not in text
            pieces.append(text)
            continue
        if not text:
            if _structural_run(child) or not paragraph.text:
                continue
            raise AssertionError(f"empty run in {paragraph.text!r}")
        assert "\ufffd" not in text
        pieces.append(text)
    assert "".join(pieces) == paragraph.text


def _assert_chinese_intact(document):
    for paragraph in document.paragraphs:
        _assert_runs_hold_text(paragraph)
    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                for paragraph in cell.paragraphs:
                    _assert_runs_hold_text(paragraph)
    for section in document.sections:
        for part in (section.header, section.footer):
            for paragraph in part.paragraphs:
                _assert_runs_hold_text(paragraph)
    full = "\n".join(p.text for p in document.paragraphs)
    assert "\ufffd" not in full
    assert any("\u4e00" <= ch <= "\u9fff" for ch in full)


def _heading_outline(document):
    outline = []
    for paragraph in document.paragraphs:
        name = paragraph.style.name or ""
        if not name.startswith("Heading "):
            continue
        level = name.split()[-1]
        if level.isdigit() and paragraph.text.strip():
            outline.append((int(level), paragraph.text))
    return outline


def _table_headers(document):
    return [[cell.text for cell in table.rows[0].cells] for table in document.tables]


def _hyperlink_targets(document):
    return [
        rel.target_ref
        for rel in document.part.rels.values()
        if "hyperlink" in rel.reltype
    ]


def _assert_project_docx(payload: bytes, headings, headers, source: dict, disclaimer: str):
    document = Document(io.BytesIO(payload))
    assert _heading_outline(document) == headings
    assert _table_headers(document) == headers
    for table, expected in zip(document.tables, headers, strict=True):
        for cell, header in zip(table.rows[0].cells, expected, strict=True):
            assert [run.text for run in cell.paragraphs[0].runs] == [header]
    paragraphs = [paragraph.text for paragraph in document.paragraphs]
    assert paragraphs.count(disclaimer) == 1
    assert source["title"] in "\n".join(paragraphs)
    assert source["excerpt"] in "\n".join(paragraphs)
    assert f"页码/段落：{source['locator']}" in "\n".join(paragraphs)
    assert source["url"] in _hyperlink_targets(document)
    _assert_chinese_intact(document)
    assert "甘肃省" in "\n".join(paragraphs)
    assert "酒泉市" in "\n".join(paragraphs)


def _project_payload(report_type: str, source: dict) -> bytes:
    data = R._demo_data()
    data["data_sources"] = [source]
    metrics = R.calc_financial_metrics(data["financial"])
    return R.generate_docx(
        data,
        report_type,
        R.TEMPLATES[report_type],
        metrics,
        "结构测试报告",
        "confidential",
        "cn",
    )


@pytest.mark.parametrize("report_type,headings,headers", PROJECT_REPORTS)
def test_cn_project_report_docx_structure(report_type, headings, headers):
    source = _source_fixture()
    disclaimer = _legal_paragraph(R._add_appendix)
    assert disclaimer.startswith("本报告基于公开资料和项目方提供的数据编制，仅供参考。")
    _assert_project_docx(_project_payload(report_type, source), headings, headers, source, disclaimer)


@pytest.mark.asyncio
async def test_cn_project_report_download_matches_the_same_structure(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setenv("REPORTS_DIR", str(tmp_path))
    source = _source_fixture()
    created = await client.post("/api/v1/projects", headers=auth_headers, json={
        "name": "酒泉光伏测算",
        "technology": "solar",
        "capacity_kw": 100000,
        "location": {"latitude": 39.7, "longitude": 98.5, "address": "甘肃省酒泉市"},
    })
    assert created.status_code == 201, created.text
    project_id = created.json()["data"]["id"]
    saved = await client.post(
        f"/api/v1/finance/models/{project_id}",
        headers=auth_headers,
        json={**SOLAR, "data_sources": [source]},
    )
    assert saved.status_code == 200, saved.text
    generated = await client.post("/api/v1/reports/generate", headers=auth_headers, json={
        "project_id": project_id,
        "report_type": "feasibility",
        "format": "docx",
    })
    assert generated.status_code == 200, generated.text
    report_id = generated.json()["data"]["report_id"]
    status = await client.get(f"/api/v1/reports/{report_id}", headers=auth_headers)
    assert status.json()["data"]["status"] == "completed"
    downloaded = await client.get(f"/api/v1/reports/{report_id}/file", headers=auth_headers)
    assert downloaded.status_code == 200
    assert downloaded.content[:2] == b"PK"
    _assert_project_docx(
        downloaded.content,
        FEASIBILITY_HEADINGS,
        FEASIBILITY_HEADERS,
        source,
        _legal_paragraph(R._add_appendix),
    )


@pytest.mark.asyncio
@pytest.mark.usefixtures("library_clock_inside_review_window")
async def test_cn_answer_docx_export_uses_library_text_not_a_model(client, auth_headers, monkeypatch):
    async def unavailable(message, system_prompt, *, market):
        raise RuntimeError("Global AI provider is not configured")

    monkeypatch.setattr(ask_api.ai_assistant, "chat_openai_with_metadata", unavailable)
    disclaimer = _legal_paragraph(render_answer_file)
    assert disclaimer == "本文件由软件根据上述回答和来源生成，不是经人工签字的审核结论，也不填写审核人。"

    chat = await client.post("/api/v1/ai/chat-json", headers=auth_headers, json={"message": ANSWER_QUERY})
    assert chat.status_code == 200, chat.text
    body = chat.json()
    assert body["ai_metadata"]["model_called"] is False
    assert body["sources"], body
    exported = await client.post(
        f"/api/v1/ai/answers/{body['answer_id']}/export",
        headers=auth_headers,
        json={"format": "docx"},
    )
    assert exported.status_code == 200, exported.text
    document = Document(io.BytesIO(exported.content))
    texts = [paragraph.text for paragraph in document.paragraphs if paragraph.text.strip()]
    assert texts[0] == "AI 回答导出"
    assert document.paragraphs[0].runs[0].bold is True
    assert texts.index("未调用模型。本文件重复资料库记录或无来源说明，不是正式模型回答。") < texts.index(disclaimer)
    assert texts.index(disclaimer) < texts.index("来源")
    targets = _hyperlink_targets(document)
    for source in body["sources"]:
        assert source["title"] in "\n".join(texts)
        url = source.get("url") or ""
        assert url.startswith("http")
        assert url in targets
        citation = next(text for text in texts[texts.index("来源") + 1:] if url in text)
        assert source["title"] in citation
    _assert_chinese_intact(document)
    assert "本报告基于公开资料" not in "\n".join(texts)
    assert "免费档水印版本" not in "\n".join(texts)
