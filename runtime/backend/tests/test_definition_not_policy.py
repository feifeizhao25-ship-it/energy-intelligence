"""智9：技术定义不是政策拒答；国际库可见条数为 0 时要说明是待审核，不是空库。"""
from datetime import date

from app.library import store
from app.services import grounding


def test_lcoe_definition_is_not_refused_as_policy():
    assert grounding.is_definition_question("什么是LCOE")
    assert grounding.is_policy_question("什么是LCOE") is False
    answer = grounding.definition_reply("什么是度电成本", "cn")
    assert "度电成本" in answer
    assert "不是电价" in answer
    english = grounding.definition_reply("what is LCOE", "global")
    assert "Levelized cost of energy" in english
    assert "not a tariff" in english


def test_a_policy_question_is_still_a_policy_question():
    assert grounding.is_definition_question("补贴政策的文号是什么") is False
    assert grounding.is_policy_question("补贴政策的文号是什么") is True
    assert grounding.definition_reply("what is the investment tax credit", "global") is None


def test_global_library_zero_is_pending_review_not_an_empty_file():
    today = date.today()
    visible = store.annotated("global", today)
    hidden = store.annotated("global", today, include_hidden=True)
    pending = sum(
        1 for entry in hidden
        if entry["display"].get("state") == "pending" and not entry["display"].get("visible")
    )
    assert hidden, "the bundled international library file has entries"
    if not visible:
        assert pending == len(hidden)
