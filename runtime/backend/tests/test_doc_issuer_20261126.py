"""能15：文号和发文机关只改对照过公开页面的，其余标待审核。"""
import json
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "data" / "rag_sources.json"


def _by_id():
    data = json.loads(PATH.read_text(encoding="utf-8"))
    return {item["source_id"]: item for item in data["sources"]}


def test_document_266_issuer_matches_the_ndrc_page():
    entry = _by_id()["policy-cn-fgyx-2021-266"]
    assert entry["doc_number"] == "发改运行〔2021〕266号"
    assert entry["issuer"] == "国家发展和改革委员会"
    assert entry["authors"] == "国家发展和改革委员会"
    assert entry["content"].startswith("国家发展和改革委员会关于引导")
    assert entry["review_status"] == "待审核"
    assert "ndrc.gov.cn" in entry["issuer_check"]


def test_distributed_pv_number_matches_the_nea_page():
    entry = _by_id()["policy-cn-nonum-152179d7"]
    assert entry["doc_number"] == "国能发新能规〔2025〕7号"
    assert "（国能发新能规〔2025〕7号）" in entry["content"]
    assert "原文未标注文号" not in entry["content"]
    assert entry["review_status"] == "待审核"
    assert "nea.gov.cn" in entry["issuer_check"]


def test_peak_storage_opinion_is_not_given_an_invented_number():
    entry = _by_id()["policy-cn-nonum-663a5dbb"]
    assert entry["doc_number"] == "待审核"
    assert "待审核：公开页标题未见文号" in entry["content"]
    assert "发改能源" not in entry["doc_number"]
    assert entry["review_status"] == "待审核"
