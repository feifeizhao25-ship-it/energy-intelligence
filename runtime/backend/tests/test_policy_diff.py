"""政策条款级差异、changelog 哈希链、以及「发布只认审批通过+摘要一致」不被新逻辑削弱。"""
import json
import sqlite3

import pytest

from app.services import policy_pipeline as pp
from app.services.policy_diff import diff_clauses, split_clauses

OLD = "一、总体思路 适应新型电力系统建设需要。二、分类完善容量电价机制 （一）煤电容量电价回收固定成本的比例提升至不低于30%。（二）抽水蓄能容量电价继续实行政府定价。三、组织实施 省级价格主管部门负责落实。"
NEW = "一、总体思路 适应新型电力系统建设需要。二、分类完善容量电价机制 （一）煤电容量电价回收固定成本的比例提升至不低于50%。（二）抽水蓄能容量电价继续实行政府定价。（三）建立电网侧独立新型储能容量电价机制。三、组织实施 省级价格主管部门负责落实。四、附则 自发布之日起执行。"


def test_split_keeps_hierarchy():
    keys = [c["key"] for c in split_clauses(OLD)]
    assert keys == ["一、", "二、", "二、（一）", "二、（二）", "三、"]
    assert [c["key"] for c in split_clauses("第一条 总则。第二条 适用范围。")] == ["第一条", "第二条"]
    assert split_clauses("没有任何条款标记的一段话")[0]["key"] == "正文"
    assert split_clauses("") == []


def test_clause_diff_reports_added_modified_unchanged():
    d = diff_clauses(OLD, NEW)
    assert d["changed"] is True
    assert [x["key"] for x in d["added"]] == ["二、（三）", "四、"]
    assert d["removed"] == []
    mod = {x["key"]: x for x in d["modified"]}
    assert "不低于30%" in mod["二、（一）"]["before"] and "不低于50%" in mod["二、（一）"]["after"]
    assert d["unchanged"] == 4
    assert d["summary"] == "新增2条，删除0条，修改1条，未变4条"
    assert diff_clauses(OLD, OLD)["changed"] is False
    assert [x["key"] for x in diff_clauses(OLD, OLD.replace("三、组织实施 省级价格主管部门负责落实。", ""))["removed"]] == ["三、"]


@pytest.fixture()
def conn(tmp_path, monkeypatch):
    monkeypatch.setenv("NENGJIAN_POLICY_CHANGELOG", str(tmp_path / "policy_changelog.jsonl"))
    c = pp.connect(tmp_path / "policy.sqlite")
    yield c
    c.close()


PAGE = {"source_id": "policy-x", "body": OLD, "region": "全国", "published": "2026-01-30", "applicability": "全国"}


def test_ingest_writes_clause_diff_and_hash_chained_changelog(conn, tmp_path):
    pp.ingest_pages(conn, [PAGE], "2026-10-30")
    res = pp.ingest_pages(conn, [{**PAGE, "body": NEW}], "2026-10-31")
    item = res["items"][0]
    assert item["diff"]["clauses"]["summary"] == "新增2条，删除0条，修改1条，未变4条"
    assert res["published"] == 0 and item["label"] == "待审批，尚未发布"
    from app.self_improve.store import Ledger

    ledger = Ledger(tmp_path / "policy_changelog.jsonl")
    rows = ledger.entries()
    assert [r["event"]["stage"] for r in rows] == ["staged", "staged"]
    assert rows[1]["event"]["clauses"].startswith("新增2条")
    assert ledger.verify() is True


def test_missing_metadata_is_rejected_and_logged(conn, tmp_path):
    res = pp.ingest_pages(conn, [{"source_id": "p", "body": "x"}], "2026-10-30")
    assert res["items"][0]["status"] == "rejected"
    from app.self_improve.store import Ledger

    assert Ledger(tmp_path / "policy_changelog.jsonl").entries()[0]["event"]["stage"] == "rejected"


def test_publish_still_requires_matching_approval_and_logs(conn, tmp_path):
    staged = pp.ingest_pages(conn, [PAGE], "2026-10-30")["items"][0]
    sha = staged["content_sha256"]
    with pytest.raises(PermissionError):
        pp.publish_approved(conn, "policy-x", sha, {"status": "timeout", "content_sha256": sha})
    with pytest.raises(PermissionError):
        pp.publish_approved(conn, "policy-x", sha, {"status": "approved", "content_sha256": "0" * 64})
    out = pp.publish_approved(conn, "policy-x", sha, {"status": "approved", "content_sha256": sha, "approval_id": "SP1"})
    assert out["status"] == "published" and "changelog_error" not in out
    from app.self_improve.store import Ledger

    stages = [r["event"]["stage"] for r in Ledger(tmp_path / "policy_changelog.jsonl").entries()]
    assert stages == ["staged", "published"]


def test_changelog_failure_is_reported_not_silent(conn, monkeypatch):
    staged = pp.ingest_pages(conn, [PAGE], "2026-10-30")["items"][0]
    monkeypatch.setenv("NENGJIAN_POLICY_CHANGELOG", "/proc/forbidden/changelog.jsonl")
    sha = staged["content_sha256"]
    out = pp.publish_approved(conn, "policy-x", sha, {"status": "approved", "content_sha256": sha})
    assert out.get("changelog_error")
