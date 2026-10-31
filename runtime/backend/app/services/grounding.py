"""Grounding rules for the AI assistant: no source, no factual policy answer; today's date is known; passed deadlines are flagged.

* A policy, tax or legal question that retrieves no source gets a fixed "no source" reply and the model is not called, so it
  cannot invent an answer (it once expanded OBBBA into "Office of Budget and Budgetary Analysis").
* The status line is the first line of the reply, not a footnote.
* The prompt carries today's date and the dated events recorded on the retrieved sources (``key_dates``), each marked
  PASSED or UPCOMING, so an answer does not tell a user to meet a deadline that closed months ago.
* After generation, any date in the answer that sits next to a deadline word and is already in the past is listed in
  ``time_check`` and a one-line note is appended.
"""
from __future__ import annotations

import re
from datetime import date
from typing import Any, Dict, List, Optional, Sequence

_POLICY_EN = re.compile(
    r"\b(tax|itc|ptc|obbba?|48e|45y|incentive|subsid\w*|tariff|law|legislation|regulation|regulatory|policy|"
    r"statute|irs|treasury|ferc|compliance|permit\w*|eligib\w*|deadline|rebate|net metering|feed-in)\b",
    re.I,
)
_POLICY_ZH = re.compile(r"政策|补贴|税|电价|法规|条例|办法|通知|文件|规定|审批|备案|合规|抵免|资格|截止|并网规定|文号")

NO_SOURCE = {
    "global": (
        "Status: No source in our library matches this question, so I can't give a factual answer on it.\n\n"
        "Policy, tax and legal questions are answered only from documents in the source library, with a link and a date. "
        "Try naming the law or notice (for example \"IRS Notice 2025-42\"), or check the official publisher directly. "
        "I won't guess at what a law or credit says."
    ),
    "cn": (
        "状态：本库没有收录与该问题相关的资料，无法给出事实性回答。\n\n"
        "政策、税务和法规类问题只依据资料库里带链接和日期的文件回答。"
        "请写出文件名称或文号，或直接查看发布机构的官方网站。我不会凭印象推测政策内容。"
    ),
}

NO_SOURCE_BACKGROUND = {
    "global": "Status: No library source supports this answer. Treat it as general background, not a cited fact.",
    "cn": "状态：本库没有资料支撑这条回答，请当作一般性背景，而不是有出处的事实。",
}

_MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"], 1)}
_DATE_PATTERNS = [
    re.compile(r"\b(?P<y>20\d{2})-(?P<m>\d{2})-(?P<d>\d{2})\b"),
    re.compile(r"\b(?P<mon>[A-Z][a-z]+)\.? (?P<d>\d{1,2}),? (?P<y>20\d{2})\b"),
    re.compile(r"\b(?P<d>\d{1,2}) (?P<mon>[A-Z][a-z]+)\.?,? (?P<y>20\d{2})\b"),
    re.compile(r"(?P<y>20\d{2})年(?P<m>\d{1,2})月(?P<d>\d{1,2})日"),
]
_DEADLINE_WORDS = re.compile(
    r"before|by |until|deadline|no later than|on or before|prior to|must begin|must start|must be placed|in order to qualify|"
    r"之前|截止|前须|前必须|不晚于|须在|必须在",
    re.I,
)


def is_policy_question(query: str) -> bool:
    return bool(_POLICY_EN.search(query or "") or _POLICY_ZH.search(query or ""))


def no_source_reply(market: str) -> str:
    return NO_SOURCE["global" if market == "global" else "cn"]


def background_status(market: str) -> str:
    return NO_SOURCE_BACKGROUND["global" if market == "global" else "cn"]


def key_dates_prompt(hits: Sequence[Any], today: date, market: str) -> str:
    """'Today is ...' plus the dated events of the retrieved sources, each marked PASSED / UPCOMING."""
    lines: List[str] = []
    for i, h in enumerate(hits, 1):
        for kd in (getattr(h, "metadata", None) or {}).get("key_dates") or []:
            try:
                d = date.fromisoformat(str(kd["date"]))
            except (KeyError, ValueError):
                continue
            state = "PASSED" if d < today else "UPCOMING"
            lines.append(f"- {d.isoformat()} [{state}] {kd.get('event', '')} [S{i}]")
    head = (f"\n\nToday's date is {today.isoformat()}. Never present a date that is already PASSED as a future requirement; "
            "say it has passed and state what applies now, using only the sources.") if market == "global" else (
            f"\n\n今天的日期是 {today.isoformat()}。已标注 PASSED 的日期不得写成未来要求，应说明已过期并只依据资料说明现在适用的规则。")
    if not lines:
        return head
    return head + ("\nDated events from the sources:\n" if market == "global" else "\n资料中的日期事件：\n") + "\n".join(lines)


def _parse_dates(text: str) -> List[Dict[str, Any]]:
    found = []
    for rx in _DATE_PATTERNS:
        for m in rx.finditer(text):
            g = m.groupdict()
            try:
                y = int(g["y"])
                d = int(g["d"])
                mo = int(g["m"]) if g.get("m") else _MONTHS[g["mon"].lower()]
                found.append({"date": date(y, mo, d), "start": m.start(), "end": m.end()})
            except (KeyError, ValueError):
                continue
    return found


def date_check(answer: str, today: date) -> List[Dict[str, str]]:
    """Dates in the answer that are in the past and sit next to a deadline word."""
    out: List[Dict[str, str]] = []
    seen = set()
    for hit in _parse_dates(answer or ""):
        if hit["date"] >= today or hit["date"] in seen:
            continue
        window = answer[max(0, hit["start"] - 80): hit["end"] + 40]
        if _DEADLINE_WORDS.search(window):
            seen.add(hit["date"])
            out.append({"date": hit["date"].isoformat(), "context": re.sub(r"\s+", " ", window).strip()})
    return out


def time_note(expired: Sequence[Dict[str, str]], today: date, market: str) -> str:
    if not expired:
        return ""
    ds = ", ".join(e["date"] for e in expired)
    if market == "global":
        return (f"\n\nDate check: {ds} has already passed (today is {today.isoformat()}). "
                "Do not read it as a future deadline; check the cited source for what applies now.")
    return f"\n\n日期核对：{ds} 已经过去（今天是 {today.isoformat()}），不要当作未来的截止日期，请以所引用资料中现行规定为准。"
