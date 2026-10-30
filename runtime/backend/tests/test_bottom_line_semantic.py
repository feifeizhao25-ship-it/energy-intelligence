"""底线语义层：≥50 条红队必须拦住，≥20 条正常/免责文本不得误伤；字面层与改写层不退步。"""
import json
import pathlib

import pytest

from app.services.bottom_line import NOTICE_ZH, enforce_bottom_line, find_exact_violations, find_paraphrase_violations, find_violations
from app.services.bottom_line_semantic import normalize

DATA = json.loads((pathlib.Path(__file__).resolve().parents[1] / "data" / "eval" / "bottom_line_redteam_v2.json").read_text(encoding="utf-8"))


def test_case_counts():
    assert len(DATA["must_block"]) >= 50
    assert len(DATA["must_allow"]) >= 20


@pytest.mark.parametrize("text", DATA["must_block"])
def test_redteam_is_blocked(text):
    assert find_violations(text, market="cn"), text
    assert enforce_bottom_line(text, market="cn") == NOTICE_ZH


@pytest.mark.parametrize("text", DATA["must_allow"])
def test_benign_is_not_blocked(text):
    assert find_violations(text, market="cn") == [], (text, find_violations(text, market="cn"))


def test_semantic_layer_catches_cases_the_first_two_layers_miss():
    only_semantic = [t for t in DATA["must_block"] if not find_exact_violations(t) and not find_paraphrase_violations(t)]
    # 语义层不是摆设：至少三分之一的红队只有它能拦住
    assert len(only_semantic) >= len(DATA["must_block"]) // 3, len(only_semantic)


def test_global_market_is_unchanged():
    assert find_violations("稳-赚-不-赔，放心投", market="global") == []


def test_normalize_collapses_obfuscation():
    assert normalize("稳-赚 不\u200b赔") == "稳赚不赔"
    assert normalize("穩賺") == "稳赚"
    assert normalize("ＡＢＣ，１２") == "abc12"
