"""批3: RAG 自动刷新 — 可配置数据源(注册表 source_url), 离线注入 fetcher, 快照只待审核不覆盖语料."""
from datetime import date
from app.services import rag_refresh

SRC = {"source_id":"test-src","title":"T","lang":"en","type":"standard","source_url":"https://example.org/doc","license_note":"test"}

def fake_fetcher(url, timeout):
    return (url, 200, b"official content v2")

def test_fetch_snapshot_writes_sha_and_pending(tmp_path):
    r = rag_refresh.fetch_snapshot(SRC, fetcher=fake_fetcher, snapshot_dir=tmp_path, today=date(2026,10,18))
    assert r["status"] == "fetched_pending_review"
    assert r["sha256"] == rag_refresh.snapshot_sha256(b"official content v2")
    assert (tmp_path/"test-src.snapshot").exists()

def test_fetch_failure_is_reported_not_fabricated(tmp_path):
    def bad(url, timeout): raise RuntimeError("network down")
    r = rag_refresh.fetch_snapshot(SRC, fetcher=bad, snapshot_dir=tmp_path)
    assert r["status"] == "fetch_failed"

def test_refresh_report_still_available():
    rep = rag_refresh.refresh_report(today=date(2026,10,18))
    assert rep["total"] >= 1 and "refresh_needed" in rep
