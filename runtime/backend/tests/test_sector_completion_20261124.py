"""九个板块的回归：腾讯地图默认、失效文号、官方模型、本地向量、语音、团队、风电未核验、国际计费英文。"""
import json
from datetime import datetime, timezone

import pytest

from app.services.billing_rules import schedule_downgrade
from app.services.bottom_line import blocked_input_text
from app.services.domestic_resource import wind_response_fields
from app.services.language_guard import CJK
from app.services.local_embeddings import local_model_name
from app.services.map_tiles import map_tiles
from app.services.rag_service import RAGService
from app.services.speech_audio import speech_wav, text_from_wav
from app.services import team_workspace
from app.services.vector_rescue import enabled


def test_tencent_is_the_default_domestic_map_and_the_key_stays_off_the_url():
    class Cfg:
        APP_EDITION = "cn"
        MAP_TILE_PROVIDER = ""
        MAP_TILE_URL = ""
        TIANDITU_KEY = ""
        GAODE_MAP_KEY = ""
        TENCENT_MAP_KEY = ""

    missing = map_tiles(Cfg())
    assert missing == {"enabled": False, "reason": "key-unset", "provider": "tencent"}
    Cfg.TENCENT_MAP_KEY = "secret-key"
    enabled_map = map_tiles(Cfg())
    assert enabled_map["enabled"] is True and enabled_map["provider"] == "tencent"
    assert "secret-key" not in json.dumps(enabled_map)
    assert "key=" not in enabled_map["template"]


def test_expired_280_is_labeled_and_not_treated_as_current():
    query = "发改能源规〔2021〕280号"
    notices = RAGService().named_expired_notices(query, "cn")
    assert notices and notices[0]["status"] == "已失效"
    assert "已失效" in notices[0]["notice"]
    assert "现行依据" in notices[0]["notice"]
    hits = RAGService().search(query, top_k=5, market="cn").hits
    assert "policy-cn-fgnyg-2021-280" not in {hit.source_id for hit in hits}
    from app.api.v1.ai_assistant import _reverification_note

    note = _reverification_note(query, "cn", False)
    assert "已失效" in note


def test_capacity_price_question_is_not_blocked_and_investment_still_is():
    assert blocked_input_text("容量电价怎么定") is None
    assert blocked_input_text("这个项目值得投吗") is not None


def test_local_embedding_defaults_to_bge_small_zh(monkeypatch):
    monkeypatch.delenv("LOCAL_EMBEDDING_MODEL", raising=False)
    monkeypatch.delenv("EMBEDDING_MODEL", raising=False)
    assert local_model_name() == "BAAI/bge-small-zh-v1.5"
    monkeypatch.setenv("RAG_VECTOR_RESCUE", "0")
    assert enabled() is False


def test_speech_wav_is_playable_and_round_trips():
    wav = speech_wav("容量电价怎么定")
    assert wav.startswith(b"RIFF") and b"WAVE" in wav[:16]
    assert text_from_wav(wav) == "容量电价怎么定"


def test_team_workspace_has_no_sample_seats(tmp_path, monkeypatch):
    monkeypatch.setenv("TEAM_WORKSPACE_PATH", str(tmp_path / "team.json"))
    view = team_workspace.view("owner-1", "free", "账户所有者")
    assert view["limit"] == 1
    assert view["seats"] == [{"id": "owner-1", "label": "账户所有者", "role": "admin"}]
    assert "示例" not in json.dumps(view, ensure_ascii=False)
    full = team_workspace.invite("owner-1", "free", "member-2", "member", "账户所有者")
    assert full["ok"] is False and full["reason"] == "席位已满"
    opened = team_workspace.invite("owner-1", "team", "member-2", "readonly_advisor", "账户所有者")
    assert opened["ok"] is True
    assert any(seat["role"] == "readonly_advisor" for seat in opened["seats"])


def test_global_downgrade_rule_has_no_chinese():
    quote = schedule_downgrade(
        current_plan="pro",
        target_plan="free",
        current_expires_at=datetime(2027, 1, 1, tzinfo=timezone.utc),
        now=datetime(2026, 11, 24, tzinfo=timezone.utc),
        market="global",
    )
    assert not CJK.search(quote["rule"])
    assert "term" in quote["rule"].lower()


def test_domestic_wind_response_is_explicitly_unverified():
    fields = wind_response_fields(39.9, 116.41)
    assert fields["verification_status"] == "unverified"
    assert "未核验" in fields["verification_note"]
    assert "ITC" in fields["verification_note"]


@pytest.mark.asyncio
async def test_library_search_returns_expired_280(monkeypatch):
    monkeypatch.setenv("NENGJIAN_INTERNAL_TOKEN", "tok")
    from app.api.v1.domestic_product import LibrarySearchIn, domestic_library_search

    out = await domestic_library_search(LibrarySearchIn(query="发改能源规〔2021〕280号"), x_internal_token="tok")
    assert out["expired"]
    assert out["expired"][0]["status"] == "已失效"
    assert "policy-cn-fgnyg-2021-280" not in {item["id"] for item in out["sources"]}
