"""I-11: every /ai/ask answer says in its own text where it stands: dated sources, or 'not verified'."""
import re
from datetime import date
from types import SimpleNamespace

from app.api.v1.ai_assistant import _provenance_footer

TODAY = date(2026, 11, 4)


def hit(title, org, when, url):
    return SimpleNamespace(title=title, metadata={"source_org": org, "published_at": when, "source_url": url})


def test_sources_with_publisher_date_and_link_are_appended_when_the_model_omitted_them():
    h = [hit("广东省新能源上网电价市场化改革实施方案", "广东省发展和改革委员会", "2025-09-19", "https://drc.gd.gov.cn/x")]
    out = _provenance_footer("江苏分时电价影响屋顶光伏收益 [S1]。", h, "cn", TODAY)
    assert "来源（检索于 2026-11-04）" in out
    assert "[S1] 广东省新能源上网电价市场化改革实施方案 | 广东省发展和改革委员会 | 记录中的日期：2025-09-19。日期类型：未标明。 | https://drc.gd.gov.cn/x" in out
    assert "发布日期" not in out and "Published" not in out


def test_source_the_model_already_printed_with_its_date_is_not_repeated():
    h = [hit("广东省新能源上网电价市场化改革实施方案", "广东省发展和改革委员会", "2025-09-19", "https://drc.gd.gov.cn/x")]
    answer = "来源：[S1] 广东省新能源上网电价市场化改革实施方案 | 2025-09-19"
    assert _provenance_footer(answer, h, "cn", TODAY) == ""


def test_answer_without_any_source_is_labelled_unverified_in_english_for_global():
    out = _provenance_footer("Use a dot as thousands separator.", [], "global", TODAY)
    assert "not verified" in out and "2026-11-04" in out
    assert not re.search(r"[\u4e00-\u9fff]", out)


def test_answer_without_any_source_is_labelled_in_chinese_for_cn():
    out = _provenance_footer("通用说明。", [], "cn", TODAY)
    assert "未核验" in out


def test_assumed_numbers_are_flagged_as_not_source_data():
    out = _provenance_footer("高峰时段电价：1.2元/千瓦时（假设值，具体以实际政策为准）", [], "cn", TODAY)
    assert "假设值" in out and "不是来源数据" in out
    en = _provenance_footer("Peak price: 0.2 $/kWh (assumed value)", [], "global", TODAY)
    assert "not source data" in en


def test_retrieved_but_uncited_documents_are_not_presented_as_support():
    h = [hit("充电基础设施建设意见", "国家发展和改革委员会", "2023-05-17", "https://x")]
    out = _provenance_footer("容量因子需结合项目所在地计算。", h, "cn", TODAY)
    assert "未核验" in out and "充电基础设施" not in out
