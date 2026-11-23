"""2026-11 每周采集目录新增两条国家层面文件：只写候选、不进生产库、审核人为空。"""
import json
from datetime import date

from app.services import rag_refresh
from app.services.rag_refresh import REGISTRY_PATH

TODAY = date(2026, 11, 21)
NEW_IDS = ("EN-NEA-2026-92", "EN-NDRC-2026-1565")


def test_new_policy_candidates_stay_unpublished(tmp_path):
    registry_before = REGISTRY_PATH.read_bytes()
    out = tmp_path / "candidates"
    report = rag_refresh.harvest_weekly(candidates_dir=out, today=TODAY)
    assert report["state"] == "unpublished"
    assert report["production_written"] is False
    for cid in NEW_IDS:
        row = json.loads((out / f"{cid}.json").read_text(encoding="utf-8"))
        assert row["state"] == "unpublished"
        assert row["reviewer"] == ""
        assert row["review_status"] == "待审核"
        assert row["region"] == "cn" and row["language"] == "zh"
        assert row["url"].startswith("https://www.") and (".gov.cn/" in row["url"])
        assert "候选未审核" in row["excerpt"]
    nea = json.loads((out / "EN-NEA-2026-92.json").read_text(encoding="utf-8"))
    assert "国能发新能〔2026〕92号" in nea["excerpt"] and nea["published_at"] == "2026-11-09"
    ndrc = json.loads((out / "EN-NDRC-2026-1565.json").read_text(encoding="utf-8"))
    assert "发改能源〔2026〕1565号" in ndrc["excerpt"] and ndrc["published_at"] == "2026-10-29"
    # 题录候选不摘录附件里的装机目标数字，避免未经核对的数字进入候选
    assert "亿千瓦" not in ndrc["excerpt"]
    assert REGISTRY_PATH.read_bytes() == registry_before


def test_new_policies_are_not_yet_in_production_registry():
    blob = REGISTRY_PATH.read_text(encoding="utf-8")
    assert "国能发新能〔2026〕92号" not in blob
    assert "发改能源〔2026〕1565号" not in blob
