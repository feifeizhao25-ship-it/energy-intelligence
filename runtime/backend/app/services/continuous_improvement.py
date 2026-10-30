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
WATCHLIST = ROOT / "data" / "improvement" / "watchlist.yaml"
ATOM = "{http://www.w3.org/2005/Atom}"


def schedule_kwargs() -> dict:
    """默认每周一 09:00（上海）。IMPROVEMENT_SCHEDULE=daily|off 可改。"""
    mode = (os.environ.get("IMPROVEMENT_SCHEDULE") or "weekly").strip().lower()
    if mode in {"0", "off", "false", "disabled"}:
        return {"enabled": False, "crontab": {}}
    hour = _int_env("IMPROVEMENT_HOUR", 9)
    minute = _int_env("IMPROVEMENT_MINUTE", 0)
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


def _empty_watchlist() -> dict:
    return {
        "github_repos": [],
        "github_topics": [],
        "github_search_queries": [],
        "huggingface_dataset_queries": [],
        "huggingface_model_queries": [],
        "arxiv_queries": [],
        "arxiv_feeds": [],
        "vetted": [],
    }


def _query_text(row) -> str:
    if isinstance(row, dict):
        return str(row.get("q") or row.get("query") or "")
    return str(row or "")


def normalize_watchlist(data: dict) -> dict:
    """兼容旧的扁平清单和监测清单里的分组。"""
    if not isinstance(data, dict):
        return _empty_watchlist()
    if "github" not in data and "huggingface" not in data and "arxiv" not in data:
        flat = _empty_watchlist()
        flat.update({key: data.get(key) or flat[key] for key in flat})
        return flat
    github = data.get("github") or {}
    hf = data.get("huggingface") or {}
    arxiv = data.get("arxiv") or {}
    keywords = [str(item) for item in (arxiv.get("keywords_any") or []) if item]
    return {
        "github_repos": [str(item) for item in list(github.get("repos_core") or []) + list(github.get("repos_watch") or [])],
        "github_topics": [str(item) for item in (github.get("topics") or [])],
        "github_search_queries": [str(item) for item in (github.get("search_queries") or [])],
        "huggingface_dataset_queries": [_query_text(item) for item in (hf.get("dataset_queries") or []) if _query_text(item)],
        "huggingface_model_queries": [_query_text(item) for item in (hf.get("model_queries") or []) if _query_text(item)],
        "arxiv_queries": keywords,
        "arxiv_feeds": [str(item) for item in (arxiv.get("feeds") or [])],
        "vetted": data.get("vetted") or [],
    }


def load_watchlist(path: Path | None = None) -> dict:
    file = path or watchlist_path()
    if not file.is_file():
        return _empty_watchlist()
    try:
        text = file.read_text(encoding="utf-8")
        if file.suffix in {".yaml", ".yml"}:
            import yaml
            data = yaml.safe_load(text)
        else:
            data = json.loads(text)
    except Exception:
        return _empty_watchlist()
    return normalize_watchlist(data if isinstance(data, dict) else {})


def github_token() -> str:
    return (os.environ.get("GITHUB_TOKEN") or "").strip()


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


def _parse_github_repo(payload: str, query: str) -> list[dict]:
    data = json.loads(payload or "{}")
    if isinstance(data, dict) and data.get("items"):
        return _parse_github(payload, query)
    if not isinstance(data, dict):
        return []
    return [_candidate(
        "code",
        data.get("full_name") or query,
        data.get("html_url") or "",
        data.get("license") or "",
        query,
    )]


def _parse_feed(payload: str, query: str) -> list[dict]:
    root = ET.fromstring(payload)
    keywords = [part.lower() for part in query.split() if part]
    rows = []
    for node in list(root.iter()):
        tag = node.tag.rsplit("}", 1)[-1]
        if tag not in {"item", "entry"}:
            continue
        title = ""
        link = ""
        for child in list(node):
            name = child.tag.rsplit("}", 1)[-1]
            if name == "title" and not title:
                title = " ".join((child.text or "").split())
            if name == "link" and not link:
                link = child.text or child.attrib.get("href") or ""
            if name == "id" and not link:
                link = child.text or ""
        if keywords and not any(word in title.lower() for word in keywords):
            continue
        if title:
            rows.append(_candidate("paper", title, link, "未标明", query or "feed"))
        if len(rows) >= 5:
            break
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
    headers = {"User-Agent": "nengjian-improvement/1.0", "Accept": "application/json, application/atom+xml, */*"}
    token = github_token()
    if token and "api.github.com" in url:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, headers=headers)
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

    if not github_token() and any(watchlist.get(key) for key in ("github_topics", "github_repos", "github_search_queries")):
        errors.append({"url": "https://api.github.com", "reason": "未配置代码托管令牌"})
    else:
        for repo in (watchlist.get("github_repos") or [])[:8]:
            pull("https://api.github.com/repos/%s" % str(repo).strip("/"), _parse_github_repo, str(repo))
        for topic in (watchlist.get("github_topics") or [])[:4]:
            pull(
                "https://api.github.com/search/repositories?q=topic:%s&sort=updated&per_page=5" % quote(str(topic)),
                _parse_github,
                str(topic),
            )
        for query in (watchlist.get("github_search_queries") or [])[:2]:
            pull(
                "https://api.github.com/search/repositories?q=%s&sort=updated&per_page=5" % quote(str(query)),
                _parse_github,
                str(query),
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
    if watchlist.get("arxiv_feeds"):
        keyword_text = " ".join(str(item) for item in (watchlist.get("arxiv_queries") or []))
        for feed in watchlist.get("arxiv_feeds") or []:
            pull(str(feed), _parse_feed, keyword_text)
    else:
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


def pull_request_draft(proposal: dict) -> dict:
    suggestions = proposal.get("suggestions") or []
    lines = [
        "这是待审提案，不会自动合并，也不会改线上配置。",
        "检索召回：%s" % ((proposal.get("metrics") or {}).get("recall_at_8")),
        "忠实度门槛为暂定值，未通过只留在队列里。",
    ]
    lines.extend(str(item) for item in suggestions[:6])
    return {
        "title": "持续改进提案",
        "body": "\n".join(lines),
        "draft": True,
        "auto_merge": False,
        "applied": False,
    }


def open_pull_request(proposal: dict, transport=None) -> dict:
    """默认只保留提案。同时具备令牌、仓库、分支和开关时才提交草稿。"""
    draft = pull_request_draft(proposal)
    token = github_token()
    repo = (os.environ.get("IMPROVEMENT_PR_REPO") or "").strip()
    head = (os.environ.get("IMPROVEMENT_PR_HEAD") or "").strip()
    base = (os.environ.get("IMPROVEMENT_PR_BASE") or "fixes/energy-p0-2026-10-15").strip()
    if not token:
        return {"opened": False, "reason": "未配置代码托管令牌", "applied": False, "draft": draft}
    if (os.environ.get("IMPROVEMENT_OPEN_PR") or "").strip() != "1" or not repo or not head:
        return {"opened": False, "reason": "只写入待审提案", "applied": False, "draft": draft}
    payload = {"title": draft["title"], "body": draft["body"], "head": head, "base": base, "draft": True}
    try:
        if transport is None:
            import json as _json
            import urllib.request
            req = urllib.request.Request(
                "https://api.github.com/repos/%s/pulls" % repo.strip("/"),
                data=_json.dumps(payload).encode(),
                headers={"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json", "User-Agent": "nengjian-improvement/1.0"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = _json.loads(resp.read().decode() or "{}")
        else:
            data = transport(payload)
    except Exception as exc:
        return {"opened": False, "reason": exc.__class__.__name__, "applied": False, "draft": draft}
    return {"opened": bool((data or {}).get("number") or (data or {}).get("html_url")), "applied": False, "draft": draft, "number": (data or {}).get("number")}


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
    from app.services.retrieval_eval import claim_overlap, evaluate as measure, load_corpus, load_heldout_questions, load_questions
    docs = load_corpus()
    golden_questions = load_questions()
    heldout_questions = load_heldout_questions()
    report = measure(docs, golden_questions)
    heldout = measure(docs, heldout_questions)
    stored = {key: value for key, value in report.items() if key != "rows"}
    stored["heldout_recall_at_8"] = heldout.get("recall_at_8")
    stored["refusal_accuracy"] = report.get("refusal_accuracy")
    stored["heldout_questions"] = heldout.get("questions")
    stored["heldout_by_category"] = heldout.get("by_category")
    stored["claim_overlap"] = claim_overlap(docs, golden_questions).get("claim_overlap")
    stored["heldout_claim_overlap"] = claim_overlap(docs, heldout_questions).get("claim_overlap")
    return stored


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


def _pair(current: dict, previous: dict | None, key: str) -> tuple[float | None, float | None, float | None]:
    recall = current.get(key)
    before = None if not previous else previous.get(key)
    delta = None
    if isinstance(recall, (int, float)) and isinstance(before, (int, float)):
        delta = recall - before
    return recall if isinstance(recall, (int, float)) else None, before if isinstance(before, (int, float)) else None, delta


def _diff(current: dict, previous: dict | None) -> dict:
    recall, before, delta = _pair(current, previous, "recall_at_8")
    heldout, heldout_before, heldout_delta = _pair(current, previous, "heldout_recall_at_8")
    return {
        "recall_at_8": recall,
        "previous_recall_at_8": before,
        "recall_delta": delta,
        "heldout_recall_at_8": heldout,
        "previous_heldout_recall_at_8": heldout_before,
        "heldout_recall_delta": heldout_delta,
    }


def _suggestions(diff: dict, candidates: list[dict], ingestion: dict, audit: dict) -> list[str]:
    notes = ["技能与检索配置保持现状，待审批通过后由人工合并。"]
    if diff.get("recall_delta") is None:
        notes.append("本次记下检索召回，尚无上一份可对照。")
    else:
        notes.append("检索召回相对上次的差值已写入指标。")
    heldout = diff.get("heldout_recall_at_8")
    golden = diff.get("recall_at_8")
    if isinstance(heldout, (int, float)) and isinstance(golden, (int, float)) and heldout + 0.05 < golden:
        notes.append("留出题召回低于黄金集。不要只按黄金集调整问句改写或加权。")
    elif isinstance(heldout, (int, float)):
        notes.append("留出题召回已一并写入，黄金集不能单独当作调参依据。")
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
    from app.services.faithfulness import faithfulness_gate, faithfulness_threshold
    from app.services.research_sources import research_candidates
    seen = {item.get("name") for item in discovered["candidates"]}
    for item in research_candidates():
        if item.get("name") not in seen:
            discovered["candidates"].append(item)
            seen.add(item.get("name"))
    if retrieval.get("faithfulness_answer"):
        faith = faithfulness_gate(
            str(retrieval.get("faithfulness_answer") or ""),
            list(retrieval.get("faithfulness_contexts") or []),
            faithfulness_threshold(),
        )
    else:
        faith = {
            "score": None,
            "passed": False,
            "threshold": faithfulness_threshold(),
            "provisional": True,
            "applied": False,
            "reason": "没有可评的回答",
        }
    previous = _previous_metrics(folder)
    diff = _diff(retrieval, previous)
    body = {
        "created_at": moment.isoformat(),
        "metrics": diff,
        "retrieval": {key: retrieval.get(key) for key in (
            "recall_at_8", "heldout_recall_at_8", "claim_overlap", "heldout_claim_overlap",
            "k", "questions", "heldout_questions", "evaluated", "engine", "embedding_model", "status", "reason",
        ) if key in retrieval or key == "recall_at_8"},
        "ingestion": ingestion,
        "display_audit": display,
        "faithfulness": faith,
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
    proposal["pull_request"] = open_pull_request(proposal)
    try:
        folder.mkdir(parents=True, exist_ok=True)
        _metrics_path(folder).write_text(
            json.dumps({
                "recall_at_8": diff.get("recall_at_8"),
                "heldout_recall_at_8": diff.get("heldout_recall_at_8"),
                "created_at": body["created_at"],
            }, ensure_ascii=False) + "\n",
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
