"""持续改进任务（能源情报）：金标准评测、陈旧扫描、雷达线索暂存、月报。全部默认关闭（SIL_ENABLED=0 时只返回 disabled）。

国内版（cn，中文）和国际版（global，英文）分开：各自一份金标准题、各自的结果目录、各自的月报；互不混用。

  python -m app.self_improve.continuous golden|stale|radar|radar-stage|monthly-report [--force] [--month YYYY-MM]
--force 只用于人工手动跑一次，不改变任何开关。所有任务只写 SIL_DATA_DIR 下的文件，不改资料库条目、不改 RAG 来源、不发消息。
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from . import golden as G
from . import monthly_report as MR
from . import radar, radar_stage as RS
from . import stale as S
from .scheduler import TZ
from .store import CandidateStore

HERE = Path(__file__).resolve()
BACKEND = HERE.parents[2]
GOLDEN_DIR = BACKEND / "data" / "eval"
EDITIONS = {"cn": {"lang": "zh", "golden": GOLDEN_DIR / "golden_ci_cn_20261031.jsonl"}, "global": {"lang": "en", "golden": GOLDEN_DIR / "golden_ci_global_20261031.jsonl"}}
SLOTS = {"golden_eval": "weekly:SUN@03:30", "stale_scan": "daily@02:30", "radar": radar.RADAR_SCHEDULE, "radar_stage": "weekly:WED@06:00", "monthly_report": "monthly:1@05:00"}
SKILLS = {
    "cn": ("lib-law", "lib-stats", "lib-policy", "calc-npv-irr", "safety-bottom-line"),
    "global": ("lib-market", "safety-bottom-line"),
}
TERMS = ("photovoltaic", "solar", "wind", "storage", "battery", "grid", "electricity", "renewable", "energy", "power market", "新能源", "光伏", "风电", "储能", "电力", "绿证", "辅助服务")


def _cfg():
    from .hooks import build_config

    return build_config()


def _enabled(force: bool, cfg=None) -> bool:
    return force or bool((cfg or _cfg()).enabled)


def _data(cfg, edition: Optional[str] = None) -> Path:
    p = Path(cfg.data_dir)
    return p / edition if edition else p


def library_entries(edition: str) -> list[dict]:
    """资料库全部条目：已有 + 暂存区（暂存区也要被陈旧扫描和金标准覆盖，但永远不会展示给用户）。"""
    from app.library import store

    return list(store.load_document(edition)["entries"]) + store.load_staged(edition)


def rag_source_entries(edition: str) -> list[dict]:
    """RAG 来源（data/rag_sources.json）当作条目扫：过期、将过期、未复核。"""
    d = json.loads((BACKEND / "data" / "rag_sources.json").read_text("utf-8"))["sources"]
    want = "cn" if edition == "cn" else "en"
    out = []
    for x in d:
        if x.get("lang", "cn") != want:
            continue
        reviewed = x.get("evidence_status") in ("official_text_read", "verified_official")
        out.append({"id": f"rag:{x['source_id']}", "title": x.get("title", ""), "status": x.get("status", ""), "review_status": "已审核" if reviewed else "待审核",
                    "reviewed_at": x.get("last_verified_at") if reviewed else None, "valid_until": x.get("expiry_date"), "retrieved_at": x.get("retrieved_at") or x.get("last_verified_at"),
                    "source": {"url": x.get("source_url") or "https://local/rag"}})
    return out


def _grams(s: str) -> set:
    s = "".join(ch for ch in s.lower() if ch.isalnum())
    return {s[i:i + 2] for i in range(len(s) - 1)}


def library_answer(question: str, entries: list[dict]) -> dict:
    qg = _grams(question)
    best, score = None, 0
    for e in entries:
        sc = len(qg & _grams(e["title"] + " ".join(e.get("tags", [])))) * 3 + len(qg & _grams(e["summary"] + "".join(e["points"])))
        if sc > score:
            best, score = e, sc
    if not best:
        return {"text": ""}
    return {"text": "\n".join([best["title"], best["summary"], *best["points"], best.get("plain_tip", ""), best.get("caution", "")]), "citations": [best["source"]["url"]]}


def _ref_irr(cfs: list[float]) -> float:
    """独立参考解（与 app.utils.financial_utils 无关）：二分法，百分数。"""
    npv = lambda r: sum(c / (1 + r) ** i for i, c in enumerate(cfs))
    lo, hi = -0.99, 10.0
    for _ in range(200):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if npv(mid) > 0 else (lo, mid)
    return (lo + hi) / 2 * 100


def make_answer_fn(edition: str, entries: Optional[list[dict]] = None):
    entries = library_entries(edition) if entries is None else entries

    def fn(case: dict):
        ch = case.get("channel", "library")
        if ch == "library":
            return library_answer(case["question"], entries)
        if ch == "safety":
            from app.services.bottom_line import blocked_input_text

            return {"text": "", "refused": blocked_input_text(case["question"], market="global" if edition == "global" else "cn") is not None}
        if ch == "calc":
            from app.utils.financial_utils import calc_irr, calc_npv

            i = case["input"]
            if i["fn"] == "irr":
                return {"text": f"IRR={calc_irr(i['cashflows']):.2f}%"}
            return {"text": f"NPV={calc_npv(i['rate'], i['cashflows']):.2f}"}
        raise ValueError(f"unknown_channel:{ch}")

    fn.wants_case = True
    return fn


def _worklist(data: Path, rows: list[dict]) -> None:
    if rows:
        data.mkdir(parents=True, exist_ok=True)
        with (data / "worklist.jsonl").open("a", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")


def run_golden(now: Optional[datetime] = None, *, force: bool = False, edition: Optional[str] = None, cases=None, answer_fn=None, cfg=None) -> dict:
    cfg = cfg or _cfg()
    if not _enabled(force, cfg):
        return {"status": "disabled"}
    now = now or datetime.now(TZ)
    out = {}
    for ed in ([edition] if edition else EDITIONS):
        data = _data(cfg, ed)
        cs = cases if cases is not None else G.load(EDITIONS[ed]["golden"])
        res = G.run_golden(cs, answer_fn or make_answer_fn(ed), edition=EDITIONS[ed]["lang"], previous=G.load_last(data), now=now)
        G.save_result(res, data)
        _worklist(data, [{"candidate": f"golden-regression-{i}", "url": "", "excerpt": f"golden case {i} passed last time, fails now"} for i in res["regressions"]])
        cov = G.coverage(cs, SKILLS[ed])
        out[ed] = {"n": res["n"], "pass_rate": round(res["pass_rate"], 4), "regressions": res["regressions"], "failures": [f["id"] for f in res["failures"]],
                   "skipped_invalid": res["skipped_invalid"], "coverage_missing": cov["missing"], "coverage_thin": cov["thin"]}
    return {"status": "ok", "editions": out}


def run_stale(now: Optional[datetime] = None, *, force: bool = False, cfg=None) -> dict:
    cfg = cfg or _cfg()
    if not _enabled(force, cfg):
        return {"status": "disabled"}
    today = (now or datetime.now(TZ)).date()
    res = {}
    for ed in EDITIONS:
        data = _data(cfg, ed)
        rep = S.scan(library_entries(ed) + rag_source_entries(ed), G.load(EDITIONS[ed]["golden"]), today=today, lang=EDITIONS[ed]["lang"])
        data.mkdir(parents=True, exist_ok=True)
        (data / "stale_report.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1), "utf-8")
        prev = {f["kind"] + ":" + f["id"] for f in json.loads((data / "stale_prev.json").read_text("utf-8"))} if (data / "stale_prev.json").exists() else set()
        new_high = [f for f in rep["findings"] if f["severity"] == "high" and f["kind"] + ":" + f["id"] not in prev]
        _worklist(data, [{"candidate": f"stale-{f['kind']}-{f['id']}", "url": "", "excerpt": f"{f['title']}: {f['reason']}"} for f in new_high])
        (data / "stale_prev.json").write_text(json.dumps(rep["findings"], ensure_ascii=False), "utf-8")
        res[ed] = {"counts": rep["counts"], "new_high": [f["id"] for f in new_high]}
    return {"status": "ok", "editions": res}


def run_radar(now: Optional[datetime] = None, *, force: bool = False, cfg=None, **kw) -> dict:
    cfg = cfg or _cfg()
    if not _enabled(force, cfg):
        return {"status": "disabled"}
    return {"status": "ok", **radar.run_radar(cfg.product, cfg.data_dir, now=now, **kw)}


def run_radar_stage(now: Optional[datetime] = None, *, force: bool = False, cfg=None) -> dict:
    cfg = cfg or _cfg()
    if not _enabled(force, cfg):
        return {"status": "disabled"}
    data = _data(cfg)
    known = [(e.get("source") or {}).get("url") for ed in EDITIONS for e in library_entries(ed)]
    out = RS.stage(RS.load_items(data / "radar"), product=cfg.product, terms=TERMS, staged_path=data / "library_staged.jsonl", known_urls=known, now=now or datetime.now(TZ))
    return {"status": "ok", **out}


def run_monthly_report(now: Optional[datetime] = None, *, force: bool = False, month: Optional[str] = None, edition: Optional[str] = None, cfg=None, env=None) -> dict:
    cfg = cfg or _cfg()
    if not _enabled(force, cfg):
        return {"status": "disabled"}
    env = os.environ if env is None else env
    now = now or datetime.now(TZ)
    month = month or (now.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
    y, m = map(int, month.split("-"))
    prev_month = f"{y - 1}-12" if m == 1 else f"{y}-{m - 1:02d}"
    from app.library import store as lib

    out = {}
    for ed in ([edition] if edition else EDITIONS):
        data, lang = _data(cfg, ed), EDITIONS[ed]["lang"]
        runs, prev_runs = G.load_month(data, month), G.load_month(data, prev_month)
        entries = library_entries(ed)
        rl = lib.data_dir() / "library_review_log.jsonl"
        review_log = [json.loads(x) for x in rl.read_text("utf-8").splitlines() if x.strip()] if rl.exists() else []
        stale = S.scan(entries + rag_source_entries(ed), G.load(EDITIONS[ed]["golden"]), today=now.date(), lang=lang)
        radar_dir = _data(cfg) / "radar"
        stem = month.replace("-", "")
        new_items = sum(len(json.loads(p.read_text("utf-8"))) for p in radar_dir.glob(f"items_{stem}*.json")) if radar_dir.exists() else 0
        has_c = (_data(cfg) / "candidates").exists()
        rep = MR.build_report(
            "能源情报" if lang == "zh" else "Energy Intelligence (international)", month, golden_runs=runs, previous_golden=prev_runs[-1] if prev_runs else None,
            ledger_events=CandidateStore(_data(cfg)).ledger.entries() if has_c else [], review_log=review_log, stale=stale,
            candidates=[c.__dict__ for c in CandidateStore(_data(cfg)).list()] if has_c else [], staged=RS.load_staged(_data(cfg) / "library_staged.jsonl") if ed == "cn" else [],
            pending_entries=sum(1 for e in entries if e.get("review_status") in ("待审核", "Pending review")),
            radar_digests=len(list(radar_dir.glob(f"digest_{stem}*.md"))) if radar_dir.exists() else 0, radar_new_items=new_items, sil_enabled=bool(cfg.enabled), lang=lang, today=now.date())
        out[ed] = {**MR.write_all(rep, data / "reports", env=env), "advice": rep["advice"]}
    return {"status": "ok", "month": month, "editions": out}


def jobs() -> dict:
    return {"golden_eval": (SLOTS["golden_eval"], run_golden), "stale_scan": (SLOTS["stale_scan"], run_stale), "radar": (SLOTS["radar"], run_radar),
            "radar_stage": (SLOTS["radar_stage"], run_radar_stage), "monthly_report": (SLOTS["monthly_report"], run_monthly_report)}


def main(argv=None) -> int:
    import sys

    argv = list(sys.argv[1:] if argv is None else argv)
    cmd = argv[0] if argv else ""
    fn = {"golden": run_golden, "stale": run_stale, "radar": run_radar, "radar-stage": run_radar_stage, "monthly-report": run_monthly_report}.get(cmd)
    if fn is None:
        print(__doc__)
        return 0
    kw = {"force": "--force" in argv}
    if cmd == "monthly-report" and "--month" in argv:
        kw["month"] = argv[argv.index("--month") + 1]
    print(json.dumps(fn(**kw), ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
