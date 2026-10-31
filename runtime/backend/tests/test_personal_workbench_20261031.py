"""Personalised workbench: five users x seven days must visibly differ, stay in
their language, respect compliance and honour the off switch."""
import re
import uuid
from datetime import date, datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.security import create_access_token, hash_password
from app.models.database import FinancialModel, Project, ResourceAssessment
from app.models.user import User
from app.services import personal_workbench as pw

CJK = re.compile(r"[\u4e00-\u9fff]")
MON = date(2026, 11, 2)


def P(name, tech, **kw):
    return pw.ProjectFacts(id=name, name=name, technology=tech, **kw)


PERSONAS = {
    "chen": (pw.Profile(lang="zh", role="investor", tech_focus=("solar_pv",), goal="yield", region="江苏"),
             [P("Jiangsu-PV", "solar", has_resource=True, last_touched=MON)], 8),
    "wang": (pw.Profile(lang="zh", role="operations", tech_focus=("wind",), goal="reliability", region="内蒙古"),
             [P("Inner-Wind", "wind", has_resource=True, has_finance=True, has_report=True, last_touched=MON)], 6),
    "li": (pw.Profile(lang="zh", role="developer", tech_focus=("hybrid",), goal="pipeline", region="青海"), [], 20),
    "anna": (pw.Profile(lang="en", role="analyst", tech_focus=("storage",), goal="market", region="Texas"),
             [P("Austin-BESS", "storage", has_finance=True, last_touched=MON)], 13),
    "tom": (pw.Profile(lang="en", role="operations", tech_focus=("solar_pv",), goal="reliability", region="Spain"),
            [P("Seville-PV", "solar", has_resource=True, has_finance=True, last_touched=MON - timedelta(days=12))], 9),
}


def simulate(name, days=7):
    profile, projects, hour = PERSONAS[name]
    act = pw.Activity(projects=projects, last_active=max((p.last_touched for p in projects), default=None))
    boards, opened = [], []
    for i in range(days):
        day = MON + timedelta(days=i)
        now = datetime(day.year, day.month, day.day, hour, 15)
        act.open_days = tuple(opened)
        data = pw.compose(profile, act, now, user_key=name)
        boards.append(data)
        opened.append(day.isoformat())
        for c in data["cards"]:
            act.seen[c["id"]] = day.isoformat()
    return boards


def ids(b):
    return frozenset(c["id"] for c in b["cards"])


def test_five_users_differ_every_day():
    week = {n: simulate(n) for n in PERSONAS}
    for d in range(7):
        sets = {n: ids(week[n][d]) for n in PERSONAS}
        assert len(set(sets.values())) == 5, f"day {d + 1}: two users got identical boards {sets}"
        heroes = {week[n][d]["hero"]["headline"] for n in PERSONAS}
        assert len(heroes) == 5, f"day {d + 1}: identical headlines"


@pytest.mark.parametrize("name", list(PERSONAS))
def test_each_user_changes_every_day_without_repeating(name):
    boards = simulate(name)
    daily = [ids(b) for b in boards]
    assert len(set(daily)) == 7, f"{name}: a day repeated an earlier board"
    for a, b in zip(daily, daily[1:]):
        assert len(a & b) <= 2, f"{name}: too much carry-over {sorted(a & b)}"
    for b in boards:
        assert 3 <= len(b["cards"]) <= 4
        assert len({c["kind"] for c in b["cards"]}) == len(b["cards"])


def test_boards_reflect_who_the_user_is():
    week = {n: simulate(n) for n in PERSONAS}
    seen = {n: {c["id"] for b in week[n] for c in b["cards"]} for n in PERSONAS}
    assert seen["wang"] & {"ops_alarms", "ops_turbine", "ops_clean"}
    assert seen["tom"] & {"ops_alarms", "ops_clean"}
    assert "ops_turbine" not in seen["tom"] and "ops_battery" not in seen["chen"]
    assert seen["chen"] & {"inv_sens", "do_report", "do_finance", "inv_sources"}
    assert seen["li"] & {"start_project", "start_pv", "dev_siting", "dev_timeline"}
    assert seen["anna"] & {"an_papers", "an_ask", "policy_region", "storage_cycles"}
    # state drives the first step: a user without a project is told to create one, not to run a report
    assert "start_project" in {c["id"] for b in week["li"] for c in b["cards"]} or "start_pv" in seen["li"]
    assert "do_report" in {c["id"] for b in week["chen"] for c in b["cards"]} or week["chen"][0]["state"] == "no_finance"


def test_state_machine_follows_the_users_own_records():
    prof = pw.Profile(lang="en")
    today = MON
    assert pw.user_state(prof, pw.Activity(), today)[0] == "no_project"
    p = P("x", "solar")
    assert pw.user_state(prof, pw.Activity(projects=[p], last_active=today), today)[0] == "no_resource"
    p.has_resource = True
    assert pw.user_state(prof, pw.Activity(projects=[p], last_active=today), today)[0] == "no_finance"
    p.has_finance = True
    assert pw.user_state(prof, pw.Activity(projects=[p], last_active=today), today)[0] == "no_report"
    p.has_report = True
    assert pw.user_state(prof, pw.Activity(projects=[p], last_active=today), today)[0] == "has_report"
    assert pw.user_state(prof, pw.Activity(projects=[p], last_active=today - timedelta(days=9)), today)[0] == "idle"
    # storage projects do not need a wind/solar resource assessment
    s = P("s", "storage")
    assert pw.user_state(prof, pw.Activity(projects=[s], last_active=today), today)[0] == "no_finance"


def test_time_of_day_and_weekday_change_the_board_for_the_same_user():
    profile, projects, _ = PERSONAS["chen"]
    act = pw.Activity(projects=projects, last_active=MON)
    seen_ids = {}
    for hour in (8, 12, 16, 20, 23):
        d = pw.compose(profile, act, datetime(2026, 11, 2, hour, 0), "chen")
        seen_ids[hour] = (d["time_bucket"], d["hero"]["greeting"])
    assert len({v[1] for v in seen_ids.values()}) >= 4
    mon = pw.compose(profile, act, datetime(2026, 11, 2, 9, 0), "chen")
    sat = pw.compose(profile, act, datetime(2026, 11, 7, 9, 0), "chen")
    assert "mon_plan" in ids(mon) or "morning_check" in ids(mon)
    assert "mon_plan" not in ids(sat) and "fri_wrap" not in ids(sat)
    assert mon["weekday"] == "mon" and sat["weekday"] == "sat"


def test_streak_counts_consecutive_days_only():
    t = MON
    assert pw.streak([], t) == 1
    assert pw.streak([(t - timedelta(days=1)).isoformat(), (t - timedelta(days=2)).isoformat()], t) == 3
    assert pw.streak([(t - timedelta(days=2)).isoformat()], t) == 1


def test_language_gates_and_no_unfilled_placeholders():
    for name in PERSONAS:
        for b in simulate(name):
            lang = PERSONAS[name][0].lang
            blob = " ".join([b["hero"]["headline"], b["hero"]["subtext"], b["hero"]["greeting"], b["disclaimer"]]
                            + [c["title"] + c["body"] + c["reason"] for c in b["cards"]])
            assert "{" not in blob and "}" not in blob, blob
            if lang == "en":
                assert not CJK.search(blob), f"{name}: Chinese leaked into English UI: {blob}"
            else:
                assert CJK.search(blob)
                assert not re.search(r"[A-Za-z]{4,}", re.sub(r"[A-Za-z]+-[A-Za-z]+|Jiangsu|Inner|PV|Wind", "", blob.replace("Jiangsu-PV", "").replace("Inner-Wind", ""))), blob


def test_library_never_gives_investment_advice_or_forecasts():
    for c in pw.LIBRARY:
        for lang in ("zh", "en"):
            assert not pw.forbidden_hits(" ".join(c[lang])), (c["id"], pw.forbidden_hits(" ".join(c[lang])))
        assert c["href"].startswith("/")
    import json, pathlib
    terms = json.loads((pathlib.Path(__file__).resolve().parents[1] / "data" / "bottom_line_terms.json").read_text(encoding="utf-8"))
    sample = next(t for t in terms["investment_advice"] if isinstance(t, str))
    assert pw.forbidden_hits(sample), "the scanner must catch a term from the repo's own banned list"
    for lang in ("zh", "en"):
        assert "投资建议" in pw.DISCLAIMER["zh"] and "not investment advice" in pw.DISCLAIMER["en"]


def test_same_day_refresh_is_stable_and_numbers_are_the_users_own():
    profile, projects, hour = PERSONAS["chen"]
    act = pw.Activity(projects=projects, last_active=MON)
    now = datetime(2026, 11, 3, hour, 0)
    a = pw.compose(profile, act, now, "chen")
    for c in a["cards"]:
        act.seen[c["id"]] = "2026-11-03"
    b = pw.compose(profile, act, now, "chen")
    assert ids(a) == ids(b)
    nums = re.findall(r"\d+", a["hero"]["headline"])
    assert nums == ["1"]  # only the count of the user's own projects


# ---------------------------------------------------------------- API -------------------------

async def _make_user(db_session, market="cn", **kw):
    u = User(id=str(uuid.uuid4()), phone=f"139{uuid.uuid4().hex[:8]}" if market == "cn" else None,
             email=None if market == "cn" else f"{uuid.uuid4().hex[:8]}@example.com",
             password_hash=hash_password("TestPass123!"), name="u", role="user", market=market,
             subscription_plan="pro", usage_quota={}, **kw)
    db_session.add(u)
    await db_session.commit()
    return u, {"Authorization": f"Bearer {create_access_token(str(u.id))}"}


@pytest.mark.asyncio
async def test_api_requires_login(client):
    assert (await client.get("/api/v1/home/workbench")).status_code == 401


@pytest.mark.asyncio
async def test_api_new_user_then_progress_changes_the_board(client, db_session):
    u, h = await _make_user(db_session)
    first = (await client.get("/api/v1/home/workbench?tz=Asia/Shanghai", headers=h)).json()["data"]
    assert first["personalized"] and first["state"] in ("new", "no_project")
    assert CJK.search(first["hero"]["headline"]) and first["cards"]
    pid = str(uuid.uuid4())
    db_session.add(Project(id=pid, user_id=u.id, name="张家口光伏", technology="solar", location="河北张家口", status="draft"))
    await db_session.commit()
    second = (await client.get("/api/v1/home/workbench?tz=Asia/Shanghai", headers=h)).json()["data"]
    assert second["state"] == "no_resource" and "张家口光伏" in second["hero"]["headline"]
    db_session.add(ResourceAssessment(id=str(uuid.uuid4()), project_id=pid, technology="solar", latitude=40.8, longitude=114.9))
    await db_session.commit()
    third = (await client.get("/api/v1/home/workbench?tz=Asia/Shanghai", headers=h)).json()["data"]
    assert third["state"] == "no_finance"
    assert {c["id"] for c in first["cards"]} != {c["id"] for c in third["cards"]}


@pytest.mark.asyncio
async def test_api_international_user_gets_english_and_own_time_zone(client, db_session):
    u, h = await _make_user(db_session, market="global", country="Germany")
    r = await client.put("/api/v1/home/workbench/preferences", headers=h, json={
        "role": "analyst", "tech_focus": ["wind", "bogus"], "goal": "market", "region": "Bavaria", "timezone": "Pacific/Auckland"})
    assert r.status_code == 200 and r.json()["data"]["tech_focus"] == ["wind"]
    d = (await client.get("/api/v1/home/workbench", headers=h)).json()["data"]
    blob = " ".join([d["hero"]["headline"], d["hero"]["greeting"], d["note"], d["disclaimer"]] + [c["title"] + c["body"] + c["reason"] for c in d["cards"]])
    assert d["lang"] == "en" and not CJK.search(blob), blob
    assert "not investment advice" in d["disclaimer"]
    # Auckland local date differs from UTC for part of the day; the board carries the user's local date
    local = datetime.now(__import__("zoneinfo").ZoneInfo("Pacific/Auckland")).date().isoformat()
    assert d["date"] == local


@pytest.mark.asyncio
async def test_api_off_switch_and_history_reset(client, db_session):
    u, h = await _make_user(db_session)
    await client.get("/api/v1/home/workbench", headers=h)
    off = await client.put("/api/v1/home/workbench/preferences", headers=h, json={"enabled": False})
    assert off.json()["data"]["enabled"] is False
    d = (await client.get("/api/v1/home/workbench", headers=h)).json()["data"]
    assert d["personalized"] is False and d["cards"] == []
    on = await client.put("/api/v1/home/workbench/preferences", headers=h, json={"enabled": True, "reset_history": True})
    assert on.json()["data"]["enabled"] is True
    await db_session.refresh(u)
    assert u.usage_quota["home_personalization"]["seen"] == {}


@pytest.mark.asyncio
async def test_api_same_day_refresh_is_stable_and_users_are_isolated(client, db_session):
    u1, h1 = await _make_user(db_session)
    u2, h2 = await _make_user(db_session)
    db_session.add(Project(id=str(uuid.uuid4()), user_id=u1.id, name="Only-Mine", technology="wind", status="draft"))
    await db_session.commit()
    a = (await client.get("/api/v1/home/workbench", headers=h1)).json()["data"]
    b = (await client.get("/api/v1/home/workbench", headers=h1)).json()["data"]
    c = (await client.get("/api/v1/home/workbench", headers=h2)).json()["data"]
    assert [x["id"] for x in a["cards"]] == [x["id"] for x in b["cards"]]
    assert "Only-Mine" not in str(c)


@pytest.mark.parametrize("lang", ["zh", "en"])
def test_every_role_tech_goal_combination_always_gets_a_board(lang):
    """No combination of choices may leave the page empty or break compliance over two weeks."""
    import itertools
    combos = itertools.product(pw.ROLES, pw.TECHS, pw.GOALS)
    for role, tech, goal in combos:
        for projects in ([], [P("Site-A", "solar")]):
            profile = pw.Profile(lang=lang, role=role, tech_focus=(tech,), goal=goal, region="X")
            act = pw.Activity(projects=list(projects))
            for i in range(14):
                day = MON + timedelta(days=i)
                d = pw.compose(profile, act, datetime(day.year, day.month, day.day, 8 + (i % 12), 0), f"{role}{tech}{goal}")
                assert len(d["cards"]) >= 3, (role, tech, goal, i)
                for c in d["cards"]:
                    act.seen[c["id"]] = day.isoformat()
                    assert not pw.forbidden_hits(c["title"] + c["body"])
                    if lang == "en":
                        assert not CJK.search(c["title"] + c["body"] + c["reason"])


def test_stored_utc_timestamps_are_read_as_the_users_local_day():
    from datetime import timezone
    from zoneinfo import ZoneInfo

    from app.api.v1.workbench import _d

    stamp = datetime(2026, 11, 1, 23, 0, tzinfo=timezone.utc)  # 07:00 on 2 Nov in Shanghai
    assert _d(stamp, ZoneInfo("Asia/Shanghai")) == date(2026, 11, 2)
    assert _d(stamp.replace(tzinfo=None), ZoneInfo("America/Los_Angeles")) == date(2026, 11, 1)
    assert _d(None, ZoneInfo("UTC")) is None


def test_fixed_utc_offset_is_accepted_for_apps_without_a_time_zone_database():
    from app.api.v1.workbench import _zone

    now = datetime(2026, 11, 2, 20, 0, tzinfo=__import__("datetime").timezone.utc)
    assert now.astimezone(_zone("UTC+05:30")).hour == 1
    assert now.astimezone(_zone("UTC-08:00")).hour == 12
    assert now.astimezone(_zone("Europe/Berlin")).hour == 21
    with pytest.raises(ValueError):
        _zone("UTC+99:00")


def test_the_users_own_next_step_comes_first_and_the_rhythm_tip_last():
    profile, projects, hour = PERSONAS["chen"]
    act = pw.Activity(projects=projects, last_active=MON)
    d = pw.compose(profile, act, datetime(2026, 11, 2, hour, 0), "chen")
    assert d["cards"][-1]["kind"] == "rhythm"
    assert d["cards"][0]["kind"] != "rhythm"
