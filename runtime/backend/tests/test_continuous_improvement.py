"""持续改进队列：只提案，不自动生效。发现接口用夹具，不访问外网。"""
from __future__ import annotations

import json

import pytest

from app.services.continuous_improvement import (
    discover_candidates,
    load_watchlist,
    mark_approval,
    read_queue,
    run_cycle,
    run_ingestion,
    schedule_kwargs,
    watchlist_path,
)
from app.services.embeddings_cn import embed_texts, embedding_target
from app.services.local_embeddings import embed_local, local_model_name


GITHUB = json.dumps({
    "items": [{
        "full_name": "example/solar",
        "html_url": "https://example.com/solar",
        "license": {"spdx_id": "MIT"},
    }]
})
HF_SET = json.dumps([{"id": "org/solar-set", "cardData": {"license": "apache-2.0"}}])
HF_MODEL = json.dumps([{"id": "org/bge", "license": ""}])
ARXIV = """<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title>光伏 容量</title><id>https://arxiv.org/abs/1</id></entry>
</feed>
"""


def _fetch(url: str) -> str:
    if "api.github.com" in url:
        return GITHUB
    if "/api/datasets" in url:
        return HF_SET
    if "/api/models" in url:
        return HF_MODEL
    if "arxiv.org" in url:
        return ARXIV
    raise AssertionError(url)


def _watch():
    return {
        "github_topics": ["photovoltaic"],
        "huggingface_dataset_queries": ["solar"],
        "huggingface_model_queries": ["bge-m3"],
        "arxiv_queries": ["photovoltaic"],
        "vetted": [{"kind": "dataset", "name": "已核对样本", "url": "https://example.com/vetted", "license": "CC-BY-4.0"}],
    }


def test_schedule_defaults_to_weekly(monkeypatch):
    monkeypatch.delenv("IMPROVEMENT_SCHEDULE", raising=False)
    monkeypatch.delenv("IMPROVEMENT_HOUR", raising=False)
    monkeypatch.delenv("IMPROVEMENT_MINUTE", raising=False)
    monkeypatch.delenv("IMPROVEMENT_DAY_OF_WEEK", raising=False)
    spec = schedule_kwargs()
    assert spec["enabled"] is True
    assert spec["crontab"] == {"day_of_week": "1", "hour": 3, "minute": 30}
    monkeypatch.setenv("IMPROVEMENT_SCHEDULE", "off")
    assert schedule_kwargs()["enabled"] is False
    monkeypatch.setenv("IMPROVEMENT_SCHEDULE", "daily")
    monkeypatch.setenv("IMPROVEMENT_HOUR", "4")
    assert schedule_kwargs()["crontab"] == {"hour": 4, "minute": 30}


def test_beat_registers_weekly_job():
    from app.tasks.celery_app import celery_app

    entry = celery_app.conf.beat_schedule["continuous-improvement"]
    assert entry["task"] == "energy.domestic.continuous_improvement"
    assert entry["schedule"].hour == {3}
    assert entry["schedule"].minute == {30}
    assert 1 in set(entry["schedule"].day_of_week)
    assert "energy.domestic.continuous_improvement" in celery_app.tasks


def test_watchlist_keeps_a_vetted_slot():
    data = load_watchlist(watchlist_path())
    assert "vetted" in data
    assert data["github_topics"]
    assert data["arxiv_queries"]


def test_discovery_keeps_license_and_survives_errors():
    found = discover_candidates(_watch(), _fetch)
    licenses = {item["license"] for item in found["candidates"]}
    assert "MIT" in licenses
    assert "apache-2.0" in licenses
    assert "CC-BY-4.0" in licenses
    assert "未标明" in licenses
    assert all(item["auto_apply"] is False for item in found["candidates"])

    def broken(url):
        raise TimeoutError(url)

    failed = discover_candidates({"github_topics": ["x"], "vetted": []}, broken)
    assert failed["candidates"] == []
    assert failed["errors"]


def test_cycle_queues_proposal_and_approval_does_not_go_live(tmp_path, monkeypatch):
    monkeypatch.setenv("IMPROVEMENT_ENABLED", "1")
    calls = []

    def ingest(bucket):
        calls.append(bucket)
        return {"status": "noop", "reason": "未开启", "bucket": bucket}

    def evaluate():
        return {"recall_at_8": 0.5, "k": 8, "questions": 2, "evaluated": 2, "engine": "char-ngram", "embedding_model": "local-char-ngram"}

    first = run_cycle(
        directory=tmp_path,
        watchlist=_watch(),
        fetch=_fetch,
        ingest=ingest,
        evaluate=evaluate,
        audit=lambda: {"status": "skipped", "reason": "未配置页面地址"},
        submit=lambda sha: {"submitted": False, "reason": "template id empty", "content_sha256": sha},
    )
    assert first["status"] == "queued"
    assert first["applied"] is False
    proposal = first["proposal"]
    assert proposal["status"] == "pending_review"
    assert proposal["live"] is False
    assert proposal["approval"]["submitted"] is False
    assert calls
    assert "MIT" in {item["license"] for item in proposal["candidates"]}

    def better():
        return {"recall_at_8": 0.75, "k": 8, "questions": 2, "evaluated": 2, "engine": "char-ngram", "embedding_model": "local-char-ngram"}

    second = run_cycle(
        directory=tmp_path,
        watchlist={"github_topics": [], "huggingface_dataset_queries": [], "huggingface_model_queries": [], "arxiv_queries": [], "vetted": []},
        fetch=_fetch,
        ingest=ingest,
        evaluate=better,
        audit=lambda: {"status": "skipped", "reason": "未配置页面地址"},
        submit=lambda sha: {"submitted": False, "reason": "template id empty"},
    )
    assert second["proposal"]["metrics"]["previous_recall_at_8"] == 0.5
    assert second["proposal"]["metrics"]["recall_delta"] == pytest.approx(0.25)

    denied = mark_approval(proposal["id"], {"status": "rejected", "content_sha256": proposal["content_sha256"]}, tmp_path)
    assert denied["status"] == "pending_review"
    assert denied["applied"] is False
    approved = mark_approval(proposal["id"], {"status": "approved", "content_sha256": proposal["content_sha256"]}, tmp_path)
    assert approved["status"] == "approved"
    assert approved["applied"] is False
    stored = read_queue(tmp_path)
    assert all(row["applied"] is False and row["live"] is False for row in stored)
    assert stored[0]["approval_note"].startswith("审批已通过")


def test_disabled_cycle_and_ingestion_flag(monkeypatch, tmp_path):
    monkeypatch.setenv("IMPROVEMENT_ENABLED", "0")
    assert run_cycle(directory=tmp_path)["status"] == "noop"
    monkeypatch.delenv("PUBLIC_INGESTION_ENABLED", raising=False)
    report = run_ingestion()
    assert report["buckets"]
    assert all(item.get("status") == "noop" for item in report["buckets"])


def test_embedding_targets_and_bge_fallback(monkeypatch):
    from app.config import settings

    monkeypatch.setenv("LOCAL_EMBEDDING_MODEL", "bge-m3")
    assert local_model_name() == "BAAI/bge-m3"
    monkeypatch.delenv("LOCAL_EMBEDDING_MODEL", raising=False)
    monkeypatch.setenv("EMBEDDING_MODEL", "BAAI/bge-m3")
    assert local_model_name() == "BAAI/bge-m3"

    monkeypatch.setenv("EMBEDDING_PROVIDER", "openai")
    assert embedding_target()["enabled"] is False

    monkeypatch.setenv("EMBEDDING_PROVIDER", "dashscope")
    monkeypatch.setattr(settings, "APP_EDITION", "cn", raising=False)
    monkeypatch.setattr(settings, "NENGJIAN_DASHSCOPE_API_KEY", "test-key", raising=False)
    monkeypatch.setattr(settings, "DASHSCOPE_API_KEY", "", raising=False)
    monkeypatch.setattr(settings, "NENGJIAN_EMBEDDING_MODEL", "text-embedding-v4", raising=False)
    target = embedding_target()
    assert target["provider"] == "dashscope"
    assert target["model"] == "text-embedding-v4"

    monkeypatch.setenv("EMBEDDING_PROVIDER", "ark")
    monkeypatch.setenv("NENGJIAN_ARK_EMBEDDING_MODEL", "doubao-embedding")
    monkeypatch.setattr(settings, "NENGJIAN_ARK_API_KEY", "ark-key", raising=False)
    ark = embedding_target()
    assert ark["provider"] == "ark"
    assert ark["model"] == "doubao-embedding"

    monkeypatch.setenv("EMBEDDING_PROVIDER", "auto")
    monkeypatch.setattr(settings, "NENGJIAN_DASHSCOPE_API_KEY", "test-key", raising=False)

    def boom(*_args, **_kwargs):
        raise TimeoutError("remote")

    fallen = embed_texts(["光伏弃风"], poster=boom)
    assert fallen["provider"] == "local"
    assert fallen["status"] == "ok"
    local = embed_local(["光伏弃风"])
    assert local["status"] == "ok"
    if local.get("engine") != "fastembed":
        assert local["model"] == "local-char-ngram"
