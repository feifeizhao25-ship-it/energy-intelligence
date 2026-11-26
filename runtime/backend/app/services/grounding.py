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


_DEFINITION = re.compile(
    r"(什么是|是什么|何谓|如何定义|定义是什么|what is|what are|\bdefine\b|definition of|how is .{0,48} defined)",
    re.I,
)
_TECHNICAL = re.compile(
    r"(?<![A-Za-z])(lcoe|ghi|dni|dhi|capacity factor|irradiance|inverter|soiling|degradation)(?![A-Za-z])|"
    r"度电成本|平准化度电成本|水平面总辐射|法向直接|散射辐射|容量系数|逆变器|灰损",
    re.I,
)
_DEFINITION_TEXT = {
    "lcoe": {
        "zh": "度电成本（LCOE）是把项目寿命期内的成本现值，除以同期发电量的现值。这是术语解释，不是电价，也不是政策原文。",
        "en": "Levelized cost of energy (LCOE) is the present value of lifetime costs divided by the present value of lifetime electricity output. This is a definition, not a tariff and not a statute.",
    },
    "ghi": {
        "zh": "水平面总辐射（GHI）是水平面上接收到的太阳总辐射，包含直射和散射。这是术语解释，不是某地的实测值。",
        "en": "Global horizontal irradiance (GHI) is the total solar radiation received on a horizontal surface, direct plus diffuse. This is a definition, not a measured value for a site.",
    },
    "dni": {
        "zh": "法向直接辐射（DNI）是与太阳光束垂直的平面上的直接辐射，不含散射。这是术语解释，不是某地的实测值。",
        "en": "Direct normal irradiance (DNI) is the solar beam on a surface kept normal to the sun, excluding diffuse light. This is a definition, not a measured value for a site.",
    },
    "dhi": {
        "zh": "散射辐射（DHI）是水平面上接收到的散射部分，不含直射。这是术语解释，不是某地的实测值。",
        "en": "Diffuse horizontal irradiance (DHI) is the diffuse part of sunlight on a horizontal surface, excluding the direct beam. This is a definition, not a measured value for a site.",
    },
    "capacity": {
        "zh": "容量系数是一段时间内的实际发电量，除以装机容量在同一时段满发所能发出的电量。这是术语解释，不是某个项目的运行结果。",
        "en": "Capacity factor is actual generation over a period divided by the generation the plant would produce if it ran at full capacity the whole time. This is a definition, not a plant's operating result.",
    },
}


def is_definition_question(query: str) -> bool:
    """A technical definition is not a policy question, even if the sentence also says 电价 or policy."""
    return bool(_DEFINITION.search(query or "") and _TECHNICAL.search(query or ""))


def definition_reply(query: str, market: str) -> Optional[str]:
    if not is_definition_question(query):
        return None
    lang = "en" if market == "global" else "zh"
    text = query or ""
    if re.search(r"lcoe|度电成本|平准化", text, re.I):
        key = "lcoe"
    elif re.search(r"\bdni\b|法向直接", text, re.I):
        key = "dni"
    elif re.search(r"\bdhi\b|散射", text, re.I):
        key = "dhi"
    elif re.search(r"capacity factor|容量系数", text, re.I):
        key = "capacity"
    else:
        key = "ghi"
    return _DEFINITION_TEXT[key][lang]


def is_policy_question(query: str) -> bool:
    if is_definition_question(query):
        return False
    return bool(_POLICY_EN.search(query or "") or _POLICY_ZH.search(query or ""))


# 2026-11-21 test: a German user asking about the EEG feed-in tariff was told to try "IRS Notice 2025-42".
# The example in the global no-source reply now follows the jurisdiction the question names, else the
# user's profile country, else none. Examples are names of real instruments and official publishers only;
# they are a hint for rephrasing, not a claim that the library holds them.
_JURISDICTION_PATTERNS = [
    ("DE", re.compile(r"\b(eeg|germany|german|deutschland|bundesnetzagentur|bnetza|einspeiseverg\w*|marktstammdatenregister|kfw)\b", re.I)),
    ("GB", re.compile(r"\b(uk|united kingdom|britain|british|england|scotland|wales|ofgem|smart export guarantee|seg|desnz)\b", re.I)),
    ("AU", re.compile(r"\b(australia|australian|clean energy regulator|stcs?|aemo|nsw|victoria|queensland)\b", re.I)),
    ("EU", re.compile(r"\b(eu|european union|european commission|red iii|renewable energy directive)\b", re.I)),
    ("US", re.compile(r"\b(irs|treasury|ira|inflation reduction act|obbba?|48e|45y|itc|ptc|ferc|united states|u\.s\.|usa|federal)\b", re.I)),
]
_COUNTRY_ALIASES = {
    "us": "US", "usa": "US", "united states": "US", "united states of america": "US",
    "de": "DE", "germany": "DE", "deutschland": "DE",
    "gb": "GB", "uk": "GB", "united kingdom": "GB", "great britain": "GB", "england": "GB",
    "au": "AU", "australia": "AU",
}
_EXAMPLE_HINT = {
    "US": 'Try naming the law, section or notice (for example "IRS Notice 2025-42" or "Section 48E"), or check the IRS or Treasury directly.',
    "DE": 'Try naming the law and section (for example "EEG 2023, § 48" for the solar feed-in tariff), or check the Bundesnetzagentur or gesetze-im-internet.de directly.',
    "GB": 'Try naming the scheme (for example "Smart Export Guarantee"), or check Ofgem or GOV.UK directly.',
    "AU": 'Try naming the scheme (for example "Small-scale Renewable Energy Scheme"), or check the Clean Energy Regulator directly.',
    "EU": 'Try naming the act (for example "Directive (EU) 2023/2413"), or check EUR-Lex directly.',
    None: "Try naming the law or notice and the country it applies to, or check the official publisher directly.",
}


def jurisdiction_of(query: str, user_country: Optional[str] = None) -> Optional[str]:
    """The jurisdiction a question is about: what the question names first, then the user's country."""
    q = query or ""
    for code, pattern in _JURISDICTION_PATTERNS:
        if pattern.search(q):
            return code
    return _COUNTRY_ALIASES.get((user_country or "").strip().lower())


def no_source_reply(market: str, query: str = "", user_country: Optional[str] = None) -> str:
    if market != "global":
        return NO_SOURCE["cn"]
    hint = _EXAMPLE_HINT[jurisdiction_of(query, user_country)]
    return (
        "Status: No source in our library matches this question, so I can't give a factual answer on it.\n\n"
        "Policy, tax and legal questions are answered only from documents in the source library, with a link and a date. "
        f"{hint} I won't guess at what a law or credit says."
    )


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


_SENT_END = re.compile(r"(?<=[.!?;])\s|\n|[。；！？]")


def _window(text: str, start: int, end: int) -> str:
    """The text around a date, limited to the sentence it is in (a deadline word in the next sentence is not about it)."""
    left = text[max(0, start - 80):start]
    for m in _SENT_END.finditer(left):
        left = left[m.end():]
    right = text[end:end + 40]
    m = _SENT_END.search(right)
    if m:
        right = right[:m.start()]
    return left + text[start:end] + right


def date_check(answer: str, today: date) -> List[Dict[str, str]]:
    """Dates in the answer that are in the past and sit next to a deadline word."""
    out: List[Dict[str, str]] = []
    seen = set()
    for hit in _parse_dates(answer or ""):
        if hit["date"] >= today or hit["date"] in seen:
            continue
        window = _window(answer, hit["start"], hit["end"])
        if _DEADLINE_WORDS.search(window):
            seen.add(hit["date"])
            out.append({"date": hit["date"].isoformat(), "context": re.sub(r"\s+", " ", window).strip()})
    return out


def mark_expired(answer: str, today: date, market: str) -> str:
    """Put "(already passed)" right after every past date that sits next to a deadline word, so the sentence itself no
    longer reads as a live requirement (the trailing note alone was easy to miss)."""
    text = answer or ""
    marks = []
    for hit in _parse_dates(text):
        if hit["date"] >= today:
            continue
        window = _window(text, hit["start"], hit["end"])
        if _DEADLINE_WORDS.search(window):
            marks.append(hit["end"])
    for end in sorted(set(marks), reverse=True):
        tag = " (already passed)" if market == "global" else "（已过期）"
        if text[end:end + len(tag)] != tag:
            text = text[:end] + tag + text[end:]
    return text


def _join_dates(dates: Sequence[str], market: str) -> str:
    if market != "global" or len(dates) < 2:
        return ", ".join(dates) if market == "global" else "、".join(dates)
    return ", ".join(dates[:-1]) + " and " + dates[-1]


def time_note(expired: Sequence[Dict[str, str]], today: date, market: str) -> str:
    if not expired:
        return ""
    dates = [e["date"] for e in expired]
    if market == "global":
        many = len(dates) > 1
        return (f"\n\nDate check: {_join_dates(dates, market)} {'have' if many else 'has'} already passed (today is {today.isoformat()}). "
                f"Do not read {'them as future deadlines' if many else 'it as a future deadline'}; check the cited source for what applies now.")
    return f"\n\n日期核对：{_join_dates(dates, market)} 已经过去（今天是 {today.isoformat()}），不要当作未来的截止日期，请以所引用资料中现行规定为准。"
