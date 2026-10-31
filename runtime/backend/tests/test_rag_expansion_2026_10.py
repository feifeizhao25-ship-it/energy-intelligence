"""2026-10-30 来源扩充的守门测试：字段齐全、哈希一致、只收官方域名、不含投资建议措辞、新鲜度与到期仍然严格。"""
import hashlib
import json
from datetime import date, timedelta
from urllib.parse import urlparse

from app.services.eval_runner import ROOT
from app.services.rag_sources import SourceRegistry, VALID_TYPES

OFFICIAL_HOSTS = {
    "www.ndrc.gov.cn", "zfxxgk.nea.gov.cn", "www.nea.gov.cn", "www.stats.gov.cn",
    "drc.gd.gov.cn", "www.shanghai.gov.cn", "fgw.sh.gov.cn", "fgw.beijing.gov.cn",
    "www.beijing.gov.cn", "gb.shandong.gov.cn", "fgw.weihai.gov.cn",
}
ADVICE_TERMS = ("建议投资", "建议买入", "买入评级", "投资评级", "保证收益", "稳赚", "收益率承诺", "值得投资", "推荐购买")
TRACE_FIELDS = ("source_url", "publish_date", "retrieved_at", "review_due", "last_verified_at", "verify_interval_days", "snapshot_sha256")


def _new_sources():
    reg = SourceRegistry.from_file()
    return reg, [s for s in reg.sources if s.get("evidence_status") == "auto_extracted"]


def test_registry_is_valid_and_larger_than_before():
    reg, new = _new_sources()
    assert reg.validate() == []
    assert len(reg.sources) == 125  # 124 + stat-cn-nea-renewable-202608（2026-10-31）
    assert len(new) == 113
    assert "statistic" in VALID_TYPES


def test_every_new_source_carries_traceability_fields():
    _, new = _new_sources()
    for s in new:
        for field in TRACE_FIELDS:
            assert s.get(field) not in (None, ""), (s["source_id"], field)
        retrieved = date.fromisoformat(s["retrieved_at"])
        assert retrieved == date(2026, 10, 30)
        assert date.fromisoformat(s["review_due"]) == retrieved + timedelta(days=s["verify_interval_days"]), s["source_id"]
        date.fromisoformat(s["publish_date"])
        assert s["needs_human_verification"], s["source_id"]
        assert s.get("expert_signed") in (None, False), s["source_id"]


def test_new_sources_are_official_https_or_http_hosts_only():
    _, new = _new_sources()
    for s in new:
        parsed = urlparse(s["source_url"])
        assert parsed.scheme in ("http", "https") and parsed.hostname in OFFICIAL_HOSTS, s["source_id"]
        for mirror in s.get("mirror_urls") or []:
            assert urlparse(mirror["url"]).hostname in OFFICIAL_HOSTS, (s["source_id"], mirror)


def test_snapshot_hash_matches_content_and_no_advice_wording():
    _, new = _new_sources()
    for s in new:
        assert s["snapshot_sha256"] == hashlib.sha256(s["content"].encode()).hexdigest(), s["source_id"]
        for term in ADVICE_TERMS:
            assert term not in s["content"] and term not in s["title"], (s["source_id"], term)
        for own in ("needs_human_verification", "snapshot_note", "license_note"):
            assert "预测" not in s[own] and "建议" not in s[own], (s["source_id"], own)


def test_source_types_and_intervals():
    _, new = _new_sources()
    for s in new:
        if s["type"] == "statistic":
            assert s["verify_interval_days"] == 45
        else:
            assert s["type"] == "policy" and s["verify_interval_days"] == 90


def test_expired_new_sources_are_not_current():
    _, new = _new_sources()
    today = date(2026, 10, 30).isoformat()
    for s in new:
        if s.get("expiry") and s["expiry"] < today:
            assert s["status"] == "待核实", s["source_id"]
            assert s.get("expiry_basis")


def test_new_sources_turn_stale_after_review_window():
    reg, new = _new_sources()
    later = date(2027, 6, 1)
    assert all(reg.freshness_of(s, today=later) == "stale" for s in new)
    assert all(reg.freshness_of(s, today=date(2026, 10, 30)) == "current" for s in new)


def test_existing_core_records_untouched():
    reg, _ = _new_sources()
    for sid in ("policy-cn-114", "policy-cn-136", "policy-cn-688"):
        assert reg.get(sid)["evidence_status"] != "auto_extracted"
    assert reg.get("policy-cn-114")["evidence_status"] == "legacy_unreviewed"


def test_golden_expand_questions_are_grounded_in_registry_text():
    rows = [json.loads(line) for line in (ROOT / "data" / "eval" / "golden_expand_v1.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(rows) >= 20
    reg = SourceRegistry.from_file()
    for r in rows:
        blob = " ".join(str(reg.get(ref["source_id"])["content"]) for ref in r["required_sources"])
        assert all(x in blob for x in r["must_include"]), r["id"]
        assert r["expert_signed"] is False and r["draft"] is True
