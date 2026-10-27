"""P0：引用核验、来源元数据、黄金集、场景、计算夹具、时效、出境开关、标识。"""
import json
from datetime import date
from pathlib import Path

from app.services.aigc_label import (
    AIGC_FIELDS, aigc_record, build_docx_bytes, build_jpeg_with_xmp, build_pdf_bytes,
    build_video_metadata, explicit_text, read_docx_custom,
)
from app.services.citation_checker import all_unsupported_downgraded, check_answer, numbers_match_source
from app.services.eval_scenarios import run_all
from app.services.evidence_envelope import present_claim
from app.services.freshness_board import badge, compliance_report, load_sla
from app.services.overseas_gate import overseas_live_allowed
from app.services.rag_service import RAGService
from app.services.rag_sources import SourceRegistry

ROOT = Path(__file__).resolve().parents[1]


def test_rag_sources_match_schema_v2():
    registry = SourceRegistry.from_file()
    assert registry.validate() == []
    schema = json.loads((ROOT / "data" / "schemas" / "rag_source.schema.json").read_text())
    required = schema["required"]
    for source in registry.sources:
        for field in required:
            assert field in source, source["source_id"]
    gb = registry.get("std-gb50797")
    assert "设计标准" in gb["title"]
    assert gb["effective_date"] == "2025-04-01"
    storage = registry.get("policy-cn-storage")
    assert storage["status"] == "待核实"
    assert storage["document_url_status"] == "待核实"
    assert registry.get("price-cn-module")["quote_policy"] == "withdrawn"
    for source in registry.sources:
        if source["lang"] == "en":
            assert source["jurisdiction"] == "海外"


def test_domestic_search_hides_overseas_unless_named():
    service = RAGService()
    domestic = {hit.source_id for hit in service.search("分布式光伏并网要求", market="cn").hits}
    assert "policy-us-itc" not in domestic
    assert "std-ieee1547" not in domestic
    corpus = [{
        "source_id": "overseas-sample", "lang": "cn", "type": "policy", "title": "美国税收抵免",
        "content": "美国税收抵免摘要", "version": "v", "locator": "1", "year": 2026,
        "last_verified_at": "2026-10-01", "verify_interval_days": 90, "jurisdiction": "海外",
        "countries": ["us"], "evidence_status": "legacy_unreviewed",
    }]
    local = RAGService(corpus=corpus, registry=SourceRegistry(corpus))
    assert local.search("分布式光伏并网要求", market="cn").hits == []
    assert local.search("美国税收抵免", market="cn").hits


def test_golden_set_shape_and_sources():
    rows = [json.loads(line) for line in (ROOT / "data" / "eval" / "golden_v1.jsonl").read_text().splitlines() if line.strip()]
    counts = {}
    registry = SourceRegistry.from_file()
    for row in rows:
        counts[row["category"]] = counts.get(row["category"], 0) + 1
        assert row["question"] and row["must_include"] and row["as_of"]
        assert row["expert_signed"] is False
        for ref in row["required_sources"]:
            assert registry.get(ref["source_id"])
    assert counts == {"policy": 120, "calculation": 60, "timeliness": 40, "refusal": 40}


def test_citation_checker_downgrades_unsupported_numbers():
    source = {"content": "发改价格〔2025〕136号以2025年6月1日区分存量。", "version": "发改价格〔2025〕136号"}
    good = check_answer("发改价格〔2025〕136号以2025年6月1日区分存量[S1]。", [source])
    assert numbers_match_source("发改价格〔2025〕136号", source)
    assert good["sentences"][0]["label"] == "支持"
    bad = check_answer("组件价格是 1.23 元。[S1]", [source])
    assert bad["sentences"][0]["shown"] == "未在已收录原文中找到出处"
    assert bad["sentences"][0]["status"] == "待核验"
    assert all_unsupported_downgraded(bad)
    assert bad["citation_recall"] >= 0 or bad["downgraded"] == 1


def test_conflict_is_shown_not_picked():
    view = present_claim([
        {"value": 0.4, "publisher": "甲电网", "url": "https://a.example/a"},
        {"value": 0.8, "publisher": "乙电网", "url": "https://b.example/b"},
    ])
    assert view["label"] == "冲突"
    assert view["picked"] is None
    assert len(view["sources"]) == 2


def test_aigc_four_file_kinds(tmp_path):
    record = aigc_record("report-demo-1")
    assert set(AIGC_FIELDS) <= set(record)
    assert "人工智能生成合成" in explicit_text()
    docx = tmp_path / "a.docx"
    docx.write_bytes(build_docx_bytes(record))
    assert read_docx_custom(docx) == record
    pdf = build_pdf_bytes(record)
    jpeg = build_jpeg_with_xmp(record)
    video = build_video_metadata(record)
    for blob in (pdf, jpeg, video):
        text = blob.decode("utf-8", errors="ignore")
        for key in AIGC_FIELDS:
            assert key in text


def test_scenarios_cover_and_pass():
    report = run_all()
    assert report["gaps"] == []
    assert report["passed"] is True
    assert len(report["results"]) == 32


def test_calc_reference_tolerances():
    payload = json.loads((ROOT / "tests" / "reference" / "calc_reference.json").read_text())
    assert payload["label"] == "示例数据"
    assert len(payload["solar"]) == 30
    assert len(payload["finance"]) == 10
    assert len(payload["wind"]) == 10
    assert len(payload["storage"]) == 10
    assert payload["pysam"] is None
    for case in payload["solar"]:
        assert case["relative_gap"] <= 0.03
        assert case["label"] == "示例数据"


def test_freshness_sla_and_badges():
    sla = load_sla()
    assert {item["id"] for item in sla["types"]} >= {"policy", "agency_tariff", "tou_window", "standard", "statistics", "irradiance", "literature"}
    assert badge("2026-10-20", 90, today=date(2026, 10, 27))["level"] == "valid"
    assert badge("2026-01-01", 90, today=date(2026, 10, 27))["level"] == "expired"
    assert badge("2026-10-27", 10, today=date(2026, 10, 22))["usable"] is False
    board = compliance_report([], today=date(2026, 10, 27))
    assert all(row["status"] == "未连接" for row in board["types"])


def test_overseas_live_requires_three_switches(monkeypatch):
    monkeypatch.setattr("app.services.overseas_gate.settings.APP_EDITION", "cn")
    monkeypatch.delenv("OVERSEAS_LIVE", raising=False)
    monkeypatch.delenv("OVERSEAS_PRIVACY_ACK", raising=False)
    monkeypatch.delenv("OVERSEAS_PIA_RECORD", raising=False)
    assert overseas_live_allowed() is False
    monkeypatch.setenv("OVERSEAS_LIVE", "1")
    monkeypatch.setenv("OVERSEAS_PRIVACY_ACK", "1")
    assert overseas_live_allowed() is False
    monkeypatch.setenv("OVERSEAS_PIA_RECORD", "1")
    assert overseas_live_allowed() is True


def test_publish_module_has_no_skip_switch():
    text = (ROOT / "ops" / "publish.py").read_text(encoding="utf-8")
    assert "skip" not in text.lower()
    assert "bypass" not in text.lower()


def test_province_profiles_are_unverified_not_invented():
    payload = json.loads((ROOT / "data" / "province_profiles.json").read_text(encoding="utf-8"))
    assert payload["label"] == "待核实"
    assert len(payload["provinces"]) == 31
    for row in payload["provinces"]:
        for field in row["fields"].values():
            assert field["display"] == "待核实"
            assert field["value"] in (None, "")
            assert field["source_url"] in (None, "")
