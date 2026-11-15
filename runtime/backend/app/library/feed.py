"""「为你推荐」排序：纯函数，同样的输入得到同样的结果。

只用用户自己填写的和在应用里做过的事：角色、关注的技术、目标、地区、自己的项目（技术、有没有做过财务模型）、
关注/静音的主题、读过哪些；以及资料库本身的变化（新增、更新）。不用任何外部数据，也不给投资建议。
打分（加法，原因逐条写给用户看）：
  关注的主题 +5   关注的技术 +3   项目的技术 +2   角色 +2   目标 +2   项目还没做财务模型且是电价/市场类 +2
  地区（只对有地区范围的条目，如美国/英国）+2   读过同类 +1（上限 +2）
  最近 14 天更新 +2 / 上次来访之后更新 +3（只对在意这个主题或看过旧版本的人）   上次来访之后新增 +2
  这条自己读过 -6（14 天内）   最近 3 天推荐过 -3、7 天内 -2   静音主题：不出现
国内版条目都是全国性文件，没有省份范围，所以国内版不拿省份当推荐理由（写在说明里，不假装按省推荐）。
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

TOPICS = {
    "policy": {"zh": "法律与政策", "en": "Policy & regulation"},
    "solar": {"zh": "光伏", "en": "Solar"},
    "wind": {"zh": "风电", "en": "Wind"},
    "storage": {"zh": "储能与电网", "en": "Storage & grid"},
    "market": {"zh": "电价与市场", "en": "Prices & markets"},
    "stats": {"zh": "行业统计", "en": "Industry statistics"},
}
# 条目 → 主题：关键词命中（标题 + 标签，中英文），再加上分类带来的主题
KEYWORDS = {
    "solar": ("光伏", "solar", "pv"),
    "wind": ("风电", "wind"),
    "storage": ("储能", "新型电力系统", "抽水蓄能", "battery", "storage", "并网", "调度", "grid"),
    "market": ("电价", "价格", "绿证", "需求响应", "收购", "上网电价", "wholesale", "price", "auction", "cfd", "strike", "ppa"),
}
CATEGORY_TOPIC = {"法律法规": "policy", "统计数据": "stats", "Market data": "stats", "Market reports": "stats", "Auction results": "market"}
TECH_TOPICS = {"solar_pv": {"solar"}, "wind": {"wind"}, "storage": {"storage"}, "hybrid": {"solar", "wind", "storage"}}
ROLE_TOPICS = {"investor": {"market", "stats"}, "operations": {"policy", "storage"}, "developer": {"policy", "solar", "wind"}, "analyst": {"stats", "market"}}
GOAL_TOPICS = {"yield": {"market", "solar", "wind"}, "reliability": {"storage", "policy"}, "pipeline": {"policy"}, "market": {"market", "stats"}}
NAMES = {
    "role": {"zh": {"investor": "投资人", "operations": "运维", "developer": "开发", "analyst": "分析"},
             "en": {"investor": "investor", "operations": "operations", "developer": "developer", "analyst": "analyst"}},
    "tech": {"zh": {"solar_pv": "光伏", "wind": "风电", "storage": "储能", "hybrid": "风光储混合"},
             "en": {"solar_pv": "solar PV", "wind": "wind", "storage": "storage", "hybrid": "hybrid"}},
    "goal": {"zh": {"yield": "提高收益", "reliability": "运行可靠", "pipeline": "项目储备", "market": "看懂市场"},
             "en": {"yield": "yield", "reliability": "reliability", "pipeline": "project pipeline", "market": "market insight"}},
}
# 有地区范围的条目（国际版）：按来源判断；用户填的地区含这些词才算匹配
REGION_ALIASES = {
    "us": ("us", "usa", "u.s.", "united states", "america", "texas", "california", "arizona", "nevada", "new mexico", "new york", "pjm", "ercot"),
    "uk": ("uk", "u.k.", "united kingdom", "britain", "england", "scotland", "wales"),
}
REGION_NAMES = {"us": {"zh": "美国", "en": "the US"}, "uk": {"zh": "英国", "en": "the UK"}}
REGION_SOURCE = {"us": ("energy information administration", "pjm"), "uk": ("department for energy security", "gov.uk")}
RECENT_UPDATE_DAYS = 14


@dataclass
class Signals:
    lang: str = "zh"
    enabled: bool = True
    role: str = ""
    techs: frozenset = frozenset()          # 用户选的关注技术
    project_techs: frozenset = frozenset()  # 项目里的技术
    goal: str = ""
    region: str = ""
    missing_finance: bool = False           # 有项目还没做财务模型
    followed: frozenset = frozenset()
    muted: frozenset = frozenset()
    opened: dict = field(default_factory=dict)   # entry_id -> date last opened
    shown: dict = field(default_factory=dict)    # entry_id -> date last shown in a feed
    last_visit: Optional[date] = None


def topics_of(entry: dict) -> set:
    text = (entry.get("title", "") + " " + " ".join(entry.get("tags", []))).lower()
    out = {t for t, words in KEYWORDS.items() if any(w in text for w in words)}
    cat = CATEGORY_TOPIC.get(entry.get("category", ""))
    if cat:
        out.add(cat)
    return out or {"policy"}


def primary_topic(entry: dict) -> str:
    return CATEGORY_TOPIC.get(entry.get("category", "")) or sorted(topics_of(entry))[0]


def region_of(entry: dict) -> Optional[str]:
    pub = ((entry.get("source") or {}).get("publisher", "") + " " + (entry.get("source") or {}).get("url", "")).lower()
    for r, words in REGION_SOURCE.items():
        if any(w in pub for w in words):
            return r
    return None


def region_match(entry: dict, region: str) -> Optional[str]:
    r = region_of(entry)
    if not r or not region:
        return None
    toks = {x for x in region.lower().replace(",", " ").replace("/", " ").split() if x}
    low = region.lower()
    return r if any((a in toks) or (len(a) > 3 and a in low) for a in REGION_ALIASES[r]) else None


def _noise(user_key: str, day: date, eid: str) -> float:
    h = hashlib.sha256(f"{user_key}|{day.isoformat()}|{eid}".encode()).digest()
    return int.from_bytes(h[:4], "big") / 2**32 * 0.9


def topic_list(sig: Signals) -> list:
    return [{"id": k, "name": v[sig.lang], "followed": k in sig.followed, "muted": k in sig.muted} for k, v in TOPICS.items()]


def _reason(parts: list, lang: str) -> str:
    zh = {
        "follow": lambda v: f"你关注了「{TOPICS[v]['zh']}」", "tech": lambda v: f"你关注的技术：{NAMES['tech']['zh'][v]}",
        "project": lambda v: f"你的项目用到{NAMES['tech']['zh'][v]}", "role": lambda v: f"你的角色：{NAMES['role']['zh'][v]}",
        "goal": lambda v: f"你的目标：{NAMES['goal']['zh'][v]}", "finance": lambda v: "你有项目还没做财务模型",
        "region": lambda v: f"你填的地区：{REGION_NAMES[v]['zh']}", "read": lambda v: "你读过同类内容",
        "updated": lambda v: "最近有更新", "new": lambda v: "上次来之后新增的",
    }
    en = {
        "follow": lambda v: f'You follow "{TOPICS[v]["en"]}"', "tech": lambda v: f"Your focus: {NAMES['tech']['en'][v]}",
        "project": lambda v: f"Your project uses {NAMES['tech']['en'][v]}", "role": lambda v: f"Your role: {NAMES['role']['en'][v]}",
        "goal": lambda v: f"Your goal: {NAMES['goal']['en'][v]}", "finance": lambda v: "You have a project without a financial model",
        "region": lambda v: f"Your region: {REGION_NAMES[v]['en']}", "read": lambda v: "You read similar items",
        "updated": lambda v: "Recently updated", "new": lambda v: "New since your last visit",
    }
    tab = zh if lang == "zh" else en
    if not parts:
        return "今天的通用参考" if lang == "zh" else "General reference for today"
    return ("；" if lang == "zh" else "; ").join(tab[k](v) for k, v in parts)


def score(entry: dict, sig: Signals, topics_by_id: dict) -> tuple[float, list, list]:
    ts = topics_of(entry)
    s, parts, codes = 0.0, [], []
    hit = sorted(ts & sig.followed)
    if hit:
        s += 5; parts.append(("follow", hit[0])); codes.append("follow")
    for tech in sorted(sig.techs):
        if ts & TECH_TOPICS.get(tech, set()):
            s += 3; parts.append(("tech", tech)); codes.append("tech"); break
    for tech in sorted(sig.project_techs - sig.techs):
        if ts & TECH_TOPICS.get(tech, set()):
            s += 2; parts.append(("project", tech)); codes.append("project"); break
    if sig.role in ROLE_TOPICS and ts & ROLE_TOPICS[sig.role]:
        s += 2; parts.append(("role", sig.role)); codes.append("role")
    if sig.goal in GOAL_TOPICS and ts & GOAL_TOPICS[sig.goal]:
        s += 2; parts.append(("goal", sig.goal)); codes.append("goal")
    if sig.missing_finance and "market" in ts:
        s += 2; parts.append(("finance", "")); codes.append("finance")
    r = region_match(entry, sig.region)
    if r:
        s += 2; parts.append(("region", r)); codes.append("region")
    same = sum(1 for oid in sig.opened if oid != entry["id"] and topics_by_id.get(oid, set()) & ts)
    if same:
        s += min(2, same) * 1.0; parts.append(("read", "")); codes.append("read")
    return s, parts, codes


def _d(v) -> Optional[date]:
    from ..library_live.util import parse_day

    return parse_day(v)


def d_badges(e: dict) -> list:
    return e["display"]["badges"]


def rank(items: list[dict], sig: Signals, user_key: str, today: date, *, limit: int = 6) -> dict:
    """items：store.annotated() 的结果（每条带 display）。返回 {"items": [...], "enabled": bool}。"""
    if not sig.enabled:
        return {"items": [], "enabled": False}
    topics_by_id = {e["id"]: topics_of(e) for e in items}
    ref = sig.last_visit or (today - timedelta(days=14))
    out = []
    for e in items:
        d = e["display"]
        if not d["feed_eligible"]:
            continue
        ts = topics_by_id[e["id"]]
        if ts & sig.muted:  # 条目的任一主题被静音就不出现
            continue
        s, parts, codes = score(e, sig, topics_by_id)
        badge = None
        appr, upd = _d(e.get("approved_at")), _d(e.get("updated_on"))
        # 「更新」只对在意这个主题的人、或者之前看过旧版本的人有意义；和他无关就不为它加分、不挂徽标
        relevant = s >= 3 or e["id"] in sig.shown or e["id"] in sig.opened
        if appr and appr > ref:
            badge = "new"; s += 2 if relevant else 1; parts.append(("new", "")); codes.append("new")
        elif upd and relevant and upd > ref:
            badge = "updated"; s += 3; parts.append(("updated", "")); codes.append("updated")
        elif upd and relevant and (today - upd).days <= RECENT_UPDATE_DAYS:
            s += 2; parts.append(("updated", "")); codes.append("updated")
        opened = sig.opened.get(e["id"])
        if opened and (today - opened).days <= 14 and badge != "updated":
            s -= 6
        shown = sig.shown.get(e["id"])
        if shown and shown < today:
            age = (today - shown).days
            s -= 3 if age <= 3 else 2 if age <= 7 else 0
        s += _noise(user_key, today, e["id"])
        out.append((s, e, parts, codes, badge, sorted(ts)))
    out.sort(key=lambda x: (-x[0], x[1]["id"]))
    items_out = []
    for s, e, parts, codes, badge, ts in out[:limit]:
        src = e.get("source", {})
        items_out.append({
            "id": e["id"], "title": e["title"], "summary": e["summary"], "category": e["category"], "topics": ts, "topic": primary_topic(e), "topic_name": TOPICS[primary_topic(e)][sig.lang],
            "reason": _reason(parts, sig.lang), "reason_codes": codes, "badge": badge, "badges": d_badges(e), "change_note": e["display"]["change_note"],
            "last_verified_at": e["display"]["last_verified_at"], "updated_on": e.get("updated_on"), "status": e.get("status"),
            "source": {"title": src.get("title"), "publisher": src.get("publisher"), "url": src.get("url"), "doc_no": src.get("doc_no")}, "score": round(s, 2),
        })
    return {"items": items_out, "enabled": True}


def home_card(feed: dict, lang: str = "zh") -> Optional[dict]:
    """工作台只放一张：有「新增/更新」或匹配度很高才出现，否则不打扰。"""
    its = feed.get("items") or []
    if not feed.get("enabled") or not its:
        return None
    pick = next((i for i in its if i["badge"]), None) or (its[0] if its[0]["score"] >= 5 else None)
    if not pick:
        return None
    if lang == "zh":
        title = f"资料库有更新：{pick['title']}" if pick["badge"] == "updated" else f"资料库新增：{pick['title']}" if pick["badge"] == "new" else f"为你选了一篇：{pick['title']}"
    else:
        title = f"Library updated: {pick['title']}" if pick["badge"] == "updated" else f"New in the library: {pick['title']}" if pick["badge"] == "new" else f"Picked for you: {pick['title']}"
    return {"id": "library_for_you", "kind": "library", "title": title, "body": pick["summary"], "reason": pick["reason"], "bases": ["library"],
            "href": "/library", "entry_id": pick["id"]}
