"""P1 收尾与 P2：召回实测、推送窗口、按日回看。不访问网络。"""
import math
from datetime import datetime, timedelta, timezone

from app.ingestion.access_routes import blocked_reason
from app.ingestion.runner import expand_dated_url
from app.services.as_of_view import effective_on
from app.services.cohort_browse import visible_cohorts
from app.services.plan_alias import canonical_plan_id, stored_plan_id
from app.services.retrieval_eval import evaluate, load_corpus, load_questions
from app.utils.financial_utils import calc_optimal_cleaning_interval
from ops.procurement import open_procurement
from ops.push_cadence import allow_push, load_table, salutation

SH = timezone(timedelta(hours=8))


def test_blocked_routes_stay_blocked_and_permitted_routes_pass():
    assert blocked_reason("https://power.larc.nasa.gov/api/temporal/monthly/point") 
    assert blocked_reason("https://export.arxiv.org/api/query")
    assert blocked_reason("https://arxiv.org/api/query")
    assert blocked_reason("https://arxiv.org/oai2?verb=Identify")
    assert blocked_reason("https://zenodo.org/api/records?q=photovoltaic")
    assert blocked_reason("https://overpass-api.de/api/interpreter")
    assert blocked_reason("https://download.geofabrik.de/asia/china-latest.osm.pbf")
    assert blocked_reason("https://arxiv.org/rss/physics.app-ph") == ""
    assert blocked_reason("https://zenodo.org/oai2d?verb=ListRecords") == ""
    assert blocked_reason("https://download.geofabrik.de/asia/china.html") == ""
    assert expand_dated_url("https://zenodo.org/oai2d?from={from}&until={until}", "2026-10-27T01:00:00+00:00") == (
        "https://zenodo.org/oai2d?from=2026-10-26&until=2026-10-27"
    )


def test_retrieval_recall_is_measured_from_the_corpus():
    docs = load_corpus()
    questions = load_questions()
    report = evaluate(docs, questions)
    assert report["hardcoded"] is False
    assert report["questions"] == 260
    assert report["evaluated"] > 0
    assert report["recall_at_8"] is not None
    assert 0 <= report["recall_at_8"] <= 1
    assert "rag_sources" in report["corpus_origins"]
    assert "public_registry" in report["corpus_origins"]
    assert "domestic_resources" in report["corpus_origins"]
    without = [doc for doc in docs if doc["source_id"] != "policy-cn-136"]
    dropped = evaluate(without, questions)
    assert dropped["missing_source"] > report["missing_source"]
    assert dropped["evaluated"] != report["evaluated"]
    assert report["zero_score_not_counted"] is True
    probe = evaluate(docs, [{
        "id": "Z000",
        "category": "policy",
        "question": "zzzz",
        "required_sources": [{"source_id": "policy-cn-136"}],
    }])
    assert probe["recall_at_8"] == 0


def test_push_window_weekends_and_holidays():
    table = load_table()
    assert table["doc_number"] == "国办发明电〔2025〕7号"
    assert allow_push(datetime(2026, 10, 27, 9, 0, tzinfo=SH), "即时", table)
    assert not allow_push(datetime(2026, 10, 27, 7, 59, tzinfo=SH), "即时", table)
    assert not allow_push(datetime(2026, 10, 27, 21, 31, tzinfo=SH), "周报", table)
    assert not allow_push(datetime(2026, 10, 31, 10, 0, tzinfo=SH), "即时", table)
    assert allow_push(datetime(2026, 10, 31, 10, 0, tzinfo=SH), "周报", table)
    assert not allow_push(datetime(2026, 10, 1, 10, 0, tzinfo=SH), "即时", table)
    assert allow_push(datetime(2026, 10, 1, 10, 0, tzinfo=SH), "周报", table)
    assert allow_push(datetime(2026, 1, 4, 9, 0, tzinfo=SH), "即时", table)
    assert salutation("ci_owner", "王") == "王总"
    assert salutation("developer", "李") == "李经理"
    assert salutation("researcher", "陈") == "陈老师"
    assert salutation("government", "赵") == "赵老师"
    assert salutation("researcher", "周", sub_role="student") == "同学"
    assert salutation("ci_owner", "王", mode="none") == ""


def test_plan_ids_keep_stored_members():
    assert stored_plan_id("standard") == "pro"
    assert stored_plan_id("pro") == "pro"
    assert stored_plan_id("professional") == "full"
    assert stored_plan_id("full") == "full"
    assert canonical_plan_id("pro") == "standard"
    assert canonical_plan_id("full") == "professional"


def test_as_of_returns_the_version_then_in_force():
    records = [
        {"source_id": "v1", "effective_date": "2020-01-01", "expiry_date": "2024-12-31", "superseded_by": "v2"},
        {"source_id": "v2", "effective_date": "2025-01-01", "expiry_date": None, "superseded_by": None},
        {"source_id": "tariff-2024", "effective_date": "2024-01-01", "expiry_date": "2024-12-31"},
        {"source_id": "tariff-2025", "effective_date": "2025-01-01", "expiry_date": "2025-12-31"},
        {"source_id": "tariff-2026", "effective_date": "2026-01-01", "expiry_date": None},
    ]
    cases = [
        ("2019-12-31", set()),
        ("2020-01-01", {"v1"}),
        ("2024-06-01", {"v1", "tariff-2024"}),
        ("2024-12-31", {"v1", "tariff-2024"}),
        ("2025-01-01", {"v2", "tariff-2025"}),
        ("2025-06-01", {"v2", "tariff-2025"}),
        ("2025-12-31", {"v2", "tariff-2025"}),
        ("2026-01-01", {"v2", "tariff-2026"}),
        ("2026-10-27", {"v2", "tariff-2026"}),
        ("2027-01-01", {"v2", "tariff-2026"}),
    ]
    assert len(cases) == 10
    for day, expected in cases:
        got = {item["source_id"] for item in effective_on(records, day)}
        assert got == expected, day


def test_small_cohorts_stay_hidden():
    shown = visible_cohorts([
        {"province": "山东", "role": "工商业业主", "count": 19, "items": ["电价"]},
        {"province": "江苏", "role": "项目开发", "count": 20, "items": ["政策"]},
    ])
    assert [item["province"] for item in shown] == ["江苏"]


def test_procurement_stays_pending():
    incomplete = open_procurement({"account_name": "甲"})
    assert incomplete["status"] == "incomplete"
    assert incomplete["sent"] is False
    ready = open_procurement({
        "account_name": "甲", "bank_name": "示例银行", "account_number": "1", "tax_id": "2",
    })
    assert ready["status"] == "pending_wecom"
    assert ready["approved"] is False
    assert ready["sent"] is False


def test_pysam_wind_difference_is_measured_when_installed():
    import importlib.util
    from pathlib import Path
    path = Path(__file__).resolve().parents[1] / "scripts" / "pysam_compare.py"
    spec = importlib.util.spec_from_file_location("pysam_compare", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    report = module.compare()
    cross = module.pvlib_yield_crosscheck()
    assert cross["compared"] is False
    assert "pvlib_annual_kwh" not in cross
    if not report["pysam_installed"]:
        assert report["wind"] is None
        assert report["battery"]["compared"] is False
        assert report["pvlib"]["compared"] is False
        return
    assert report["wind"]["relative_abs_diff"] < 0.02
    assert report["battery"]["compared"] is False
    assert report["pvlib"]["compared"] is False


def test_cleaning_interval_matches_the_closed_form():
    expected = max(1, round(math.sqrt(2 * 450 / (200 * 0.2 / 100))))
    assert abs(calc_optimal_cleaning_interval(450, 200, 0.2) - expected) <= 1
