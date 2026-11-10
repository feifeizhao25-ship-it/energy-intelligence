"""报告减排量在已知省份时用公告 2025 年第 47 号附件表 3，与 CA-001 手算一致。"""
import io

import pytest
from docx import Document

from app.routers import reports as R
from app.services.emission_units import avoided_wan_ton, factor_sentence, resolve_grid_factor


def _tonnes(mwh: float, province: str | None) -> float:
    return avoided_wan_ton(mwh * 1000, province=province) * 10_000


def test_hand_cases_match_the_existing_table():
    jiangsu, jiangsu_sentence = resolve_grid_factor("江苏省")
    yunnan, yunnan_sentence = resolve_grid_factor("云南")
    tibet, tibet_sentence = resolve_grid_factor("西藏自治区")
    blank, blank_sentence = resolve_grid_factor(None)
    assert jiangsu == pytest.approx(0.5827)
    assert yunnan == pytest.approx(0.1333)
    assert _tonnes(1_000, "江苏省") == pytest.approx(582.7, abs=1e-6)
    assert _tonnes(1_000, "云南") == pytest.approx(133.3, abs=1e-6)
    assert _tonnes(1_000, "西藏自治区") == pytest.approx(530.6, abs=1e-6)
    assert _tonnes(1_000, None) == pytest.approx(530.6, abs=1e-6)
    assert "江苏" in jiangsu_sentence and "省级" in jiangsu_sentence and "0.5306" not in jiangsu_sentence
    assert "云南" in yunnan_sentence and "省级" in yunnan_sentence
    assert "未收录西藏" in tibet_sentence and "全国电力平均" in tibet_sentence and tibet == 0.5306
    assert "全国电力平均" in blank_sentence and "省级" not in blank_sentence and blank == 0.5306
    assert factor_sentence("江苏省") == jiangsu_sentence


def _text(data) -> str:
    metrics = R.calc_financial_metrics(data["financial"])
    raw = R.generate_docx(data, "investment", R.TEMPLATES["investment"], metrics, "测算", "内部")
    doc = Document(io.BytesIO(raw))
    return "\n".join(p.text for p in doc.paragraphs)


def test_jiangsu_report_states_the_provincial_basis():
    data = R._demo_data()
    data["province_or_region"] = "江苏省"
    data["city"] = "南京市"
    data["financial"]["annual_generation_mwh"] = 1_000
    text = _text(data)
    assert "江苏省级电力平均二氧化碳排放因子 0.5827" in text
    assert "全国电力平均二氧化碳排放因子 0.5306" not in text


def test_tibet_report_states_the_national_fallback():
    data = R._demo_data()
    data["province_or_region"] = "西藏自治区"
    data["city"] = "拉萨市"
    data["financial"]["annual_generation_mwh"] = 1_000
    text = _text(data)
    assert "全国电力平均二氧化碳排放因子 0.5306" in text
    assert "未收录西藏" in text
    assert "省级电力平均二氧化碳排放因子 0." not in text
