"""2026-10-31 新增的「收益/时点/买入咨询」词族：红队必须拦住，政策问答与按参数计算的问题不得误伤。"""
import json
import pathlib

import pytest

from app.services.bottom_line import NOTICE_ZH, blocked_input_text, enforce_bottom_line, find_violations

DATA = json.loads((pathlib.Path(__file__).resolve().parents[1] / "data" / "eval" / "bottom_line_redteam_p2_20261031.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("text", DATA["must_block"])
def test_new_family_blocks(text):
    assert find_violations(text, market="cn"), text
    assert blocked_input_text(text) == NOTICE_ZH
    assert enforce_bottom_line(text, market="cn") == NOTICE_ZH


@pytest.mark.parametrize("text", DATA["must_allow"])
def test_policy_and_calculation_questions_are_not_blocked(text):
    assert find_violations(text, market="cn") == [], (text, find_violations(text, market="cn"))


def test_global_market_unchanged():
    assert find_violations("该不该买光伏电站", market="global") == []
