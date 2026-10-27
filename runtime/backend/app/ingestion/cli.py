"""公开数据试运行。默认不把解析结果写入已接受记录。"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from app.ingestion.registry import load_registry
from app.ingestion.runner import run_registry
from app.ingestion.store import IngestStore


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="公开数据抓取试运行")
    parser.add_argument("--dry-run", action="store_true", help="只抓取并解析，不写入已接受记录")
    parser.add_argument("--apply", action="store_true", help="写入已接受记录；冲突进入待核验")
    parser.add_argument("--source", default="", help="只跑一个 source_id")
    parser.add_argument("--bucket", default="", help="只跑一个定时分组")
    parser.add_argument("--report", default="", help="把结果写到这个 JSON 文件")
    args = parser.parse_args(argv)
    contact = os.environ.get("CRAWLER_CONTACT_EMAIL", "").strip()
    registry = load_registry()
    dry_run = not args.apply
    snapshot_dir = Path(os.environ.get("NENGJIAN_PUBLIC_SNAPSHOT_DIR", "/tmp/nengjian-public-snapshots"))
    store = None
    if args.apply:
        store = IngestStore(Path(os.environ.get("NENGJIAN_PUBLIC_INGEST_DB", "/tmp/nengjian-public-ingest.sqlite")))
    try:
        result = run_registry(
            registry,
            bucket=args.bucket,
            source_id=args.source,
            contact=contact,
            dry_run=dry_run,
            store=store,
            snapshot_dir=snapshot_dir,
            alert=None,
        )
    finally:
        if store is not None:
            store.close()
    lines = [
        "来源 %s 条，启用 %s，未启用 %s。本次%s。" % (
            registry["source_count"], registry["enabled_count"], registry["disabled_count"],
            "为试运行，未写入已接受记录" if dry_run else "会写入已接受记录",
        )
    ]
    if not contact:
        lines.append("未配置联系邮箱，启用的来源不会访问网络。")
    for item in result["reports"]:
        if item["status"] == "disabled":
            lines.append("%s 未启用 %s" % (item["source_id"], item["reason"]))
            continue
        detail = item["reason"]
        if item["fetched"]:
            detail = "；".join("%s %s" % (row["status"], row.get("reason") or row.get("sha256", "")[:12]) for row in item["fetched"])
        lines.append("%s %s 记录 %s %s" % (item["source_id"], item["status"], item["records"], detail))
        if item.get("human_note"):
            lines.append("  需人工：%s" % item["human_note"])
    lines.append("抓取成功：%s" % ("、".join(result["fetched_ok"]) or "无"))
    text = "\n".join(lines)
    print(text)
    if args.report:
        Path(args.report).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
