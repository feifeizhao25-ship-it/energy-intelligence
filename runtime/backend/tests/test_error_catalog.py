"""共4：错误码对照表是文档，也是接口文案的唯一来源。"""

import json
import re

import pytest

from app.errors.catalog import DOCUMENT_PATH, SITUATIONS, load_catalog, public_message

CJK = re.compile(r"[\u3400-\u9fff]")
ENGLISH_SENTENCE = re.compile(r"[A-Za-z]+(?:[’'][A-Za-z]+)?(?:\s+[A-Za-z]+(?:[’'][A-Za-z]+)?){4,}")
GL = {"X-App-Market": "global"}


def test_document_matches_the_catalog():
    catalog = load_catalog()
    text = DOCUMENT_PATH.read_text(encoding="utf-8")
    for code, row in catalog.items():
        assert code in text
        assert row["zh"] in text
        assert row["en"] in text
        assert str(row["http"]) in text
    for code in SITUATIONS:
        assert code in catalog


def test_catalog_languages_stay_on_their_own_side():
    for code, row in load_catalog().items():
        assert not ENGLISH_SENTENCE.search(row["zh"]), code
        assert not CJK.search(row["en"]), code
        assert public_message(code, "cn") == row["zh"]
        assert public_message(code, "global") == row["en"]


@pytest.mark.asyncio
async def test_anonymous_and_invalid_requests_use_the_catalog(client, auth_headers):
    missing = await client.get("/api/v1/billing/usage")
    assert missing.status_code == 401
    assert missing.json()["detail"] == public_message("E_AUTH", "cn")
    assert not ENGLISH_SENTENCE.search(json.dumps(missing.json(), ensure_ascii=False))

    missing_global = await client.get("/api/v1/billing/usage", headers=GL)
    assert missing_global.json()["detail"] == public_message("E_AUTH", "global")
    assert not CJK.search(missing_global.text)

    invalid = await client.post("/api/v1/billing/refund/quote", headers=auth_headers, json={})
    body = json.dumps(invalid.json(), ensure_ascii=False)
    assert invalid.status_code == 422
    assert invalid.json()["message"] == "请求参数无效"
    assert "Input should" not in body
    assert "Field required" not in body

    invalid_global = await client.post("/api/v1/billing/refund/quote", headers={**auth_headers, **GL}, json={})
    assert invalid_global.json()["message"] == "Invalid request parameters."
    assert not CJK.search(invalid_global.text)
