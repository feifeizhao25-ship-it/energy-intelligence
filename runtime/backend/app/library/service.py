"""资料库的用户侧：偏好（关注/静音/总开关）、来访与已读记录、「为你推荐」、工作台卡片。

偏好和记录放在 ``User.usage_quota["library_personalization"]``（和工作台同一处），所以账号导出和注销已经覆盖，不新增表。
角色、关注技术、目标、地区和项目事实来自工作台（app.api.v1.workbench），不重复采集。
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from . import feed as fd
from . import store

KEY = "library_personalization"
KEEP_DAYS = 30


def _prefs(usage: Dict) -> Dict:
    p = dict((usage or {}).get(KEY) or {})
    p["enabled"] = bool(p.get("enabled", True))
    p["followed"] = [t for t in p.get("followed", []) if t in fd.TOPICS]
    p["muted"] = [t for t in p.get("muted", []) if t in fd.TOPICS]
    p["opened"] = dict(p.get("opened") or {})
    p["shown"] = dict(p.get("shown") or {})
    return p


def public_prefs(usage: Dict, lang: str) -> Dict:
    p = _prefs(usage)
    return {"enabled": p["enabled"], "followed": p["followed"], "muted": p["muted"], "topics": fd.topic_list(fd.Signals(lang=lang, followed=frozenset(p["followed"]), muted=frozenset(p["muted"])))}


def apply_prefs(usage: Dict, *, enabled=None, follow=(), unfollow=(), mute=(), unmute=()) -> Dict:
    """返回新的 usage（不改原对象）。未知主题抛 ValueError。"""
    bad = [t for t in (*follow, *unfollow, *mute, *unmute) if t not in fd.TOPICS]
    if bad:
        raise ValueError(f"unknown topic: {bad[0]}")
    usage = dict(usage or {})
    p = _prefs(usage)
    if enabled is not None:
        p["enabled"] = bool(enabled)
    fol, mut = set(p["followed"]), set(p["muted"])
    fol |= set(follow); fol -= set(unfollow); fol -= set(mute)
    mut |= set(mute); mut -= set(unmute); mut -= set(follow)
    p["followed"], p["muted"] = sorted(fol), sorted(mut)
    usage[KEY] = p
    return usage


def _day_map(m: Dict, today: date) -> Dict:
    out = {}
    for k, v in (m or {}).items():
        try:
            d = date.fromisoformat(v)
        except (TypeError, ValueError):
            continue
        if (today - d).days <= KEEP_DAYS:
            out[k] = d
    return out


def signals_for(user_market: Optional[str], usage: Dict, profile, facts, today: date) -> fd.Signals:
    """profile / facts：工作台的 Profile 与 ProjectFacts 列表。"""
    from app.services.personal_workbench import _norm_tech

    p = _prefs(usage)
    lang = store.LANG[store.edition_of(user_market)]
    project_techs = frozenset(t for t in (_norm_tech(f.technology) for f in facts) if t)
    techs = frozenset(t for t in (_norm_tech(x) for x in profile.tech_focus) if t)
    visit = p.get("visit")
    try:
        last_visit = date.fromisoformat(visit) if visit else None
    except ValueError:
        last_visit = None
    return fd.Signals(
        lang=lang, enabled=p["enabled"], role=profile.role or "", techs=techs, project_techs=project_techs, goal=profile.goal or "",
        region=profile.region or "", missing_finance=any(not f.has_finance for f in facts), followed=frozenset(p["followed"]), muted=frozenset(p["muted"]),
        opened=_day_map(p["opened"], today), shown=_day_map(p["shown"], today), last_visit=last_visit,
    )


def build_feed(user_id: str, user_market: Optional[str], usage: Dict, profile, facts, today: date, *, limit: int = 6, record: bool = True,
               document=None, state=None) -> tuple[dict, Dict]:
    """返回 (feed, 新的 usage)。record=True 时记下「今天推荐过什么」（让明天的推荐轮换）。"""
    edition = store.edition_of(user_market)
    sig = signals_for(user_market, usage, profile, facts, today)
    items = store.annotated(edition, today, document=document, state=state)
    out = fd.rank(items, sig, str(user_id), today, limit=limit)
    out.update({
        "topics": fd.topic_list(sig), "since": sig.last_visit.isoformat() if sig.last_visit else None, "generated_for": today.isoformat(),
        "edition": edition, "lang": sig.lang,
        "note": ("推荐只用你自己填写的角色、关注的技术和主题、你的项目进度，以及读过的内容；国内版资料都是全国性文件，不按省份推荐。资料来自官方文件，仅供了解，不构成投资或法律意见。可随时关闭。"
                 if sig.lang == "zh" else
                 "Picks use only your role, the technologies and topics you follow, your project progress and what you read. Sources are official publications, for understanding only; not investment or legal advice. You can turn this off at any time."),
    })
    if record and sig.enabled and out["items"]:
        p = _prefs(usage)
        shown = {k: v for k, v in p["shown"].items() if _fresh(v, today)}
        for i in out["items"]:
            shown[i["id"]] = today.isoformat()
        p["shown"] = shown
        usage = dict(usage or {}); usage[KEY] = p
    return out, usage


def _fresh(v, today) -> bool:
    try:
        return (today - date.fromisoformat(v)).days <= KEEP_DAYS
    except (TypeError, ValueError):
        return False


def visit_badges(usage: Dict, items: list) -> Dict:
    """列表里每条的「相对你上次来访」标记：new / updated。没有来访记录（第一次来）时不标，避免全是「新」。"""
    visit = _prefs(usage).get("visit")
    try:
        ref = date.fromisoformat(visit) if visit else None
    except ValueError:
        ref = None
    if not ref:
        return {}
    out = {}
    for e in items:
        appr, upd = fd._d(e.get("approved_at")), fd._d(e.get("updated_on"))
        if appr and appr > ref:
            out[e["id"]] = "new"
        elif upd and upd > ref:
            out[e["id"]] = "updated"
    return out


def record_visit(usage: Dict, today: date) -> Dict:
    usage = dict(usage or {}); p = _prefs(usage)
    p["visit"] = today.isoformat()
    usage[KEY] = p
    return usage


def record_open(usage: Dict, entry_id: str, today: date) -> Dict:
    usage = dict(usage or {}); p = _prefs(usage)
    opened = {k: v for k, v in p["opened"].items() if _fresh(v, today)}
    opened[entry_id] = today.isoformat()
    p["opened"] = dict(sorted(opened.items(), key=lambda kv: kv[1])[-200:])
    usage[KEY] = p
    return usage


def workbench_card(user_id: str, user_market: Optional[str], usage: Dict, profile, facts, today: date) -> Optional[dict]:
    """给个性化工作台用：返回一张卡（或 None）。不记录「已展示」，避免工作台刷新影响资料库里的排序。"""
    feed, _ = build_feed(user_id, user_market, usage, profile, facts, today, record=False)
    return fd.home_card(feed, store.LANG[store.edition_of(user_market)])
