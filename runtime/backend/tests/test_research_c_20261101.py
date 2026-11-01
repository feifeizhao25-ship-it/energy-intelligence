"""2026-11-01 研究补充（能源）：变好才上线闸门 / 版本发布与回滚 / 闸门任务 / 新暂存候选。
全部离线、确定性；闸门类开关在测试里打开，出厂保持关闭；POLICY_REVIEWERS 仍由负责人填写，这里只在测试环境里临时设置。"""
import json
from datetime import date, datetime, timedelta, timezone

import pytest

from app.library import releases, review_cli, store
from app.self_improve import continuous as C
from app.self_improve import promote_gate as PG
from app.self_improve.config import SILConfig

TZ = timezone(timedelta(hours=8))
NOW = datetime(2026, 11, 4, 7, 0, tzinfo=TZ)
ENV = {"POLICY_REVIEWERS": "zhangsan"}
TODAY = date(2026, 11, 1)


@pytest.fixture()
def lib(tmp_path, monkeypatch):
    monkeypatch.setenv("ENERGY_LIBRARY_DIR", str(tmp_path / "lib"))
    monkeypatch.setenv("SIL_DATA_DIR", str(tmp_path / "sil"))
    monkeypatch.delenv("POLICY_REVIEWERS", raising=False)
    monkeypatch.delenv("LIBRARY_PROMOTE_GATE", raising=False)
    return tmp_path


def good(**kw):
    e = {"id": "t-1", "title": "测试：全国绿证核发规模", "summary": "官方发布的绿证核发数据概括。", "points": ["本月核发若干个。"], "plain_tip": "看趋势。", "caution": "仅供了解，不构成投资建议。",
         "tags": ["绿证"], "probes": ["绿证核发了多少", "绿证规模数据"], "source": {"title": "公告", "publisher": "国家能源局", "url": "https://www.nea.gov.cn/x", "read_scope": "全文", "tier": "A"},
         "publish_date": "2026-10-29", "retrieved_at": "2026-10-31"}
    e.update(kw)
    return e


def cn_entries():
    return store.load_document("cn")["entries"]


def test_gate_keep_and_each_check_can_reject():
    assert PG.evaluate(good(), cn_entries(), today=TODAY)["decision"] == "keep"
    assert PG.evaluate(good(source={**good()["source"], "tier": "D"}), cn_entries(), today=TODAY)["decision"] == "reject"
    b = good(source={**good()["source"], "tier": "B"})
    assert PG.evaluate(b, cn_entries(), today=TODAY)["decision"] == "reject"
    assert PG.evaluate({**b, "second_source": {"url": "https://y"}}, cn_entries(), today=TODAY)["decision"] == "keep"
    assert PG.evaluate(good(summary="该项目稳赚不赔，年化收益保证 12%"), cn_entries(), today=TODAY)["decision"] == "reject"
    assert PG.evaluate(good(probes=[]), cn_entries(), today=TODAY)["decision"] == "reject"
    assert PG.evaluate(good(caution=""), cn_entries(), today=TODAY)["decision"] == "reject"
    assert PG.evaluate(good(id=cn_entries()[0]["id"]), cn_entries(), today=TODAY)["decision"] == "reject"


def test_gate_english_edition_safety():
    gl = store.load_document("global")["entries"]
    e = good(title="Green certificate issuance", summary="Official data summary.", points=["Issued this month."], plain_tip="Watch the trend.", caution="For understanding only; not investment advice.",
             probes=["how many green certificates were issued", "green certificate issuance data"], tags=["green certificate"],
             source={"title": "NEA", "publisher": "NEA", "url": "https://www.nea.gov.cn/x", "read_scope": "full", "tier": "A"})
    assert PG.evaluate(e, gl, today=TODAY, lang="en")["decision"] == "keep"
    bad = {**e, "summary": "You should buy now; guaranteed return."}
    r = PG.evaluate(bad, gl, today=TODAY, lang="en")
    assert r["decision"] == "reject" and r["safety"] == 0.0


def test_shipped_staged_candidates_verdicts_and_invisible():
    expect = {"cn": {"en-lib-s01": "keep", "en-lib-s04": "keep", "en-lib-s05": "keep"}, "global": {"en-intl-s01": "keep", "en-intl-s02": "keep", "en-intl-s03": "keep"}}
    for ed, lang in (("cn", "cn"), ("global", "en")):
        rep = PG.evaluate_all(store.load_staged(ed), store.load_document(ed)["entries"], today=TODAY, lang=lang)
        v = {r["id"]: r["decision"] for r in rep["rows"]}
        for k, want in expect[ed].items():
            assert v[k] == want, (ed, k, v[k])
        visible = {e["id"] for e in store.annotated(ed, TODAY, include_hidden=True)}
        assert not visible & {e["id"] for e in store.load_staged(ed)}
        for e in store.load_staged(ed):
            assert e["review_status"] in ("待审核", "Pending review") and e["source"]["url"].startswith("https://")
    ids = {e["id"] for e in store.load_staged("cn")}
    assert "en-lib-s06" not in ids and "en-lib-s04" in ids  # 重复的全国电力统计候选已被删除（工作文档里已有 en-lib-007）


def test_duplicate_of_existing_working_entry_is_rejected():
    e7 = next(e for e in cn_entries() if e["id"] == "en-lib-007")
    r = PG.evaluate(good(source={**good()["source"], "url": e7["source"]["url"]}), cn_entries(), today=TODAY)
    assert any("同一来源链接" in x for x in r["reasons"])


def test_release_chain_rollback_tamper(tmp_path):
    d = tmp_path
    doc1, doc2 = {"entries": [{"id": "a"}]}, {"entries": [{"id": "a"}, {"id": "b"}]}
    releases.record(d, doc1, action="baseline", entry_id="-", reviewer="zhangsan")
    releases.record(d, doc2, action="promote", entry_id="b", reviewer="zhangsan")
    assert releases.verify(d)["ok"]
    with pytest.raises(releases.ReleaseError):
        releases.rollback(d, 1, "zhangsan", "")
    assert releases.rollback(d, 1, "zhangsan", "回到基线") == doc1
    snap = d / "releases" / "0001.json"
    t = json.loads(snap.read_text("utf-8"))
    t["document"]["entries"].append({"id": "evil"})
    snap.write_text(json.dumps(t), "utf-8")
    assert not releases.verify(d)["ok"]
    with pytest.raises(releases.ReleaseError):
        releases.rollback(d, 2, "zhangsan", "x")


def test_cli_roundtrip_per_edition_and_rollback(lib):
    base = ["--edition", "cn"]
    assert review_cli.main(base + ["promote", "en-lib-s04", "--reviewer", "zhangsan"], env=ENV) == 0
    assert review_cli.main(base + ["approve", "en-lib-s04", "--reviewer", "zhangsan"], env=ENV) == 0
    rel = store.data_dir() / "releases" / "cn"
    assert [r["action"] for r in releases.list_releases(rel)] == ["baseline", "promote", "approve"] and releases.verify(rel)["ok"]
    assert not (store.data_dir() / "releases" / "global").exists()
    assert review_cli.main(base + ["rollback", "v1", "--reviewer", "zhangsan"], env=ENV) == 2
    assert review_cli.main(base + ["rollback", "v1", "--reviewer", "zhangsan", "--note", "演练"], env=ENV) == 0
    assert all(e["id"] != "en-lib-s04" for e in store.load_document("cn")["entries"])
    assert review_cli.main(base + ["releases", "-", "--reviewer", "zhangsan"], env=ENV) == 0
    assert review_cli.main(base + ["rollback", "v1", "--reviewer", "lisi", "--note", "x"], env=ENV) == 3  # 不在名单里仍然进不来


def put_reject_candidate():
    """A deliberately weak staged candidate (B-tier, one source) so the 'reject' path stays covered now that every shipped
    candidate passes: it goes into the data dir's own staged file, never into the package data."""
    d = store.data_dir()
    d.mkdir(parents=True, exist_ok=True)
    weak = {"id": "en-intl-t01", "title": "Test: weak single-source candidate", "summary": "Summary taken from a law-firm alert.", "points": ["One point."], "plain_tip": "Wait for a primary source.",
            "caution": "Test fixture, not advice.", "tags": ["test"], "probes": ["weak single source test candidate", "single source alert summary"],
            "source": {"title": "Alert", "publisher": "A law firm", "url": "https://www.mcguirewoods.com/x", "read_scope": "full", "read_via": "test", "tier": "B"},
            "publish_date": "2026-06-08", "retrieved_at": "2026-11-01", "review_status": "Pending review"}
    (d / "staged_entries_global.json").write_text(json.dumps({"entries": [weak]}), "utf-8")


def test_cli_gate_and_enforced_approve(lib):
    put_reject_candidate()
    assert review_cli.main(["--edition", "global", "gate", "en-intl-s01", "--reviewer", "zhangsan"], env=ENV) == 0
    assert review_cli.main(["--edition", "global", "gate", "en-intl-t01", "--reviewer", "zhangsan"], env=ENV) == 4
    assert review_cli.main(["--edition", "global", "promote", "en-intl-t01", "--reviewer", "zhangsan"], env=ENV) == 0
    env = {**ENV, "LIBRARY_PROMOTE_GATE": "1"}
    assert review_cli.main(["--edition", "global", "approve", "en-intl-t01", "--reviewer", "zhangsan"], env=env) == 2
    assert next(e for e in store.load_document("global")["entries"] if e["id"] == "en-intl-t01")["review_status"] == "Pending review"
    assert review_cli.main(["--edition", "global", "promote", "en-intl-s01", "--reviewer", "zhangsan"], env=ENV) == 0
    assert review_cli.main(["--edition", "global", "approve", "en-intl-s01", "--reviewer", "zhangsan"], env=env) == 0


def test_gate_job_off_by_default_and_never_writes_the_library(lib):
    put_reject_candidate()
    off = SILConfig(product="energy", enabled=False, data_dir=str(lib / "sil"))
    assert C.run_promote_gate(NOW, cfg=off) == {"status": "disabled"}
    on = SILConfig(product="energy", enabled=True, data_dir=str(lib / "sil"))
    r = C.run_promote_gate(NOW, cfg=on)
    assert r["status"] == "ok" and "en-lib-s04" in r["editions"]["cn"]["keep"] and "en-intl-t01" in r["editions"]["global"]["reject"] and "en-intl-s03" in r["editions"]["global"]["keep"]
    assert (lib / "sil" / "cn" / "promote_gate_report.md").exists() and (lib / "sil" / "global" / "promote_gate_report.json").exists()
    assert not (lib / "lib").exists() or not list((lib / "lib").glob("reference_entries_*.json"))
    assert C.run_promote_gate(NOW, cfg=on)["editions"]["cn"]["new_keep"] == []


def test_slot_registered():
    from app.self_improve.scheduler import next_run

    assert C.SLOTS["promote_gate"] == "weekly:WED@07:00" and "promote_gate" in C.jobs()
    assert next_run(C.SLOTS["promote_gate"], NOW).weekday() == 2
