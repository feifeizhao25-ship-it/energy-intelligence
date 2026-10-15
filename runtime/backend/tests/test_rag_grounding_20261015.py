"""RAG：中文分词、先检索后生成、136号文 / OBBBA 语料已按原文校正。"""
import json
from pathlib import Path

from app.api.v1 import ai_assistant as aa
from app.services.rag_service import RAGService, tokenize

DATA = json.loads((Path(__file__).resolve().parents[1] / "data" / "rag_sources.json").read_text("utf-8"))
BY_ID = {s["source_id"]: s for s in DATA["sources"]}


def test_chinese_tokenize_produces_bigrams():
    toks = tokenize("新能源上网电价 ITC 2025")
    assert {"新能", "电价", "itc", "2025"} <= toks


def test_chinese_query_retrieves_136():
    hits = RAGService().search("新能源上网电价市场化改革 机制电价", top_k=3, market="cn").hits
    assert hits[0].source_id == "policy-cn-136"
    assert hits[0].score > 0


def test_english_query_retrieves_obbba():
    hits = RAGService().search("solar tax credit 48E beginning of construction", top_k=3, market="global").hits
    assert hits[0].source_id == "policy-us-itc"


def test_136_entry_matches_primary_source():
    d = BY_ID["policy-cn-136"]
    assert "发改价格〔2025〕136号" in d["title"]
    assert d["source_url"] == "https://www.ndrc.gov.cn/xxgk/zcfb/tz/202502/t20250209_1396066.html"
    assert "2025年6月1日" in d["content"] and d["published_at"] == "2025-02-09"
    assert "分布式光伏并网管理细则" not in d["title"]


def test_us_itc_entry_reflects_obbba():
    d = BY_ID["policy-us-itc"]
    c = d["content"]
    assert "December 31, 2025" in c and "July 4, 2026" in c and "December 31, 2027" in c
    assert d["source_url"].startswith("https://www.irs.gov/")


def test_prompt_is_grounded_before_generation():
    hits = aa._retrieve("136号文 机制电价 存量 增量", "cn")
    assert hits and all(h.score > 0 for h in hits)
    prompt = aa._grounded_prompt(aa.CN_SYSTEM_PROMPT, hits, "cn")
    assert "[S1]" in prompt and "ndrc.gov.cn" in prompt


def test_no_hits_prompt_forbids_citations():
    prompt = aa._grounded_prompt(aa.SYSTEM_PROMPT, [], "global")
    assert "no matching document" in prompt
    env = aa._evidence_for("x", [])
    assert env["sources"] == []
