"""智10：OpenAPI 说明字段不再含中文；国际报告用 Letter，并嵌入中文字体。"""
import io
import re

import pytest

CJK = re.compile(r"[\u3400-\u9fff]")


def _walk_text_fields(node, found):
    if isinstance(node, dict):
        for key in ("description", "summary", "title"):
            value = node.get(key)
            if isinstance(value, str) and CJK.search(value):
                found.append(key)
        for value in node.values():
            _walk_text_fields(value, found)
    elif isinstance(node, list):
        for item in node:
            _walk_text_fields(item, found)


@pytest.mark.asyncio
async def test_openapi_descriptions_have_no_chinese(client):
    response = await client.get("/openapi.json")
    assert response.status_code == 200
    found = []
    _walk_text_fields(response.json(), found)
    assert found == []
    lcoe = response.json()["components"]["schemas"]["LCOERequest"]["properties"]["currency"]
    assert lcoe.get("default") is None


def test_global_pdf_is_letter_and_embeds_the_chinese_font():
    from pypdf import PdfReader

    from app.services import report_global

    model = {
        "title": "Font check",
        "cover": [("Project", "X")],
        "blocks": [("p", "水平面总辐射 GHI")],
    }
    payload = report_global.render_pdf(model)
    reader = PdfReader(io.BytesIO(payload))
    box = reader.pages[0].mediabox
    assert float(box.width) == pytest.approx(612, abs=1)
    assert float(box.height) == pytest.approx(792, abs=1)
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    assert "水平面总辐射" in text
