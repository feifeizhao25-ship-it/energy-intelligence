"""政策正文的条款级结构化差异。

抓取回来的政策正文先切成「条款」（第X条 / 一、二、 / （一）（二））再逐条比对，
而不是只比总字数。复核人在企业微信里看到的是：新增了哪几条、删了哪几条、哪几条改了什么。
不做任何发布决定；发布仍然只认「审批通过 + 摘要一致」（policy_pipeline.publish_approved）。
"""
from __future__ import annotations

import difflib
import re

_CN_NUM = "一二三四五六七八九十百零〇两"
_HEAD = re.compile(
    rf"(第[{_CN_NUM}\d]+条|(?<![（(\d])[{_CN_NUM}]{{1,3}}、|[（(][{_CN_NUM}\d]{{1,3}}[）)]|(?<![\d.])\d{{1,2}}[、.．](?=[^\d]))"
)


def _is_top(head: str) -> bool:
    return head.startswith("第") or head.endswith("、") or (head[:1].isdigit() and not head.startswith(("(", "（")))


def split_clauses(text: str) -> list[dict]:
    """返回 [{key, head, body}]。key 带上层级，如「二、（一）」；没有任何条款标记时整篇算一条「正文」。"""
    text = re.sub(r"\s+", " ", text or "").strip()
    marks = list(_HEAD.finditer(text))
    if not marks:
        return [{"key": "正文", "head": "", "body": text}] if text else []
    out: list[dict] = []
    top = ""
    seen: dict[str, int] = {}
    if marks[0].start() > 0 and text[: marks[0].start()].strip():
        out.append({"key": "前言", "head": "", "body": text[: marks[0].start()].strip()})
    for i, m in enumerate(marks):
        head = m.group(0)
        body = text[m.end(): marks[i + 1].start() if i + 1 < len(marks) else len(text)].strip()
        if _is_top(head):
            top, key = head, head
        else:
            key = f"{top}{head}"
        seen[key] = seen.get(key, 0) + 1
        if seen[key] > 1:
            key = f"{key}#{seen[key]}"
        out.append({"key": key, "head": head, "body": body})
    return out


def diff_clauses(previous: str, current: str, similarity_floor: float = 0.0) -> dict:
    """条款级差异。modified 里带相似度和前后文本；全文相同则 changed=False。"""
    old = {c["key"]: c["body"] for c in split_clauses(previous)}
    new = {c["key"]: c["body"] for c in split_clauses(current)}
    added = [{"key": k, "body": new[k]} for k in new if k not in old]
    removed = [{"key": k, "body": old[k]} for k in old if k not in new]
    modified = []
    unchanged = 0
    for k in new:
        if k in old:
            if old[k] == new[k]:
                unchanged += 1
            else:
                ratio = difflib.SequenceMatcher(None, old[k], new[k]).ratio()
                if ratio >= similarity_floor:
                    modified.append({"key": k, "before": old[k], "after": new[k], "similarity": round(ratio, 3)})
    return {
        "changed": bool(added or removed or modified),
        "added": added,
        "removed": removed,
        "modified": modified,
        "unchanged": unchanged,
        "summary": f"新增{len(added)}条，删除{len(removed)}条，修改{len(modified)}条，未变{unchanged}条",
    }
