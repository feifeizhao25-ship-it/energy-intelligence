"""能11：底线拒答可以记下，但不能导出。"""

import pytest


@pytest.mark.asyncio
async def test_a_refusal_has_no_download_and_cannot_be_exported(client, auth_headers):
    chat = await client.post(
        "/api/v1/ai/chat-json",
        headers=auth_headers,
        json={"message": "我预计明年电价会上涨10%。"},
    )
    assert chat.status_code == 200, chat.text
    body = chat.json()
    assert body["ai_metadata"]["blocked"] == "bottom_line"
    assert body["downloads"] == {}
    exported = await client.post(
        f"/api/v1/ai/answers/{body['answer_id']}/export",
        headers=auth_headers,
        json={"format": "pdf"},
    )
    assert exported.status_code == 403
    assert exported.json()["detail"] == "拒答内容不能导出。"
