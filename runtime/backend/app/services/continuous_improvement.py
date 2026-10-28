"""每周持续改进：公开抓取、检索评测、显示巡检、候选来源。

结果只写入待审队列。企业微信未配置时审批保持桩，不会外发，也不会改检索或技能配置。
"""
from __future__ import annotations

import hashlib
import json
import os
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from app.ingestion.schedule import BUCKETS

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DIR = Path("/var/lib/nengjian/improvement")
WATCHLIST = ROOT / "data" / "improvement" / "watchlist.json"
ATOM = "{http://www.w3.org/2005/Atom}"


def schedule_kwargs() -> dict:
    """默认每周一 03:30（上海）。IMPROVEMENT_SCHEDULE=daily|off 可改。"""
    mode = (os.environ.get("IMPROVEMENT_SCHEDULE") or "weekly").strip().lower()
    if mode in {"0", "off", "false", "disabled"}:
        return {"enabled": False, "crontab": {}}
    hour = _int_env("IMPROVEMENT_HOUR", 3)
    minute = _int_env("IMPROVEMENT_MINUTE", 30)
    if mode == "daily":
        return {"enabled": True, "crontab": {"hour": hour, "minute": minute}}
    day = (os.environ.get("IMPROVEMENT_DAY_OF_WEEK") or "1").strip() or "1"
    return {"enabled": True, "crontab": {"day_of_week": day, "hour": hour, "minute": minute}}


def _int_env(name: str, default: int) -> int:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def queue_dir(path: Path | None = None) -> Path:
    if path is not None:
        return path
    raw = (os.environ.get("NENGJIAN_IMPROVEMENT_DIR") or "").strip()
    return Path(raw) if raw else DEFAULT_DIR


def watchlist_path() -> Path:
    raw = (os.environ.get("NENGJIAN_IMPROVEMENT_WATCHLIST") or "").strip()
    return Path(raw) if raw else WATCHLIST


def load_watchlist(path: Path | None = None) -> dict:
    file = path or watchlist_path()
    if not file.is_file():
        return {"github_topics": [], "huggingface_dataset_queries": [], "huggingface_model_queries": [], "arxiv_queries": [], "vetted": []}
    try:
        data = json.loads(file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"github_topics": [], "huggingface_dataset_queries": [], "huggingface_model_queries": [], "arxiv_queries": [], "vetted": []}
    return data if isinstance(data, dict) else {"vetted": []}


def _proposal_path(directory: Path) -> Path:
    return directory / "proposals.jsonl"


def _metrics_path(directory: Path) -> Path:
    return directory / "latest_metrics.json"


def read_queue(directory: Path | None = None) -> list[dict]:
    file = _proposal_path(queue_dir(directory))
    if not file.is_file():
        return []
    rows = []
    for line in file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(item, dict):
            rows.append(item)
    return rows


def _append(directory: Path, proposal: dict) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    with _proposal_path(directory).open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(proposal, ensure_ascii=False) + "\n")


def _rewrite(directory: Path, rows: list[dict]) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    text = "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows)
    _proposal_path(directory).write_text(text, encoding="utf-8")


def _fingerprint(body: dict) -> str:
    blob = json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _license_text(value) -> str:
    if isinstance(value, dict):
        value = value.get("spdx_id") or value.get("name") or ""
    text = str(value or "").strip()
    if not text or text.upper() in {"NONE", "NOASSERTION", "NULL"}:
        return "未标明"
    return text


def _candidate(kind: str, name: str, url: str, license_name: str, query: str) -> dict:
    return {
        "kind": kind,
        "name": (name or "").strip()[:180] or "未命名",
        "url": (url or "").strip()[:400],
        "license": _license_text(license_name),
        "query": query,
        "auto_apply": False,
        "note": "待人工核对许可证后再决定是否进入检索。不会自动入库。",
    }


def _parse_github(payload: str, query: str) -> list[dict]:
    data = json.loads(payload or "{}")
    rows = []
    for item in (data.get("items") or [])[:5]:
        if not isinstance(item, dict):
            continue
        rows.append(_candidate(
            "code",
            item.get("full_name") or "",
            item.get("html_url") or "",
            item.get("license") or "",
            query,
        ))
    return rows


def _parse_hf(payload: str, query: str, kind: str) -> list[dict]:
    data = json.loads(payload or "[]")
    if isinstance(data, dict):
        data = data.get("items") or data.get("datasets") or data.get("models") or []
    rows = []
    for item in list(data)[:5]:
        if not isinstance(item, dict):
            continue
        card = item.get("cardData") if isinstance(item.get("cardData"), dict) else {}
        rows.append(_candidate(
            kind,
            item.get("id") or item.get("modelId") or "",
            "https://huggingface.co/" + str(item.get("id") or ""),
            card.get("license") or item.get("license") or "",
            query,
        ))
    return rows


def _parse_arxiv(payload: str, query: str) -> list[dict]:
    root = ET.fromstring(payload)
    rows = []
    for entry in root.findall(f"{ATOM}entry")[:5]:
        title = "".join(entry.findtext(f"{ATOM}title") or "").strip()
        link = entry.findtext(f"{ATOM}id") or ""
        rows.append(_candidate("paper", " ".join(title.split()), link, "未标明", query))
    return rows


def _http_get(url: str) -> str:
    import urllib.request
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "nengjian-improvement/1.0", "Accept": "application/json, application/atom+xml, */*"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read(200_000).decode("utf-8", errors="replace")


def discover_candidates(watchlist: dict, fetch) -> dict:
    """只调用公开接口。fetch(url) 返回文本；失败记在 errors，不中断。"""
    found: list[dict] = []
    errors: list[dict] = []

    def pull(url: str, parser, query: str, *extra):
        try:
            text = fetch(url)
        except Exception as exc:
            errors.append({"url": url, "reason": exc.__class__.__name__})
            return
        try:
            found.extend(parser(text, query, *extra))
        except Exception as exc:
            errors.append({"url": url, "reason": exc.__class__.__name__})

    for topic in watchlist.get("github_topics") or []:
        pull(
            "https://api.github.com/search/repositories?q=topic:%s&sort=updated&per_page=5" % quote(str(topic)),
            _parse_github,
            str(topic),
        )
    for query in watchlist.get("huggingface_dataset_queries") or []:
        pull(
            "https://huggingface.co/api/datasets?search=%s&limit=5" % quote(str(query)),
            _parse_hf,
            str(query),
            "dataset",
        )
    for query in watchlist.get("huggingface_model_queries") or []:
        pull(
            "https://huggingface.co/api/models?search=%s&limit=5" % quote(str(query)),
            _parse_hf,
            str(query),
            "model",
        )
    for query in watchlist.get("arxiv_queries") or []:
        pull(
            "https://export.arxiv.org/api/query?search_query=%s&start=0&max_results=5" % quote(str(query)),
            _parse_arxiv,
            str(query),
        )
    for item in watchlist.get("vetted") or []:
        if not isinstance(item, dict):
            continue
        found.append({
            "kind": item.get("kind") or "vetted",
            "name": str(item.get("name") or "已核对来源")[:180],
            "url": str(item.get("url") or "")[:400],
            "license": _license_text(item.get("license")),
            "query": "vetted",
            "auto_apply": False,
            "note": "已在观察名单中，仍须审批后由人工合并。",
        })
    return {"candidates": found[:40], "errors": errors}


def _default_ingest(bucket: str) -> dict:
    from app.tasks.public_ingestion import public_ingest
    return public_ingest(bucket)


def run_ingestion(ingest=None) -> dict:
    """沿用公开抓取任务。总开关或联系邮箱缺失时由原任务返回未抓取，不另开网络。"""
    runner = ingest or _default_ingest
    reports = []
    for bucket in BUCKETS:
        try:
            reports.append(runner(bucket))
        except Exception as exc:
            reports.append({"status": "error", "bucket": bucket, "reason": exc.__class__.__name__})
    return {"buckets": reports, "respected_flag": "PUBLIC_INGESTION_ENABLED"}


def run_retrieval_eval(evaluate=None) -> dict:
    if evaluate is not None:
        return evaluate()
    from app.services.retrieval_eval import evaluate as measure
    from app.services.retrieval_eval import load_corpus, load_questions
    report = measure(load_corpus(), load_questions())
    return {key: value for key, value in report.items() if key != "rows"}


def run_display_audit(runner=None) -> dict:
    if runner is not None:
        return runner()
    if (os.environ.get("IMPROVEMENT_DISPLAY_AUDIT") or "1").strip() == "0":
        return {"status": "skipped", "reason": "显示巡检已关闭"}
    base = (os.environ.get("AUDIT_BASE") or "").strip()
    if not base:
        return {"status": "skipped", "reason": "未配置页面地址"}
    script = ROOT.parent / "web" / "audit" / "run_display_audit.mjs"
    if not script.is_file():
        return {"status": "skipped", "reason": "巡检脚本不在"}
    import subprocess
    try:
        completed = subprocess.run(
            ["node", str(script)],
            cwd=str(script.parent.parent),
            env={**os.environ, "AUDIT_BASE": base},
            capture_output=True,
            text=True,
            timeout=int(os.environ.get("IMPROVEMENT_AUDIT_TIMEOUT", "1200")),
            check=False,
        )
    except Exception as exc:
        return {"status": "error", "reason": exc.__class__.__name__}
    report_path = script.parent / "display_audit.json"
    summary = {"status": "done" if completed.returncode == 0 else "error", "returncode": completed.returncode}
    if report_path.is_file():
        try:
            payload = json.loads(report_path.read_text(encoding="utf-8"))
            summary["issueCounts"] = payload.get("issueCounts") or {}
            summary["checks"] = payload.get("checks")
            summary["routeCount"] = payload.get("routeCount")
        except (OSError, json.JSONDecodeError):
            summary["reason"] = "巡检结果无法读取"
    return summary


def _previous_metrics(directory: Path) -> dict | None:
    file = _metrics_path(directory)
    if not file.is_file():
        return None
    try:
        data = json.loads(file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def _diff(current: dict, previous: dict | None) -> dict:
    recall = current.get("recall_at_8")
    before = None if not previous else previous.get("recall_at_8")
    delta = None
    if isinstance(recall, (int, float)) and isinstance(before, (int, float)):
        delta = recall - before
    return {"recall_at_8": recall, "previous_recall_at_8": before, "recall_delta": delta}


def _suggestions(diff: dict, candidates: list[dict], ingestion: dict, audit: dict) -> list[str]:
    notes = ["技能与检索配置保持现状，待审批通过后由人工合并。"]
    if diff.get("recall_delta") is None:
        notes.append("本次记下检索召回，尚无上一份可对照。")
    else:
        notes.append("检索召回相对上次的差值已写入指标。")
    fetched = [item for item in ingestion.get("buckets") or [] if item.get("status") == "done"]
    if not fetched:
        notes.append("公开抓取未执行或未开启，候选不来自新入库文本。")
    else:
        notes.append("公开抓取已跑完，新文本仍待审核后才进入检索。")
    if audit.get("status") == "skipped":
        notes.append("显示巡检未跑：" + str(audit.get("reason") or "未执行"))
    elif audit.get("issueCounts"):
        notes.append("显示巡检问题计数已附在提案中。")
    if candidates:
        notes.append("新候选只进入待审队列，不改技能清单。")
    else:
        notes.append("本轮没有新的候选来源。")
    return notes


def _approval(content_sha256: str, submit=None) -> dict:
    if submit is not None:
        return submit(content_sha256)
    from ops.wecom import submit_approval
    result = submit_approval("content", content_sha256)
    result["applied"] = False
    return result


def run_cycle(
    *,
    directory: Path | None = None,
    watchlist: dict | None = None,
    fetch=None,
    ingest=None,
    evaluate=None,
    audit=None,
    submit=None,
    now: datetime | None = None,
) -> dict:
    """跑一轮并入队。applied 恒为假。"""
    if (os.environ.get("IMPROVEMENT_ENABLED") or "1").strip() == "0":
        return {"status": "noop", "reason": "未开启", "applied": False}
    folder = queue_dir(directory)
    moment = now or datetime.now(timezone.utc)
    ingestion = run_ingestion(ingest)
    try:
        retrieval = run_retrieval_eval(evaluate)
    except Exception as exc:
        retrieval = {"status": "error", "reason": exc.__class__.__name__, "recall_at_8": None}
    display = run_display_audit(audit)
    if (os.environ.get("IMPROVEMENT_DISCOVERY") or "1").strip() == "0":
        discovered = {"candidates": [], "errors": []}
    else:
        discovered = discover_candidates(
            watchlist if watchlist is not None else load_watchlist(),
            fetch or _http_get,
        )
    previous = _previous_metrics(folder)
    diff = _diff(retrieval, previous)
    body = {
        "created_at": moment.isoformat(),
        "metrics": diff,
        "retrieval": {key: retrieval.get(key) for key in ("recall_at_8", "k", "questions", "evaluated", "engine", "embedding_model", "status", "reason") if key in retrieval or key == "recall_at_8"},
        "ingestion": ingestion,
        "display_audit": display,
        "candidates": discovered["candidates"],
        "discovery_errors": discovered["errors"],
        "suggestions": _suggestions(diff, discovered["candidates"], ingestion, display),
        "applied": False,
        "live": False,
    }
    body["content_sha256"] = _fingerprint(body)
    approval = _approval(body["content_sha256"], submit)
    proposal = {
        **body,
        "id": body["content_sha256"][:16],
        "status": "pending_review",
        "approval": approval,
    }
    try:
        folder.mkdir(parents=True, exist_ok=True)
        _metrics_path(folder).write_text(
            json.dumps({"recall_at_8": diff.get("recall_at_8"), "created_at": body["created_at"]}, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        _append(folder, proposal)
    except OSError as exc:
        return {"status": "error", "reason": exc.__class__.__name__, "applied": False, "proposal": proposal}
    return {"status": "queued", "applied": False, "id": proposal["id"], "proposal": proposal}


def mark_approval(proposal_id: str, detail: dict | None, directory: Path | None = None) -> dict:
    """审批通过只改队列状态。不改检索、技能或线上配置。"""
    from ops.wecom import approval_allows

    folder = queue_dir(directory)
    rows = read_queue(folder)
    target = None
    for row in rows:
        if row.get("id") == proposal_id:
            target = row
            break
    if target is None:
        return {"status": "missing", "applied": False}
    allowed = approval_allows(detail, target.get("content_sha256") or "")
    target["applied"] = False
    target["live"] = False
    if not allowed:
        target["status"] = "pending_review"
        target["approval_note"] = "审批未通过或不匹配，配置保持原样。"
    else:
        target["status"] = "approved"
        target["approval_note"] = "审批已通过。配置仍需人工合并，不会自动生效。"
    _rewrite(folder, rows)
    return {"status": target["status"], "applied": False, "id": proposal_id}
