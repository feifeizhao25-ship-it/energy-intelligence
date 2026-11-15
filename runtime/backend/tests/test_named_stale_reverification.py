"""A query that names a stale-excluded document must say the library record is awaiting re-verification.

Provincial and other documents may still be shown, under their own titles. The stale record stays out of citations.
The clock is frozen; production freshness still uses the wall clock.
"""
import os
import subprocess
import sys
from datetime import date
from pathlib import Path

import pytest

from app.api.v1 import ai_assistant as aa
from app.services.rag_service import RAGService

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "list_overdue_sources.py"
REGISTRY = ROOT / "data" / "rag_sources.json"
QUERY = "136号文 机制电价 存量 增量"
NATIONAL_NUMBER = "发改价格〔2025〕136号"


def _load_script():
    import importlib.util

    spec = importlib.util.spec_from_file_location("list_overdue_sources", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.usefixtures("library_clock_past_review_window")
def test_named_136_is_disclosed_and_other_documents_keep_their_titles():
    hits = RAGService().search(QUERY, top_k=3, market="cn", exclude_stale=True).hits
    assert hits
    assert all(hit.source_id != "policy-cn-136" for hit in hits)
    for hit in hits:
        assert hit.metadata.get("doc_number") != NATIONAL_NUMBER
        assert NATIONAL_NUMBER not in (hit.title or "")

    labels = RAGService().named_stale_labels(QUERY, "cn")
    assert labels == ["136号文"]

    retrieved = aa._retrieve(QUERY, "cn")
    shown, evidence, _expired = aa._library_stand_in(QUERY, retrieved, "cn", None)
    assert "资料库记录正在等待重新核验" in shown
    assert "136号文" in shown
    assert "policy-cn-136" not in shown
    assert NATIONAL_NUMBER not in shown
    assert all(source.get("source_id") != "policy-cn-136" for source in evidence.get("sources") or [])
    for hit in retrieved:
        assert hit.title in shown
        assert hit.metadata.get("doc_number") != NATIONAL_NUMBER


@pytest.mark.usefixtures("library_clock_past_review_window")
def test_model_path_says_the_record_is_awaiting_reverification_without_calling_a_model():
    hits = aa._retrieve(QUERY, "cn")
    prompt = aa._grounded_prompt(aa.CN_SYSTEM_PROMPT, hits, "cn", query=QUERY)
    assert "资料库记录正在等待重新核验" in prompt
    assert "不得把检索到的其他文件写成该文件" in prompt
    assert "policy-cn-136" not in prompt
    shown, _expired = aa._finish_answer("省级文件规定了竞价办法。", hits, "cn", query=QUERY)
    assert "资料库记录正在等待重新核验" in shown
    assert "136号文" in shown
    assert "policy-cn-136" not in shown
    assert NATIONAL_NUMBER not in shown
    assert all(hit.source_id != "policy-cn-136" for hit in hits)


@pytest.mark.usefixtures("library_clock_past_review_window")
def test_english_named_notice_uses_english_and_keeps_the_stale_source_out():
    query = "How does IRS Notice 2025-42 define beginning of construction?"
    hits = aa._retrieve(query, "global")
    shown, evidence, _expired = aa._library_stand_in(query, hits, "global", None)
    assert "awaiting re-verification" in shown
    assert "Notice 2025-42" in shown
    assert "policy-us-itc" not in shown
    assert all(source.get("source_id") != "policy-us-itc" for source in evidence.get("sources") or [])
    for hit in hits:
        assert hit.source_id != "policy-us-itc"
        assert hit.title in shown
    prompt = aa._grounded_prompt(aa.SYSTEM_PROMPT, hits, "global", query=query)
    assert "awaiting re-verification" in prompt
    assert "Do not present any other document as the named one" in prompt
    finished, _expired = aa._finish_answer("See the notice for the physical work test.", hits, "global", query=query)
    assert "The library record for \"IRS Notice 2025-42\" is awaiting re-verification." in finished


@pytest.mark.usefixtures("library_clock_inside_review_window")
def test_inside_the_window_a_named_document_is_not_described_as_awaiting_reverification():
    hits = aa._retrieve(QUERY, "cn")
    assert hits and hits[0].source_id == "policy-cn-136"
    assert RAGService().named_stale_labels(QUERY, "cn") == []
    shown, _evidence, _expired = aa._library_stand_in(QUERY, hits, "cn", None)
    assert "等待重新核验" not in shown
    prompt = aa._grounded_prompt(aa.CN_SYSTEM_PROMPT, hits, "cn", query=QUERY)
    assert "等待重新核验" not in prompt


@pytest.mark.usefixtures("library_clock_past_review_window")
def test_a_query_that_does_not_name_136_does_not_claim_it_is_awaiting_reverification():
    query = "广东新能源机制电价竞价"
    assert RAGService().named_stale_labels(query, "cn") == []
    shown, evidence, _expired = aa._library_stand_in(query, aa._retrieve(query, "cn"), "cn", None)
    assert "等待重新核验" not in shown
    assert "policy-cn-136" not in shown
    assert all(source.get("source_id") != "policy-cn-136" for source in evidence.get("sources") or [])


@pytest.mark.usefixtures("library_clock_past_review_window")
def test_ambiguous_short_number_does_not_rename_a_different_document():
    assert RAGService().named_stale_labels("42号文", "cn") == []
    labels = RAGService().named_stale_labels("发改能源〔2025〕1360号", "cn")
    assert all("136号文" not in label for label in labels)
    assert "policy-cn-136" not in labels


def test_overdue_list_is_read_only_and_uses_the_given_day():
    before = REGISTRY.read_bytes()
    module = _load_script()
    past = module.overdue_sources(date(2026, 11, 16))
    by_id = {row["id"]: row for row in past}
    assert by_id["policy-cn-136"] == {
        "id": "policy-cn-136",
        "last_verified_at": "2026-10-15",
        "interval": 30,
        "days_overdue": 2,
    }
    assert "policy-us-itc" in by_id
    assert "policy-cn-136" not in {row["id"] for row in module.overdue_sources(date(2026, 11, 7))}
    assert "policy-cn-gd-yfgjg-2025-263" not in by_id
    assert REGISTRY.read_bytes() == before

    env = {key: value for key, value in os.environ.items()
           if not (key.endswith("_API_KEY") or key.startswith("MINIMAX_") or key.startswith("NENGJIAN_"))}
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--as-of", "2026-11-16"],
        capture_output=True, text=True, cwd=str(ROOT), env=env, check=False,
    )
    assert result.returncode == 0, result.stderr
    assert "id\tlast_verified_at\tinterval\tdays_overdue" in result.stdout
    assert "policy-cn-136\t2026-10-15\t30\t2" in result.stdout
    assert REGISTRY.read_bytes() == before
