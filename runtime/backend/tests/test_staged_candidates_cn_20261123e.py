"""2026-11-23 步骤6 候选（新能源智库）：s08…s17 进暂存区、s07 并入 s05；全部「待审核」，不对用户展示，不设审核人。"""
import json
from datetime import date
from pathlib import Path

from app.library import store
from app.self_improve import promote_gate as PG

TODAY = date(2026, 11, 23)
DATA = Path(store.__file__).resolve().parent / "data"
NEW = {f"en-lib-s{n:02d}" for n in range(8, 18)}


def test_file_shape_and_ids():
    doc = json.loads((DATA / "staged_entries_cn_20261123e.json").read_text("utf-8"))
    assert doc["staged"] is True and doc["library"] == "energy-cn"
    ids = [e["id"] for e in doc["entries"]]
    assert set(ids) == NEW and len(ids) == len(set(ids))
    all_ids = [e["id"] for e in store.load_staged("cn")]
    assert len(all_ids) == len(set(all_ids))
    assert "en-lib-s06" not in all_ids and "en-lib-s07" not in all_ids  # s06 保留编号；s07 已并入 s05
    prod = {e["id"] for e in store.load_document("cn")["entries"]}
    assert not prod & (NEW | {"en-lib-s05"})


def test_all_pending_review_no_reviewer_and_https_source():
    for e in store.load_staged("cn"):
        if e["id"] in NEW | {"en-lib-s05"}:
            assert e["review_status"] == "待审核"
            assert not e.get("reviewer") and not e.get("approved_by")
            assert e["source"]["url"].startswith("https://") and e["source"].get("read_via")
            assert e["caution"] and len(e["probes"]) >= 3


def test_gate_keeps_all_and_none_visible():
    rep = PG.evaluate_all(store.load_staged("cn"), store.load_document("cn")["entries"], today=TODAY, lang="cn")
    v = {r["id"]: r["decision"] for r in rep["rows"]}
    for k in NEW | {"en-lib-s05"}:
        assert v[k] == "keep", (k, [r for r in rep["rows"] if r["id"] == k])
    visible = {e["id"] for e in store.annotated("cn", TODAY, include_hidden=True)}
    assert not visible & {e["id"] for e in store.load_staged("cn")}


def test_s05_merged_s07_content_without_deciding_successor():
    s05 = next(e for e in store.load_staged("cn") if e["id"] == "en-lib-s05")
    text = json.dumps(s05, ensure_ascii=False)
    assert "有效期截至2026年10月15日" in s05["quote"] and "1217" in s05["title"]
    assert "1217号文还有效吗" in s05["probes"] and "征求意见稿不是正式规则" in s05["caution"]
    assert s05["second_source"]["url"].startswith("https://www.gov.cn/")
    assert "待定44" in s05["todo"] and "已替代" not in s05["summary"]
    assert "en-lib-s07" in text  # 合并记录
