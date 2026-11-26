"""能16：没有模型时，回答要带上检索到的条款节选，并写明这不是模型生成的。"""
from app.api.v1.ai_assistant import _library_stand_in
from app.services.rag_service import RAGHit


def test_cn_stand_in_includes_the_clause_excerpt():
    hit = RAGHit("policy-cn-sample", 
        "分布式光伏发电开发建设管理办法",
        "第一条 为促进分布式光伏发电高质量发展，助力构建新型电力系统，制定本办法。",
        1.0,
        {"published_at": "2025-01-17"},
    )
    shown, evidence, _expired = _library_stand_in("分布式光伏怎么定义", [hit], "cn", None)
    assert "检索到的条款节选" in shown
    assert "不是模型生成的回答" in shown
    assert "第一条" in shown
    assert "分布式光伏发电" in shown
    assert evidence["sources"]


def test_global_stand_in_includes_the_excerpt_in_english():
    hit = RAGHit("irs-notice-2025-42",
        "IRS Notice 2025-42",
        "This notice provides the beginning-of-construction rules for wind and solar facilities.",
        1.0,
        {"published_at": "2025-08-15", "date_kind": "printed_on_page"},
    )
    shown, _evidence, _expired = _library_stand_in("beginning of construction", [hit], "global", None)
    assert "retrieved excerpt" in shown
    assert "not a model answer" in shown
    assert "beginning-of-construction" in shown


def test_empty_library_does_not_invent_an_excerpt():
    shown, evidence, _expired = _library_stand_in("一个库里没有的问题", [], "cn", None)
    assert "本库尚未收录相关资料。" in shown
    assert "条款节选" not in shown
    assert evidence["sources"] == []
