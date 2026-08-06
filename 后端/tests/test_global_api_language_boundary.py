"""Global API output must never expose CN-market strings."""

from app.middleware import _sanitize_global_payload
import pytest


def test_global_payload_recursively_removes_cjk():
    payload = {
        "message": "请求参数无效",
        "nested": ["English remains", {"title": "新能源项目"}],
    }
    result = _sanitize_global_payload(payload)
    assert result["message"] == "Content is unavailable for the Global market."
    assert result["nested"][0] == "English remains"
    assert result["nested"][1]["title"] == "Content is unavailable for the Global market."


def test_global_payload_removes_cjk_keys_too():
    result = _sanitize_global_payload({"结果": "ok"})
    assert result == {"localized_field": "ok"}


@pytest.mark.asyncio
async def test_global_http_validation_response_contains_no_cjk(client, monkeypatch):
    import app.middleware as middleware_module

    monkeypatch.setattr(middleware_module.settings, "MARKET_REGION", "global")
    response = await client.post("/api/v1/auth/register", json={})
    assert response.status_code == 422
    serialized = response.text
    assert not any("\u3400" <= char <= "\u9fff" for char in serialized)
    assert "Content is unavailable for the Global market." in serialized
