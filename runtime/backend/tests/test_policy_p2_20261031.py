"""2026-10-31 政策条目更新与新题集：688号文条款摘录逐字来自政府网站正文、NEA 数据点、新题集可检索且有出处，题集与既有评测集互斥。"""
import hashlib
import json
from urllib.parse import urlparse

from app.services.eval_runner import ROOT
from app.services.rag_sources import SourceRegistry
from app.services import retrieval_eval as re_

NEW_IDS = ("policy-cn-688", "stat-cn-nea-renewable-202608")
ADVICE_TERMS = ("建议投资", "建议买入", "买入评级", "投资评级", "保证收益", "稳赚", "收益率承诺", "值得投资", "推荐购买")


def _rows():
    path = ROOT / "data" / "eval" / "golden_p2_20261031.jsonl"
    return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines() if x.strip()]


def test_updated_entries_are_valid_hashed_and_official():
    reg = SourceRegistry.from_file()
    assert reg.validate() == []
    for sid in NEW_IDS:
        s = reg.get(sid)
        assert s["evidence_status"] == "official_text_read" and s["status"] == "现行"
        assert s["snapshot_sha256"] == hashlib.sha256(s["content"].encode()).hexdigest()
        assert urlparse(s["source_url"]).hostname in ("www.gov.cn", "www.nea.gov.cn")
        assert s["needs_human_verification"]  # 仍须人工复核，不是专家签字
        assert s.get("expert_signed") in (None, False)
        assert not any(t in s["content"] for t in ADVICE_TERMS)


def test_688_key_clauses_and_open_flags():
    s = SourceRegistry.from_file().get("policy-cn-688")
    for needle in ("不低于60%", "不低于30%、2030年前不低于35%", "不超过总可用发电量的20%", "不得向公共电网反送电", "不得由电网企业代理购电", "不纳入新能源可持续发展价格结算机制"):
        assert needle in s["content"], needle
    assert "施行日期" in s["needs_human_verification"] and "待核" in s["needs_human_verification"]
    assert s["mirror_urls"][0]["note"].endswith("仍待核")


def test_new_questions_are_grounded_and_disjoint_from_existing_sets():
    reg = SourceRegistry.from_file()
    rows = _rows()
    assert len(rows) >= 20
    for r in rows:
        blob = " ".join(str(reg.get(ref["source_id"])["content"]) for ref in r["required_sources"])
        assert all(x in blob for x in r["must_include"]), r["id"]
        assert r["expert_signed"] is False and r["draft"] is True
    ids = {r["id"] for r in rows}
    qs = {r["question"] for r in rows}
    for name in ("golden_v1.jsonl", "golden_gate_v1.jsonl", "heldout_v1.jsonl", "golden_expand_v1.jsonl", "golden_p114_v1.jsonl"):
        other = [json.loads(x) for x in (ROOT / "data" / "eval" / name).read_text(encoding="utf-8").splitlines() if x.strip()]
        assert not ids & {o["id"] for o in other}, name
        assert not qs & {o["question"] for o in other}, name


def test_new_questions_are_retrievable_in_top8():
    docs = re_.load_corpus()
    report = re_.evaluate(docs, _rows())
    assert report["recall_at_8"] == 1.0, [x for x in report["rows"] if x.get("recall") != 1.0]
