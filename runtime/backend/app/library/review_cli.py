"""人工审核命令行（只有人会用；定时任务从不调用）。

  python -m app.library.review_cli --edition cn approve en-lib-001 --reviewer <企业微信 userid>
  python -m app.library.review_cli --edition cn update en-lib-007 --reviewer <userid> --note "全国装机由 41.3 亿千瓦更新为 41.8 亿千瓦"
  python -m app.library.review_cli --edition global confirm en-intl-002 --reviewer <userid>   # 看过来源变化，对本条没有影响
  python -m app.library.review_cli --edition global repeal en-intl-004 --reviewer <userid> --note "withdrawn by the publisher"

审核人必须在 POLICY_REVIEWERS 名单里（和政策流水线同一份名单）。名单为空时无人能审——这是有意的：
名单由负责人自己填写，代码和自动化流程不得代填，所以名单没填之前，资料库里没有任何条目能上线。
写回 ENERGY_LIBRARY_DIR/reference_entries_<edition>.json（第一次会从包内文件复制），审计日志 library_review_log.jsonl。
国际版条目的变更说明（--note）写英文，国内版写中文。
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date

from app.library_live import review
from app.self_improve.approval import reviewers_from_env

from . import store

LABELS = {"cn": {"review": ("已审核", "待审核"), "repeal": ("已废止",)}, "global": {"review": ("Reviewed", "Pending review"), "repeal": ("Repealed",)}}


def main(argv=None, env=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--edition", choices=store.EDITIONS, required=True)
    ap.add_argument("action", choices=["approve", "update", "confirm", "repeal"])
    ap.add_argument("entry_id")
    ap.add_argument("--reviewer", required=True)
    ap.add_argument("--note", default="")
    ap.add_argument("--superseded-by")
    a = ap.parse_args(argv)
    allowed = reviewers_from_env(env)
    if not allowed:
        print("error: POLICY_REVIEWERS 为空，无人能审核（需要负责人填写名单）/ POLICY_REVIEWERS is empty, nobody can review", file=sys.stderr)
        return 3
    if a.reviewer not in allowed:
        print(f"error: {a.reviewer} 不在 POLICY_REVIEWERS 名单里 / not in POLICY_REVIEWERS", file=sys.stderr)
        return 3
    ed = a.edition
    d = store.data_dir()
    d.mkdir(parents=True, exist_ok=True)
    doc = store.load_document(ed)
    st = store.load_state(ed)
    today = date.today()
    log, snaps = d / "library_review_log.jsonl", d / "snapshots" / ed
    lab = LABELS[ed]
    try:
        if a.action == "approve":
            review.approve(doc, st, a.entry_id, a.reviewer, today, review_labels=lab["review"], snapshots_dir=snaps, log_path=log)
        elif a.action == "update":
            review.update(doc, st, a.entry_id, a.reviewer, today, a.note, snapshots_dir=snaps, log_path=log)
        elif a.action == "confirm":
            review.confirm_unchanged(doc, st, a.entry_id, a.reviewer, today, snapshots_dir=snaps, log_path=log)
        else:
            review.repeal(doc, a.entry_id, a.reviewer, today, labels=lab["repeal"], note=a.note, superseded_by=a.superseded_by, log_path=log)
    except review.ReviewError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    (d / f"reference_entries_{ed}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=2), "utf-8")
    store.state_path(ed).write_text(json.dumps(st, ensure_ascii=False, indent=1, sort_keys=True), "utf-8")
    print(f"{a.action} {a.entry_id} ({ed}) by {a.reviewer}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
