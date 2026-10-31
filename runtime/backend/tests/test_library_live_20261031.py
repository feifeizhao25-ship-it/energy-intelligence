"""新能源智库资料库：自动更新（来源核对任务）+ 个性化「为你推荐」+ 接入工作台，国内版与国际版各自独立。

5 个用户 × 7 天（国内 3 人、国际 2 人），周四来源变化：
  * 来源内容变了（数字改了）的条目，核对后必须立刻停止被推荐、挂「来源有更新」提示；
  * 周五审核人读过来源、写了变更说明，条目回到推荐里并带「更新于」和变更说明，只给相关的人；
  * 来源页出现「废止/withdrawn」的条目、被人工废止的条目，从周四起任何人的列表、推荐、工作台卡片里都不能出现，直接打开只看到「已废止/核对中」横幅。
所有网络都用假的抓取函数，不联网。
"""
import json
import os
import pathlib
import re
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.error import HTTPError
from zoneinfo import ZoneInfo

import pytest

from app.api.v1 import library as library_api
from app.api.v1 import workbench as wb
from app.core.security import create_access_token, hash_password
from app.library import feed as fd
from app.library import review_cli, service, store
from app.library_live import review
from app.models.database import Project
from app.models.user import User
from app.self_improve import library_job as job

CJK = re.compile(r"[\u3400-\u9fff]")
MON = date(2026, 11, 2)
SH = ZoneInfo("Asia/Shanghai")
FORBIDDEN_ZH = ("保证收益", "稳赚", "建议买入", "必涨", "投资建议：")
FORBIDDEN_EN = ("guaranteed return", "buy now", "sure profit", "you should invest")
CN_UPDATED, GL_UPDATED = "en-lib-010", "en-intl-001"   # 来源数字变化 → 周五人工更新
GL_REPEAL_PAGE, CN_REPEALED = "en-intl-004", "en-lib-013"  # 来源页写「withdrawn」；人工废止

_PAGE = "<html><head><title>{t}</title></head><body><nav>menu</nav><p>views: {views}</p>{body}</body></html>"


def build_pages(docs, *, changed=(), repeal_page=()):
    pages = {}
    for doc in docs:
        for e in doc["entries"]:
            u = e["source"]["url"]
            if urlparse_host(u) in job.load_sources()["manual_hosts"]:
                continue
            body = "".join(f"<p>{u[-14:]} item {i} value {i * 10} units.</p>" for i in range(1, 30))
            sharing = {x["id"] for x in doc["entries"] if x["source"]["url"] == u}
            if sharing & set(changed):
                body = body.replace("value 10 units", "value 15 units")
            title = e["source"]["title"] + (" (this publication has been withdrawn)" if sharing & set(repeal_page) else "")
            pages[u] = _PAGE.format(t=title, body=body, views=1).encode("utf-8")
    return pages


def urlparse_host(u):
    from urllib.parse import urlparse
    return urlparse(u).hostname


def make_http(pages, *, broken=()):
    def http(url, timeout):
        if url in broken:
            raise HTTPError(url, 404, "nf", {}, None)
        return pages[url], "utf-8"
    return http


@pytest.fixture()
def lib(tmp_path, monkeypatch):
    monkeypatch.setenv("ENERGY_LIBRARY_DIR", str(tmp_path / "lib"))
    monkeypatch.setenv("SIL_DATA_DIR", str(tmp_path / "sil"))
    monkeypatch.setenv("LIBRARY_FRESHNESS_ENABLED", "1")
    monkeypatch.delenv("POLICY_REVIEWERS", raising=False)
    return tmp_path


def run_check(now, pages, **kw):
    return job.run_check(now, fetch=job.make_fetch(job.policy(), http=make_http(pages, **kw)))


def at(offset, hour=2):
    return datetime(MON.year, MON.month, MON.day, hour, tzinfo=SH) + timedelta(days=offset)


def persist(ed, doc, state):
    d = store.data_dir()
    d.mkdir(parents=True, exist_ok=True)
    (d / f"reference_entries_{ed}.json").write_text(json.dumps(doc, ensure_ascii=False), "utf-8")
    store.state_path(ed).write_text(json.dumps(state, ensure_ascii=False), "utf-8")


def approve_all(ed, doc, state, day):
    labels = ("已审核", "待审核") if ed == "cn" else ("Reviewed", "Pending review")
    for e in doc["entries"]:
        if e["status"] in ("现行", "In force"):
            review.approve(doc, state, e["id"], "test-reviewer", day, review_labels=labels)


class FakeClock:
    """把工作台和资料库接口的「今天」钉在某一天（用户本地时间 9 点）。"""
    def __init__(self, monkeypatch):
        self.mp, self.day = monkeypatch, MON

        class _Meta(type):
            def __instancecheck__(cls, obj):
                return isinstance(obj, datetime)

        clock = self

        class FakeDT(datetime, metaclass=_Meta):
            @classmethod
            def now(cls, tz=None):
                base = datetime(clock.day.year, clock.day.month, clock.day.day, 9, 0, tzinfo=SH)
                return base.astimezone(tz) if tz else base

        monkeypatch.setattr(wb, "datetime", FakeDT)
        monkeypatch.setattr(library_api, "_today", lambda zone: clock.day)

    def set(self, offset):
        self.day = MON + timedelta(days=offset)


async def make_user(db, market, profile, projects=()):
    u = User(id=str(uuid.uuid4()), phone=f"139{uuid.uuid4().hex[:8]}" if market == "cn" else None,
             email=None if market == "cn" else f"{uuid.uuid4().hex[:8]}@example.com", password_hash=hash_password("TestPass123!"), name="u", role="user",
             market=market, subscription_plan="pro", usage_quota={}, country=None if market == "cn" else "US")
    db.add(u)
    await db.commit()
    for name, tech, loc in projects:
        db.add(Project(id=str(uuid.uuid4()), user_id=u.id, name=name, technology=tech, location=loc, status="draft"))
    await db.commit()
    return u, {"Authorization": f"Bearer {create_access_token(str(u.id))}"}, profile


PERSONAS = {
    "chen": ("cn", dict(role="investor", tech_focus=["solar_pv"], goal="yield", region="江苏"), [("江苏海上风电", "wind", "江苏")], []),
    "wang": ("cn", dict(role="operations", tech_focus=["wind"], goal="reliability", region="内蒙古"), [("内蒙古风电", "wind", "内蒙古")], ["wind"]),
    "li": ("cn", dict(role="developer", tech_focus=["hybrid"], goal="pipeline", region="青海"), [], []),
    "anna": ("global", dict(role="analyst", tech_focus=["storage"], goal="market", region="Texas"), [("Austin-BESS", "storage", "Texas")], ["market"]),
    "tom": ("global", dict(role="operations", tech_focus=["solar_pv"], goal="reliability", region="Spain"), [("Seville-PV", "solar", "Spain")], []),
}
VISITORS = ("wang", "anna")


async def setup_users(client, db):
    users = {}
    for name, (market, prof, projects, follow) in PERSONAS.items():
        u, h, _ = await make_user(db, market, prof, projects)
        assert (await client.put("/api/v1/home/workbench/preferences", headers=h, json=prof)).status_code == 200
        if follow:
            assert (await client.put("/api/v1/library/preferences", headers=h, json={"follow": follow})).status_code == 200
        users[name] = (u, h)
    return users


def data(resp):
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]


def lib_cards(wbdata):
    return [c for c in wbdata["cards"] if c.get("kind") == "library"]


@pytest.mark.asyncio
async def test_five_users_seven_days_with_a_mid_week_source_update(client, db_session, lib, monkeypatch):
    clock = FakeClock(monkeypatch)
    users = await setup_users(client, db_session)
    docs = {ed: store.load_document(ed) for ed in store.EDITIONS}
    states = {}
    pages = build_pages(docs.values())
    run_check(at(0), pages)
    for ed in store.EDITIONS:
        states[ed] = store.load_state(ed)
    feeds = {n: [] for n in users}
    cards = {n: [] for n in users}
    listing = {n: [] for n in users}
    wbs = {n: [] for n in users}
    entry_lists = {}
    snapshots = {}
    for i in range(7):
        clock.set(i)
        day = MON + timedelta(days=i)
        if i == 0:  # 周一：还没有任何已审核条目，列表、推荐、工作台都是空的
            for n, (u, h) in users.items():
                assert data(await client.get("/api/v1/library/entries", headers=h))["entries"] == []
                assert data(await client.get("/api/v1/library/feed", headers=h))["items"] == []
                assert not lib_cards(data(await client.get("/api/v1/home/workbench", headers=h)))
        if i == 1:  # 周二上线：全部审核通过
            for ed in store.EDITIONS:
                approve_all(ed, docs[ed], states[ed], day)
                persist(ed, docs[ed], states[ed])
        if i == 3:  # 周四凌晨核对：两个版本各一条来源数字变了；国际版另一条来源页写明 withdrawn；国内版一条被人工废止
            pages = build_pages(docs.values(), changed=(CN_UPDATED, GL_UPDATED), repeal_page=(GL_REPEAL_PAGE,))
            review.repeal(docs["cn"], CN_REPEALED, "test-reviewer", day, labels=("已废止",), note="已被新文件替代")
            persist("cn", docs["cn"], states["cn"])
        run_check(at(i), pages)
        for ed in store.EDITIONS:
            states[ed] = store.load_state(ed)
            docs[ed] = store.load_document(ed)
        snapshots[i] = {ed: json.loads(json.dumps(states[ed])) for ed in store.EDITIONS}
        if i == 4:  # 周五：审核人读过来源、改好条目、写变更说明（国际版写英文）
            review.update(docs["cn"], states["cn"], CN_UPDATED, "test-reviewer", day, "风电前三季度新增装机数字更新")
            review.update(docs["global"], states["global"], GL_UPDATED, "test-reviewer", day, "Co-location share updated to the latest EIA figure")
            for ed in store.EDITIONS:
                persist(ed, docs[ed], states[ed])
        for n, (u, h) in users.items():
            wbd = data(await client.get("/api/v1/home/workbench", headers=h))
            again = data(await client.get("/api/v1/home/workbench", headers=h))
            assert [c["id"] for c in wbd["cards"]] == [c["id"] for c in again["cards"]], "刷新工作台不能重排"
            lc = lib_cards(wbd)
            assert len(lc) <= 1
            if lc:
                c = lc[0]
                assert c["href"] == "/library" and c["reason"] and c["id"] == "library_for_you"
                assert wbd["cards"].index(c) == min(1, len(wbd["cards"]) - 1)
            cards[n].append(lc[0] if lc else None)
            wbs[n].append(wbd)
            f = data(await client.get("/api/v1/library/feed", headers=h))
            feeds[n].append({"day": day, "ids": [x["id"] for x in f["items"]], "items": {x["id"]: x for x in f["items"]}, "raw": f})
            ent = data(await client.get("/api/v1/library/entries", headers=h))
            listing[n].append({x["id"]: x for x in ent["entries"]})
            entry_lists.setdefault(n, []).append(ent)
            assert all(x["reason"] for x in f["items"]), (n, day)
            if n in VISITORS:
                assert (await client.post("/api/v1/library/visit", headers=h)).status_code == 200
    if os.environ.get("LIB_FIXTURE_DIR"):  # 截图用：把每个人每天实际收到的接口返回原样存下来（不是手写的）
        out = pathlib.Path(os.environ["LIB_FIXTURE_DIR"])
        out.mkdir(parents=True, exist_ok=True)
        for n in users:
            for d in range(7):
                (out / f"{n}_d{d}.json").write_text(json.dumps({"feed": feeds[n][d]["raw"], "entries": entry_lists[n][d], "workbench": wbs[n][d]}, ensure_ascii=False), "utf-8")
    names = list(PERSONAS)
    by_ed = {"cn": ["chen", "wang", "li"], "global": ["anna", "tom"]}

    # 1) 版本隔离：国内版只有中文条目，国际版只有英文条目；推荐、列表、工作台卡片里没有另一种语言
    for n in names:
        ed = PERSONAS[n][0]
        own_ids = {e["id"] for e in docs[ed]["entries"]}
        for d in range(7):
            assert set(feeds[n][d]["ids"]) <= own_ids and set(listing[n][d]) <= own_ids
            blob = json.dumps({"feed": feeds[n][d]["raw"], "list": listing[n][d], "card": cards[n][d]}, ensure_ascii=False)
            if ed == "global":
                assert not CJK.search(blob), (n, d, CJK.search(blob).group(0), blob[max(0, CJK.search(blob).start() - 40):CJK.search(blob).start() + 40])
            else:
                assert not re.search(r"\b(Because|Recently updated|New since|You follow|Your role)\b", blob), (n, d)

    # 2) 周二起有内容；同一版本里每天三（两）个人的推荐两两不同；每个人的推荐在轮换
    for d in range(1, 7):
        for ed, members in by_ed.items():
            lists = [tuple(feeds[m][d]["ids"]) for m in members]
            assert all(lists) and len(set(lists)) == len(lists), (ed, d, lists)
    for n in names:
        assert len({tuple(f["ids"]) for f in feeds[n][1:]}) >= 4, n

    # 3) 周四来源变了：立刻不再推荐、不再上工作台，但列表里还看得到，带「来源有更新」横幅
    for n in names:
        ed = PERSONAS[n][0]
        upd = CN_UPDATED if ed == "cn" else GL_UPDATED
        assert upd not in feeds[n][3]["ids"] and not (cards[n][3] and cards[n][3]["entry_id"] == upd), n
        held = listing[n][3][upd]
        assert held["display"]["state"] == "source_changed" and not held["display"]["current"] and held["display"]["banner"]
        assert bool(CJK.search(held["display"]["banner"])) == (ed == "cn")
    # 4) 废止 / 废止迹象：从周四起任何地方都看不到；直接打开只有横幅
    for n in names:
        ed = PERSONAS[n][0]
        gone = CN_REPEALED if ed == "cn" else GL_REPEAL_PAGE
        for d in range(3, 7):
            assert gone not in feeds[n][d]["ids"] and gone not in listing[n][d]
            assert not (cards[n][d] and cards[n][d]["entry_id"] == gone)
    e = store.find("cn", CN_REPEALED, MON + timedelta(days=3), document=docs["cn"], state=snapshots[3]["cn"], preview=False)
    assert e["display"]["state"] == "repealed" and "废止" in e["display"]["banner"]
    e = store.find("global", GL_REPEAL_PAGE, MON + timedelta(days=3), document=docs["global"], state=snapshots[3]["global"], preview=False)
    assert e["display"]["state"] == "repeal_hold" and not CJK.search(e["display"]["banner"]) and "withdrawal" in e["display"]["banner"]

    # 5) 周五更新后：来访过、在意这个主题的人在推荐和工作台上看到「更新」和变更说明；无关的人不被打扰
    wang, anna = feeds["wang"][4]["items"].get(CN_UPDATED), feeds["anna"][4]["items"].get(GL_UPDATED)
    assert wang and wang["badge"] == "updated" and wang["change_note"] == "风电前三季度新增装机数字更新" and "最近有更新" in wang["reason"]
    assert any(b["kind"] == "updated" and "更新于" in b["text"] for b in wang["badges"])
    assert cards["wang"][4] and cards["wang"][4]["title"].startswith("资料库有更新：")
    assert anna and anna["badge"] == "updated" and anna["change_note"].startswith("Co-location") and "Recently updated" in anna["reason"]
    assert cards["anna"][4] and cards["anna"][4]["title"].startswith("Library updated:")
    assert any(b["kind"] == "updated" and "Updated" in b["text"] for b in anna["badges"])

    def saw_before(n, eid):
        return any(eid in feeds[n][d]["ids"] for d in range(0, 3))

    for n in ("chen", "tom"):  # 光伏用户：风电统计 / 美国光伏+储能的更新，只有看过旧版本才会带「更新」标记
        eid = CN_UPDATED if PERSONAS[n][0] == "cn" else GL_UPDATED
        it = feeds[n][4]["items"].get(eid)
        if it and it["badge"] == "updated":
            assert saw_before(n, eid) or fd.topics_of(next(x for x in docs[PERSONAS[n][0]]["entries"] if x["id"] == eid)) & {"solar", "wind", "storage"}
    # 6) 周二新增：首次出现的条目对没来访过的人是「新」；来访之后不再标「新」
    assert any(it["badge"] == "new" for n in names for f in feeds[n][1:2] for it in f["items"].values())
    assert all(it["badge"] != "new" for n in VISITORS for d in range(3, 7) for it in feeds[n][d]["items"].values()
               if it["id"] not in (CN_UPDATED, GL_UPDATED))
    # 7) 理由和卡片里没有承诺收益或投资建议的话（条目正文是官方资料的概括，不在此列）
    for n in names:
        bad = FORBIDDEN_EN if PERSONAS[n][0] == "global" else FORBIDDEN_ZH
        for f in feeds[n]:
            for it in f["items"].values():
                assert not [w for w in bad if w in (it["reason"] + (it["change_note"] or "")).lower()]
        for c in cards[n]:
            assert not c or not [w for w in bad if w in (c["title"] + c["reason"]).lower()]
    # 8) 角色/技术/项目/地区信号确实起作用
    reasons = {n: " ".join(it["reason"] for f in feeds[n] for it in f["items"].values()) for n in names}
    assert "你关注的技术：风电" in reasons["wang"] and "你的角色：运维" in reasons["wang"] and "你关注了「风电」" in reasons["wang"]
    assert "你的项目用到" in reasons["chen"] and "你有项目还没做财务模型" in reasons["chen"]
    assert "Your region: the US" in reasons["anna"] and "Your focus: storage" in reasons["anna"]
    assert "Your region" not in reasons["tom"]  # Spain：没有西班牙的条目，不假装按地区推荐
    assert "地区" not in " ".join(reasons[n] for n in by_ed["cn"]), "国内版条目都是全国性文件，不按省份推荐"


@pytest.mark.asyncio
async def test_switches_prefs_export_and_workbench_off(client, db_session, lib, monkeypatch):
    clock = FakeClock(monkeypatch)
    clock.set(2)
    u, h, _ = await make_user(db_session, "cn", {}, [("p", "wind", "x")])
    await client.put("/api/v1/home/workbench/preferences", headers=h, json={"tech_focus": ["wind"]})
    for ed in store.EDITIONS:
        doc, st = store.load_document(ed), {"entries": {}, "candidates": []}
        approve_all(ed, doc, st, MON)
        persist(ed, doc, st)
    f = data(await client.get("/api/v1/library/feed", headers=h))
    assert f["items"] and f["edition"] == "cn" and f["lang"] == "zh"
    assert lib_cards(data(await client.get("/api/v1/home/workbench", headers=h)))
    # 关注 / 静音 / 取消关注 / 未知主题
    p = data(await client.put("/api/v1/library/preferences", headers=h, json={"follow": ["storage"]}))
    assert p["followed"] == ["storage"] and any(t["id"] == "storage" and t["followed"] and t["name"] == "储能与电网" for t in p["topics"])
    p = data(await client.put("/api/v1/library/preferences", headers=h, json={"mute": ["storage"]}))
    assert p["muted"] == ["storage"] and p["followed"] == []
    ids = {i["id"] for i in data(await client.get("/api/v1/library/feed", headers=h))["items"]}
    assert not [e for e in store.annotated("cn", clock.day) if e["id"] in ids and "storage" in fd.topics_of(e)]
    r = await client.put("/api/v1/library/preferences", headers=h, json={"follow": ["nonsense"]})
    assert r.status_code == 422 and CJK.search(r.json()["detail"])
    await client.put("/api/v1/library/preferences", headers=h, json={"unmute": ["storage"]})
    # 导出：个人数据导出包含资料库偏好；注销后清空
    exp = (await client.get("/api/v1/privacy/export", headers=h)).json()
    assert "library_personalization" in json.dumps(exp)
    # 总开关：关了推荐为空、工作台没有这张卡；工作台个性化关了，也没有
    assert data(await client.put("/api/v1/library/preferences", headers=h, json={"enabled": False}))["enabled"] is False
    off = data(await client.get("/api/v1/library/feed", headers=h))
    assert off["items"] == [] and off["enabled"] is False
    assert not lib_cards(data(await client.get("/api/v1/home/workbench", headers=h)))
    await client.put("/api/v1/library/preferences", headers=h, json={"enabled": True})
    assert lib_cards(data(await client.get("/api/v1/home/workbench", headers=h)))
    await client.put("/api/v1/home/workbench/preferences", headers=h, json={"enabled": False})
    assert not lib_cards(data(await client.get("/api/v1/home/workbench", headers=h)))
    # 已读之后往后排；来访记录之后，列表里的「新」标记消失；不存在的条目 404（用户语言）
    await client.put("/api/v1/home/workbench/preferences", headers=h, json={"enabled": True})
    first = data(await client.get("/api/v1/library/feed", headers=h))["items"][0]["id"]
    assert (await client.post(f"/api/v1/library/opened/{first}", headers=h)).status_code == 200
    r = await client.post("/api/v1/library/opened/en-lib-999", headers=h)
    assert r.status_code == 404 and CJK.search(r.json()["detail"])
    after = data(await client.get("/api/v1/library/feed", headers=h))["items"]
    assert after[0]["id"] != first
    assert (await client.post("/api/v1/library/visit", headers=h)).status_code == 200
    clock.set(3)
    ent = data(await client.get("/api/v1/library/entries", headers=h))["entries"]
    assert all("badge" not in e for e in ent)
    # 国际版的错误信息是英文
    g, gh, _ = await make_user(db_session, "global", {})
    r = await client.post("/api/v1/library/opened/en-intl-999", headers=gh)
    assert r.status_code == 404 and not CJK.search(r.json()["detail"])
    r = await client.put("/api/v1/library/preferences", headers=gh, json={"follow": ["nonsense"]})
    assert r.status_code == 422 and not CJK.search(r.json()["detail"])
    # 要登录
    assert (await client.get("/api/v1/library/feed")).status_code == 401
    assert (await client.get("/api/v1/library/entries")).status_code == 401


@pytest.mark.asyncio
async def test_default_is_empty_and_pending_entries_are_never_visible(client, db_session, lib, monkeypatch):
    FakeClock(monkeypatch).set(2)
    for market in ("cn", "global"):
        u, h, _ = await make_user(db_session, market, {})
        assert data(await client.get("/api/v1/library/entries", headers=h))["entries"] == []
        assert data(await client.get("/api/v1/library/feed", headers=h))["items"] == []
        assert not lib_cards(data(await client.get("/api/v1/home/workbench", headers=h)))
        ed = store.edition_of(market)
        first = store.load_document(ed)["entries"][0]["id"]
        assert (await client.get(f"/api/v1/library/entries/{first}", headers=h)).status_code == 404
        assert (await client.post(f"/api/v1/library/opened/{first}", headers=h)).status_code == 404
    assert all(e["review_status"] in ("待审核", "Pending review") for ed in store.EDITIONS for e in store.load_document(ed)["entries"])


@pytest.mark.asyncio
async def test_library_failure_never_breaks_the_workbench(client, db_session, lib, monkeypatch):
    FakeClock(monkeypatch).set(2)
    u, h, _ = await make_user(db_session, "cn", {})
    monkeypatch.setattr(service, "workbench_card", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("library down")))
    d = data(await client.get("/api/v1/home/workbench", headers=h))
    assert d["personalized"] and d["cards"] and not lib_cards(d)


# ── 任务、审核、数据 ─────────────────────────────────────────

def test_job_is_off_by_default_and_runs_on_existing_sil_slots(monkeypatch, tmp_path):
    monkeypatch.delenv("LIBRARY_FRESHNESS_ENABLED", raising=False)
    assert job.run_check() == {"status": "disabled"} and job.run_discover() == {"status": "disabled"}
    from app.self_improve.scheduler import SCHEDULE_DEFAULTS
    assert job.SLOTS == {"library_check": SCHEDULE_DEFAULTS["daily_scan"], "library_discover": SCHEDULE_DEFAULTS["weekly_cycle"]}
    assert set(job.jobs()) == {"library_check", "library_discover"}
    from app.tasks import celery_app as ca
    assert not [k for k in ca._library_beat()]
    monkeypatch.setenv("LIBRARY_FRESHNESS_ENABLED", "1")
    assert set(ca._library_beat()) == {"library-check-daily", "library-discover-weekly"}
    from app.tasks import domestic_loops
    assert {domestic_loops.library_check.name, domestic_loops.library_discover.name} == {"energy.domestic.library_check", "energy.domestic.library_discover"}


def test_every_source_is_whitelisted_or_declared_manual_and_sil_whitelist_is_untouched():
    from app.self_improve.hooks import build_config
    pol, src = job.policy(), job.load_sources()
    for ed in store.EDITIONS:
        for e in store.load_document(ed)["entries"]:
            host = urlparse_host(e["source"]["url"])
            assert host in src["manual_hosts"] or pol.domain_ok(host), (e["id"], host)
        for w in src["watch"][ed]:
            assert pol.domain_ok(urlparse_host(w["listing_url"])), w["id"]
    assert not any(d in build_config().allowed_domains for d in src["extra_allowed_domains"]), "国际来源只在资料库自己的任务里放行，不改 SIL 白名单"
    # 国内版任务不会去抓国际站点
    assert not any(pol.domain_ok(urlparse_host(w["listing_url"])) and not urlparse_host(w["listing_url"]).endswith("gov.cn") for w in src["watch"]["cn"])


def test_check_writes_state_per_edition_and_discover_stages_candidates_only(lib):
    docs = {ed: store.load_document(ed) for ed in store.EDITIONS}
    pages = build_pages(docs.values())
    r = run_check(at(0), pages)
    assert r["status"] == "ok" and r["editions"]["cn"]["counts"].get("manual", 0) == 13 and r["editions"]["global"]["counts"] == {"ok": 8}
    assert store.state_path("cn").exists() and store.state_path("global").exists()
    assert (store.data_dir() / "library_report_cn.md").exists()
    # 条目不被任务改动
    for ed in store.EDITIONS:
        assert store.load_document(ed) == docs[ed]
    listing = ('<html><body><ul><li><a href="https://www.eia.gov/todayinenergy/detail.php?id=70001">Battery storage additions hit a record in 2026</a><span>2026-10-30</span></li>'
               '<li><a href="https://www.eia.gov/todayinenergy/detail.php?id=70002">Gasoline prices fall</a><span>2026-10-30</span></li></ul></body></html>')
    ndrc = ('<html><body><ul><li><a href="https://www.ndrc.gov.cn/xxgk/zcfb/tz/202610/t2026_1.html">关于完善新能源上网电价的通知</a><span>2026-10-29</span></li></ul></body></html>')

    def http(url, timeout):
        if "eia.gov/todayinenergy/" in url and "detail" not in url:
            return listing.encode(), "utf-8"
        if "ndrc.gov.cn/xxgk/zcfb/tz/" in url:
            return ndrc.encode(), "utf-8"
        if "gov.cn/zhengce" in url:
            return b"<html><body></body></html>", "utf-8"
        raise HTTPError(url, 404, "nf", {}, None)

    out = job.run_discover(at(6, 3), fetch=job.make_fetch(job.policy(), http=http))
    assert out["editions"]["cn"]["candidates"] == 1 and out["editions"]["global"]["candidates"] == 1
    cand = store.load_state("global")["candidates"][0]
    assert cand["status"] == "待核实" and cand["review_status"] == "待审核" and "正文未读" in cand["provenance"]["read_scope"]
    assert "Battery storage" in cand["title"]
    # 候选不会出现在任何用户可见的地方
    assert all(cand["id"] != e["id"] for e in store.annotated("global", MON + timedelta(days=6), preview=True))
    assert (store.data_dir() / "library_candidates_global.jsonl").read_text("utf-8").count("\n") == 1


def test_review_cli_needs_a_configured_reviewer_and_uses_edition_labels(lib, capsys):
    base = ["--edition", "cn", "approve", "en-lib-001", "--reviewer", "zhangsan"]
    assert review_cli.main(base, env={}) == 3                                 # 名单为空：无人能审（负责人没填名单前什么都不会上线）
    assert review_cli.main(base, env={"POLICY_REVIEWERS": "lisi"}) == 3        # 不在名单里
    assert not (store.data_dir() / "reference_entries_cn.json").exists()
    assert review_cli.main(base, env={"POLICY_REVIEWERS": "lisi, zhangsan"}) == 0
    cn = {e["id"]: e for e in store.load_document("cn")["entries"]}
    assert cn["en-lib-001"]["review_status"] == "已审核" and cn["en-lib-001"]["reviewer"] == "zhangsan" and cn["en-lib-001"]["approved_at"]
    assert (store.data_dir() / "library_review_log.jsonl").exists()
    env = {"POLICY_REVIEWERS": "zhangsan"}
    assert review_cli.main(["--edition", "global", "approve", "en-intl-002", "--reviewer", "zhangsan"], env=env) == 0
    gl = {e["id"]: e for e in store.load_document("global")["entries"]}
    assert gl["en-intl-002"]["review_status"] == "Reviewed"
    assert review_cli.main(["--edition", "global", "update", "en-intl-002", "--reviewer", "zhangsan"], env=env) == 2  # 更新必须写变更说明
    assert review_cli.main(["--edition", "global", "repeal", "en-intl-002", "--reviewer", "zhangsan", "--note", "withdrawn"], env=env) == 0
    assert {e["id"]: e for e in store.load_document("global")["entries"]}["en-intl-002"]["status"] == "Repealed"


def test_bundled_entries_match_the_app_assets_and_stay_pending():
    root = Path(__file__).resolve().parents[3]
    for ed, asset in (("cn", "android-cn/assets/library/energy_library_v1.json"), ("global", "android-global/assets/library/energy_library_intl_v1.json")):
        p = root / asset
        if not p.exists():  # 在只含后端的镜像里跑测试时没有 App 目录
            pytest.skip("app assets not present")
        assert json.loads(p.read_text("utf-8")) == json.loads(store.bundled_path(ed).read_text("utf-8")), ed
        for e in store.load_document(ed)["entries"]:
            assert e["review_status"] in ("待审核", "Pending review")


def test_topic_labels_and_reasons_are_single_language_and_complete():
    for lang in ("zh", "en"):
        for k, v in fd.TOPICS.items():
            assert bool(CJK.search(v[lang])) == (lang == "zh"), (k, lang)
        sig = fd.Signals(lang=lang, role="investor", techs=frozenset({"hybrid"}), project_techs=frozenset({"wind"}), goal="yield", region="Texas", missing_finance=True,
                         followed=frozenset({"policy"}))
        for code, val in (("follow", "policy"), ("tech", "wind"), ("project", "wind"), ("role", "investor"), ("goal", "yield"), ("finance", ""), ("region", "us"),
                          ("read", ""), ("updated", ""), ("new", "")):
            text = fd._reason([(code, val)], lang)
            assert text and bool(CJK.search(text)) == (lang == "zh"), (lang, code, text)
    for e in store.load_document("cn")["entries"] + store.load_document("global")["entries"]:
        assert fd.topics_of(e)
