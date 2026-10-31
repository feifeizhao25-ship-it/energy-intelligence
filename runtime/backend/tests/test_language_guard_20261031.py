"""The CJK-in-international-responses counter (observability, never alters a response)."""
import json

import pytest

from app.services import language_guard as lg

G = {"X-App-Market": "global"}


@pytest.fixture(autouse=True)
def _reset():
    lg.reset()
    yield
    lg.reset()


def test_record_counts_only_cjk_and_keeps_no_content():
    assert lg.record("/api/x", 200, "all english 123") == 0
    assert lg.record("/api/y", 200, "中文 mixed 内容") == 4
    snap = lg.snapshot()
    assert snap["global_json_responses"] == 2 and snap["with_cjk"] == 1 and snap["rate"] == 0.5
    assert snap["top_paths"] == [{"path": "/api/y", "count": 1}]
    assert "中文" not in json.dumps(snap, ensure_ascii=False)


@pytest.mark.asyncio
async def test_international_client_with_chinese_in_json_is_counted_and_response_is_unchanged(client, auth_headers):
    r = await client.get("/api/v1/projects", headers={**auth_headers, **G})
    assert r.status_code == 200
    base = lg.snapshot()["global_json_responses"]
    assert base >= 1
    # a 404 detail in Chinese on an international client is exactly what the counter exists to find
    miss = await client.get("/api/v1/finance/data-sources/does-not-exist", headers={**auth_headers, **G})
    assert miss.status_code == 404
    snap = lg.snapshot()
    assert snap["global_json_responses"] == base + 1 and snap["with_cjk"] >= 1
    assert any(p["path"].endswith("/does-not-exist") for p in snap["top_paths"])
    assert "不存在" in miss.json()["detail"]  # the body is passed through unchanged


@pytest.mark.asyncio
async def test_domestic_clients_are_not_inspected(client, auth_headers):
    await client.get("/api/v1/finance/data-sources/does-not-exist", headers=auth_headers)
    await client.get("/api/v1/finance/data-sources/does-not-exist", headers={**auth_headers, "X-App-Market": "cn"})
    assert lg.snapshot()["global_json_responses"] == 0


@pytest.mark.asyncio
async def test_status_endpoint_exposes_the_counter(client):
    await client.get("/api/v1/status", headers=G)
    st = (await client.get("/api/v1/status")).json()
    assert {"global_json_responses", "with_cjk", "rate", "top_paths"} <= set(st["language_guard"])


@pytest.mark.asyncio
async def test_escaped_chinese_in_json_is_counted(client, monkeypatch):
    from fastapi import Response
    from app.main import app

    @app.get("/__lg_test_escaped")
    async def _escaped():
        return Response(content=json.dumps({"m": "你好"}), media_type="application/json")  # ensure_ascii=True escapes

    r = await client.get("/__lg_test_escaped", headers=G)
    assert r.status_code == 200
    assert lg.snapshot()["with_cjk"] == 1
