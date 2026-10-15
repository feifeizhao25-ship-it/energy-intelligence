"""审计 7-5：多源验证规则。"""
from app.services.evidence_envelope import (
    build_envelope, verify_numeric_claim, verify_policy_claim,
)

GOV = {"publisher": "国家能源局", "url": "https://www.nea.gov.cn/a.html"}
MEDIA = {"publisher": "中国能源报", "url": "https://www.cnenergynews.cn/x"}
REPOST = {"publisher": "某门户", "url": "https://news.example.com/y"}


def test_policy_official_plus_independent_is_verified():
    assert verify_policy_claim([GOV, MEDIA])[0] == "verified"


def test_policy_reposts_only_review():
    assert verify_policy_claim([MEDIA, REPOST])[0] == "review_recommended"


def test_policy_official_alone_review():
    assert verify_policy_claim([GOV])[0] == "review_recommended"


def test_numeric_agree_within_1pct():
    vals = [{"value": 0.5827, "publisher": "生态环境部"}, {"value": 0.5830, "publisher": "碳中和网"}]
    assert verify_numeric_claim(vals)[0] == "verified"


def test_numeric_conflict():
    vals = [{"value": 0.5827, "publisher": "生态环境部"}, {"value": 0.60, "publisher": "某机构"}]
    status, reason = verify_numeric_claim(vals)
    assert status == "conflict" and "待人工核验" in reason


def test_numeric_single_publisher_review():
    vals = [{"value": 1, "publisher": "A"}, {"value": 1, "publisher": "A"}]
    assert verify_numeric_claim(vals)[0] == "review_recommended"


def test_envelope_carries_label_and_blocks_conclusion():
    env = build_envelope("x", [REPOST])
    assert env["verification"]["label"] == "待核验"
    assert env["verification"]["usable_as_conclusion"] is False
    assert any("不得作为结论依据" in l for l in env["limitations"])
    ok = build_envelope("x", [GOV, MEDIA])
    assert ok["verification"]["label"] == "已核验"
    assert ok["sources"][0]["verification_label"] == "官方原文"
