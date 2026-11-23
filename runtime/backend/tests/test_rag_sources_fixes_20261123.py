"""核13/14/18：rag_sources 错配佐证、过期状态、缺文号（2026-11-23）。"""
import json
from datetime import date
from pathlib import Path

from app.services.rag_service import RAGService

DATA = json.loads((Path(__file__).resolve().parents[1] / "data" / "rag_sources.json").read_text("utf-8"))
BY = {s["source_id"]: s for s in DATA["sources"]}


def test_mismatched_corroboration_removed():
    assert "std-gb50797" not in (BY["policy-cn-136"].get("corroborated_by") or [])
    assert "policy-cn-136" not in (BY["std-gb50797"].get("corroborated_by") or [])
    assert "price-us-eia" not in (BY["price-cn-module"].get("corroborated_by") or [])


def test_expired_marked_invalid_and_still_not_retrieved():
    for sid in ("policy-cn-fgnyg-2021-280", "policy-cn-gnztxn-2024-124", "policy-cn-fgbjg-2021-809", "policy-cn-gnfjg-2020-79"):
        s = BY[sid]
        assert s["status"] == "失效" and s["expiry_date"] < "2026-11-23" and "届满" in s["needs_human_verification"]
    hits = RAGService().search("代理购电 809号文", top_k=5, market="cn").hits
    assert "policy-cn-fgbjg-2021-809" not in {h.source_id for h in hits}


def test_60_61_reviewed_before_expiry():
    for sid in ("policy-cn-gnfjgg-2021-60", "policy-cn-gnfjgg-2021-61"):
        s = BY[sid]
        assert s["review_due"] <= "2026-12-01" < s["expiry_date"] and "2026-12-20" in s["needs_human_verification"]


def test_distributed_pv_measures_doc_number():
    s = BY["policy-cn-nonum-152179d7"]
    assert s["doc_number"] == "国能发新能规〔2025〕7号"
    assert any("gov.cn/zhengce/zhengceku/202502/content_7004206" in m["url"] for m in s["mirror_urls"])
    # 只按文号检索排第一要配合核10 的精确匹配加权（另一个 PR）；这里只要求带标题时在前 3
    hits = RAGService().search("国能发新能规〔2025〕7号 分布式光伏发电开发建设管理办法", top_k=3, market="cn").hits
    assert "policy-cn-nonum-152179d7" in {h.source_id for h in hits}


def test_govcn_mirrors_are_reprints_not_corroboration():
    mirrors = [m for s in DATA["sources"] for m in (s.get("mirror_urls") or []) if "www.gov.cn" in m["url"]]
    assert len(mirrors) >= 60
    assert all("不算独立佐证" in m["note"] for m in mirrors)
