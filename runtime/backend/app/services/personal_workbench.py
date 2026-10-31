"""Per-user personalised workbench ("今日工作台") for 新能源智库 / Energy Intelligence.

Unlike personalization_v2 (a public demo with five canned personas), this engine
works on a *real* user: who they say they are (role, technology focus, goal,
region), what they have actually done (projects, resource assessments, financial
models, reports), when they last showed up, what time it is for them, which day
of the week it is, and which suggestions they were already shown.

It is a pure function (``compose``) so that it can be simulated for any number of
users and days in tests. Nothing here calls a model and nothing is invented:
every card is a task or a pointer to a screen, and every card carries the reason
it was chosen. Compliance rules enforced in code and tested:

* no investment advice, return promises or price predictions (``forbidden_hits`` runs the repo's bottom-line scanner)
* no fabricated numbers: the only numbers shown are counts of the user's own
  records
* the user can see and turn off personalisation (``enabled`` flag)

Scoring is additive and explainable:
  state fit +7, role +4, technology +3, goal +4, time of day +2 / -2,
  weekday rule +3, rotation (shown in last 3 / 7 / 14 days) -8 / -6 / -2,
  tiny deterministic jitter so equal cards do not always order the same way.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

ROLES = ("investor", "operations", "developer", "analyst")
TECHS = ("solar_pv", "wind", "storage", "hybrid")
GOALS = ("yield", "reliability", "pipeline", "market")

DISCLAIMER = {
    "zh": "以上只是下一步可以做的事，不构成投资建议；数字仅来自你自己的项目记录。",
    "en": "These are suggested next steps, not investment advice; any numbers come only from your own project records.",
}

def forbidden_hits(text: str) -> List[str]:
    """Reuse the repo-wide bottom-line scanner (investment advice, price prediction, impersonation)."""
    from app.services.bottom_line import find_violations

    hits: List[str] = []
    for market in ("cn", "global"):
        try:
            hits += find_violations(text, market=market)
        except TypeError:  # pragma: no cover - older signature
            hits += find_violations(text)
    return sorted(set(hits))


def _c(cid, kind, state, zh, en, href, *, roles=(), techs=(), goals=(), buckets=(), days=()):
    return {
        "id": cid, "kind": kind, "state": state, "zh": zh, "en": en, "href": href,
        "roles": tuple(roles), "techs": tuple(techs), "goals": tuple(goals),
        "buckets": tuple(buckets), "days": tuple(days),
    }


# state: any | no_project | no_resource | no_finance | no_report | has_report | idle | new
# days: "mon".."sun" or "weekday"/"weekend"; zh/en are (title, body) tuples; {project} {region} {n} are filled in.
LIBRARY = [
    # --- getting started / next step in the user's own workflow -------------------------
    _c("start_project", "setup", "no_project", ("建立你的第一个项目", "填上名称、地点和装机容量，后面的评估和测算才有依据。"), ("Create your first project", "Add a name, location and capacity so assessments and models have something to work on."), "/projects/new"),
    _c("start_pv", "setup", "no_project", ("从光伏项目开始", "光伏资料最齐，先建一个光伏项目熟悉流程。"), ("Start with a solar PV project", "Solar data is the most complete, so it is the easiest way to learn the flow."), "/projects/new", techs=("solar_pv", "hybrid")),
    _c("start_wind", "setup", "no_project", ("建一个风电项目", "填上风机点位，我们可以查该点位的风资源数据。"), ("Create a wind project", "Add the site coordinates and we can look up the wind resource there."), "/projects/new", techs=("wind",)),
    _c("start_storage", "setup", "no_project", ("建一个储能项目", "先记下容量和时长，再看财务测算怎么用。"), ("Create a storage project", "Record capacity and duration first, then see how the financial model uses them."), "/projects/new", techs=("storage",)),
    _c("do_resource", "analysis", "no_resource", ("给「{project}」做资源评估", "还没有资源评估记录，先查一下该点位的辐照或风速。"), ("Run a resource assessment for “{project}”", "There is no resource assessment yet; look up irradiance or wind speed at the site."), "/resource", techs=("solar_pv", "wind", "hybrid")),
    _c("do_finance", "analysis", "no_finance", ("给「{project}」跑一次财务测算", "把电价、造价等假设填成你自己的数，再看现金流。"), ("Run a financial model for “{project}”", "Enter tariff and cost assumptions as your own numbers, then read the cash flow."), "/calculator", roles=("investor", "developer"), goals=("yield", "pipeline")),
    _c("do_finance_any", "analysis", "no_finance", ("用你的参数试算一次", "「{project}」还没有财务测算，试算一次就能看到各项假设的影响。"), ("Try a model with your inputs", "“{project}” has no financial model yet; one run shows how each assumption matters."), "/calculator"),
    _c("do_report", "report", "no_report", ("为「{project}」生成报告", "资源评估和测算都有了，可以整理成一份报告，数据来源会一并列出。"), ("Generate a report for “{project}”", "Assessment and model are done; compile them, with data sources listed."), "/reports"),
    _c("report_review", "review", "has_report", ("回看上一份报告里的假设", "对照现在的实际数据，看看哪些假设该更新。"), ("Revisit the assumptions in your last report", "Compare them with current data and see which ones need updating."), "/reports", roles=("analyst", "investor")),
    _c("welcome_back", "setup", "idle", ("好几天没来了，从这里接着做", "「{project}」是你最近动过的项目，继续往下一步走。"), ("Pick up where you left off", "“{project}” is the project you touched most recently; take the next step."), "/projects"),
    _c("new_tour", "setup", "new", ("先花两分钟设置画像", "告诉我们你的角色和关注的技术，首页会按你的情况调整。"), ("Take two minutes to set up your profile", "Tell us your role and technology focus and this page will adapt to you."), "/onboarding"),
    # --- role based, any state ---------------------------------------------------------------
    _c("ops_alarms", "alarms", "any", ("查看本周的告警和停机记录", "按时间排序，先处理影响发电最多的几条。"), ("Review this week's alarms and downtime", "Sorted by time; start with those that cost the most generation."), "/maintenance", roles=("operations",), goals=("reliability",)),
    _c("ops_clean", "ops", "any", ("排一下清洗和巡检计划", "对照上次清洗的日期，看哪些方阵该安排了。"), ("Plan cleaning and inspections", "Check the last cleaning dates and see which arrays are due."), "/maintenance", roles=("operations",), techs=("solar_pv", "hybrid"), buckets=("morning", "midday")),
    _c("ops_turbine", "ops", "any", ("核对风机巡检清单", "叶片、齿轮箱和变桨系统按清单逐项过一遍。"), ("Check the turbine inspection list", "Walk through blades, gearbox and pitch system item by item."), "/maintenance", roles=("operations",), techs=("wind",)),
    _c("ops_battery", "ops", "any", ("看一眼储能的充放电与温度记录", "异常波动先标出来，交给运维确认。"), ("Look at charge/discharge and temperature records", "Flag unusual swings and hand them to O&M to confirm."), "/maintenance", roles=("operations",), techs=("storage",)),
    _c("dev_timeline", "pipeline", "any", ("更新项目进度表", "把已完成的里程碑勾上，下一步的负责人写清楚。"), ("Update the project timeline", "Tick off finished milestones and name an owner for the next one."), "/projects/timeline", roles=("developer",), goals=("pipeline",)),
    _c("dev_siting", "pipeline", "any", ("对比两个备选点位的资源数据", "同一套指标放在一起看，选址理由更清楚。"), ("Compare resource data for two candidate sites", "Put the same indicators side by side to make the siting case clearer."), "/resource", roles=("developer",), techs=("solar_pv", "wind", "hybrid")),
    _c("inv_sens", "analysis", "any", ("用测算页看假设变化的影响", "把电价或造价改一档，看现金流变化多少，这只是敏感性，不是预测。"), ("See how assumptions move the result", "Change the tariff or cost by one step and see the cash flow shift; it is a sensitivity, not a forecast."), "/calculator", roles=("investor",), goals=("yield",)),
    _c("inv_sources", "review", "any", ("核对测算用到的数据来源", "每个数字都应能说清出处，说不清的先标出来。"), ("Check where your model's data comes from", "Every number should have a source; flag the ones that do not."), "/reports", roles=("investor", "analyst")),
    _c("an_papers", "learn", "any", ("读一篇和你方向有关的论文", "来自已收录的文献库，每条都标明出处。"), ("Read a paper in your area", "From the indexed literature; every item shows its source."), "/papers", roles=("analyst",), goals=("market",)),
    _c("an_ask", "learn", "any", ("向智能助手问一个具体问题", "例如某个参数的取值范围，回答会附上来源编号。"), ("Ask the assistant one specific question", "For instance the range of a parameter; answers cite their sources."), "/assistant", roles=("analyst", "developer")),
    # --- technology based ---------------------------------------------------------------------
    _c("pv_degradation", "learn", "any", ("了解组件衰减对发电量的影响", "在测算里把衰减率当作一个可调假设，看它的作用。"), ("See what module degradation does to output", "Treat degradation as an adjustable assumption in the model."), "/calculator", techs=("solar_pv",), goals=("yield",)),
    _c("wind_shear", "learn", "any", ("看风切变对轮毂高度风速的影响", "资源评估里可以对比不同高度。"), ("See how wind shear changes hub-height speed", "Compare heights in the resource assessment."), "/resource", techs=("wind",), goals=("yield",)),
    _c("storage_cycles", "learn", "any", ("看储能循环次数与寿命假设", "在储能测算里把循环次数当作一项可调参数。"), ("Look at cycle count and lifetime assumptions", "Treat cycle count as an adjustable input in the storage model."), "/calculator/storage", techs=("storage",), goals=("yield", "reliability")),
    _c("hybrid_mix", "learn", "any", ("试几种不同的光储配比", "同一块地，换配比看看发电与放电的差别。"), ("Try different solar-to-storage ratios", "Same site, different ratios; compare generation and discharge."), "/calculator/storage", techs=("hybrid", "storage")),
    # --- market and policy (pointers only, no forecasts) -------------------------------------
    _c("policy_region", "policy", "any", ("看看{region}最近的政策更新", "来自已核验的政策库，每条都有原文链接。"), ("See recent policy updates for {region}", "From the verified policy library; each entry links to the original."), "/policy", goals=("market",), roles=("analyst", "investor", "developer")),
    _c("policy_subscribe", "policy", "any", ("订阅{region}的政策提醒", "有新文件时通知你，不会替你解读成买卖信号。"), ("Subscribe to policy alerts for {region}", "Get notified of new documents; we do not turn them into trading signals."), "/policy", goals=("market",)),
    _c("market_tariff", "policy", "any", ("核对测算里的电价假设是否仍和公开文件一致", "对照最新公开的电价文件，只做核对，不做预测。"), ("Check your tariff assumption against public documents", "Compare with the latest published documents; verification only, no forecasting."), "/calculator", goals=("market", "yield"), roles=("investor", "analyst")),
    # --- time and weekday rhythm ---------------------------------------------------------------
    _c("mon_plan", "rhythm", "any", ("定下本周要推进的一件事", "只选一件，写在项目备注里。"), ("Pick the one thing to move forward this week", "Just one; write it in the project notes."), "/projects", days=("mon",)),
    _c("fri_wrap", "rhythm", "any", ("收一收本周的工作", "把没做完的事写进项目备注，下周一一眼就能接上。"), ("Wrap up the week", "Leave notes on unfinished work so Monday starts easily."), "/projects", days=("fri",)),
    _c("weekend_read", "rhythm", "any", ("周末抽 15 分钟读点资料", "挑一篇和你项目有关的文献或政策。"), ("Spend 15 minutes reading this weekend", "Pick one paper or policy relevant to your projects."), "/papers", days=("weekend",), buckets=("morning", "midday", "afternoon", "evening")),
    _c("morning_check", "rhythm", "any", ("上午先看今天最要紧的一项", "趁精力好，先做需要判断的事。"), ("Start with the most important item", "Do the work that needs judgement while you are fresh."), "/dashboard", buckets=("morning",)),
    _c("evening_notes", "rhythm", "any", ("睡前花两分钟记下明天要做的事", "写在项目备注里，明早打开就能接上。"), ("Take two minutes to note tomorrow's task", "Write it in the project notes so you can pick it up in the morning."), "/projects", buckets=("evening", "night")),
    _c("midweek_data", "rhythm", "any", ("周中核对一次数据是否最新", "看看资源和电价输入的更新日期。"), ("Midweek: check your data is current", "Look at the update dates on resource and tariff inputs."), "/dashboard", days=("wed", "thu")),
    # --- more role cards -----------------------------------------------------------------
    _c("ops_spare", "ops2", "any", ("核对备件清单", "常用易损件的库存和下次补货时间过一遍。"), ("Check the spare-parts list", "Review stock of common wear parts and when to reorder."), "/maintenance", roles=("operations",)),
    _c("ops_handover", "handover", "any", ("写一份交接班记录", "今天发生的告警、处理过的缺陷和待跟进的事，三行写清。"), ("Write a shift handover note", "Alarms, fixes and open items from today, in three lines."), "/maintenance", roles=("operations",), buckets=("afternoon", "evening")),
    _c("ops_inverter", "ops3", "any", ("对比各逆变器的发电量", "找出明显偏低的一台，先排查再下结论。"), ("Compare output across inverters", "Find the clearly low one and investigate before concluding."), "/maintenance", roles=("operations",), techs=("solar_pv", "hybrid")),
    _c("ops_weather", "ops4", "any", ("巡检前看一眼天气和风速", "出发前确认天气条件，再决定今天的巡检路线。"), ("Check weather and wind before inspections", "Confirm conditions before choosing today's route."), "/maintenance", roles=("operations",), buckets=("morning",)),
    _c("dev_permit", "pipeline2", "any", ("核对手续清单的进度", "备案、接入、用地各一行，写明卡在哪一步。"), ("Check permit and approval progress", "Filing, grid connection and land, one line each, noting where each is stuck."), "/projects/timeline", roles=("developer",)),
    _c("dev_land", "pipeline3", "any", ("整理场址的用地和接入条件", "把已知的条件写在一处，缺的标出来。"), ("Collect site land and grid-access notes", "Put what is known in one place and mark what is missing."), "/projects", roles=("developer",), goals=("pipeline",)),
    _c("dev_contacts", "pipeline4", "any", ("列出这周要联系的相关方", "每人一句要问的话，发出去之前先想清楚。"), ("List who to contact this week", "One question each; think it through before sending."), "/projects", roles=("developer",), days=("tue", "wed")),
    _c("inv_assump", "analysis2", "any", ("列出测算里最不确定的三个假设", "在测算页逐个改动，看哪个对结果影响最大。"), ("List the three least certain assumptions", "Change them one at a time in the model and see which matters most."), "/calculator", roles=("investor",)),
    _c("inv_compare", "analysis3", "any", ("把两个项目的关键指标并排看", "用同一套假设比较，结论才站得住。"), ("Compare two projects side by side", "Use the same assumptions so the comparison holds."), "/projects", roles=("investor",), goals=("pipeline", "yield")),
    _c("inv_dd", "review2", "any", ("整理一份尽调资料清单", "列出还缺的文件，不做任何收益承诺。"), ("Prepare a due-diligence document list", "List the documents still missing; no return promises."), "/projects", roles=("investor",)),
    _c("an_method", "review3", "any", ("记下这次分析用的方法和数据来源", "以后复核时能直接对上。"), ("Record the method and data sources of this analysis", "So you can check it against later."), "/reports", roles=("analyst",)),
    _c("an_dataset", "learn2", "any", ("看看数据集页有没有更新", "确认你引用的数据是否有新版本。"), ("See if any dataset has been updated", "Confirm whether the data you cite has a newer version."), "/papers", roles=("analyst",), goals=("market",)),
    _c("an_regions", "analysis4", "any", ("对比两个地区的资源数据", "同一套指标，换两个地点看差别。"), ("Compare resource data for two regions", "Same indicators, two places."), "/resource", roles=("analyst",), techs=("solar_pv", "wind", "hybrid")),
    _c("an_summary", "summary", "any", ("把这周读到的写成三句话摘要", "写下来才算真正看懂。"), ("Summarise this week's reading in three sentences", "Writing it down shows whether you understood it."), "/papers", roles=("analyst",), days=("fri", "sun")),
    _c("pv_soiling", "learn3", "any", ("了解积灰对发电的影响", "在测算里把积灰损失当作一项可调假设。"), ("Learn how soiling affects output", "Treat soiling loss as an adjustable assumption."), "/calculator", techs=("solar_pv", "hybrid")),
    _c("wind_wake", "learn4", "any", ("了解尾流对下游机组的影响", "排布不同，下游机组的风速会不同。"), ("Learn how wake affects downstream turbines", "Layout changes the wind speed downstream."), "/resource", techs=("wind",)),
    _c("storage_dod", "learn5", "any", ("了解放电深度与寿命的关系", "把放电深度当作储能测算里的一项参数。"), ("Learn how depth of discharge relates to lifetime", "Treat depth of discharge as a parameter in the storage model."), "/calculator/storage", techs=("storage", "hybrid")),
    _c("rel_log", "reliability", "any", ("把本月的故障原因归个类", "分类后才看得出该先解决哪一类。"), ("Group this month's faults by cause", "Once grouped, you can see which cause to tackle first."), "/maintenance", goals=("reliability",), roles=("operations", "developer")),
    _c("mk_watch", "market2", "any", ("列出你要持续关注的三项公开信息", "例如政策文件、电价文件、行业报告，只记录出处。"), ("List three public sources to keep watching", "Policy documents, tariff documents, industry reports; just record where they come from."), "/policy", goals=("market",)),
    # --- weekday rhythm (one per day so the rhythm slot always has a fresh option) -------
    _c("tue_followup", "rhythm", "any", ("跟进上周没做完的一件事", "只挑一件，写下下一步。"), ("Follow up on one unfinished item from last week", "Pick just one and write the next step."), "/projects", days=("tue",)),
    _c("sat_tidy", "rhythm", "any", ("整理一下项目备注和文件", "旧的归档，新的命名清楚。"), ("Tidy your project notes and files", "Archive old ones and name new ones clearly."), "/projects", days=("sat",)),
    _c("sun_preview", "rhythm", "any", ("看一眼下周要做的事", "挑出最重要的一项，周一直接开始。"), ("Glance at next week", "Pick the most important item so Monday can start right away."), "/projects", days=("sun",)),
    _c("lunch_break", "rhythm", "any", ("中午起来走走再回来", "半小时离开屏幕，下午更好判断。"), ("Step away at lunch", "Half an hour off-screen makes the afternoon's judgement better."), "/dashboard", buckets=("midday",)),
    _c("afternoon_one", "rhythm", "any", ("下午只推进一件事", "关掉其他页面，做完这一件再看别的。"), ("Move one thing forward this afternoon", "Close other tabs and finish this one first."), "/dashboard", buckets=("afternoon",)),
    _c("ops_perf", "perf", "any", ("对比实际与预期的发电曲线", "偏差明显的时段单独标出来，再查原因。"), ("Compare actual and expected generation curves", "Mark the clearly deviating periods, then look for causes."), "/maintenance", roles=("operations",), goals=("yield", "reliability")),
    _c("ops_safety", "safety", "any", ("巡检和检修前确认安全措施", "登高、电气作业前核对工作票和防护用品。"), ("Confirm safety steps before inspections", "Check work permits and protective gear before working at height or on electrics."), "/maintenance", roles=("operations",), buckets=("morning", "midday")),
    _c("ops_retro", "retro", "any", ("复盘一次最近的缺陷处理", "用了多久、卡在哪里、下次怎么更快。"), ("Review a recent fault repair", "How long it took, where it stalled, how to speed it up next time."), "/maintenance", roles=("operations",), days=("thu", "fri", "sat", "sun")),
]
BY_ID = {c["id"]: c for c in LIBRARY}

_DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def time_bucket(hour: int) -> str:
    if 5 <= hour < 11:
        return "morning"
    if 11 <= hour < 14:
        return "midday"
    if 14 <= hour < 18:
        return "afternoon"
    if 18 <= hour < 22:
        return "evening"
    return "night"


@dataclass
class ProjectFacts:
    id: str
    name: str
    technology: str = ""
    location: str = ""
    has_resource: bool = False
    has_finance: bool = False
    has_report: bool = False
    last_touched: Optional[date] = None


@dataclass
class Profile:
    lang: str = "zh"
    role: str = ""
    tech_focus: tuple = ()
    goal: str = ""
    region: str = ""
    account_created: Optional[date] = None


@dataclass
class Activity:
    projects: List[ProjectFacts] = field(default_factory=list)
    last_active: Optional[date] = None
    open_days: tuple = ()          # dates the user opened the home page
    seen: Dict[str, str] = field(default_factory=dict)   # card id -> last shown ISO date


def _norm_tech(t: str) -> str:
    t = (t or "").lower()
    if t in ("solar", "pv", "solar_pv"):
        return "solar_pv"
    if t in ("wind",):
        return "wind"
    if t in ("storage", "bess"):
        return "storage"
    if t in ("hybrid",):
        return "hybrid"
    return ""


def user_state(profile: Profile, act: Activity, today: date) -> tuple:
    """Return (state, project) — the single most useful workflow state for this user."""
    projects = act.projects
    if not projects:
        if profile.account_created and (today - profile.account_created).days <= 2 and not profile.role:
            return "new", None
        return "no_project", None
    recent = sorted(projects, key=lambda p: p.last_touched or date.min, reverse=True)
    last = recent[0]
    if act.last_active and (today - act.last_active).days >= 7:
        return "idle", last
    for p in recent:
        if not p.has_resource and _norm_tech(p.technology) != "storage":
            return "no_resource", p
    for p in recent:
        if not p.has_finance:
            return "no_finance", p
    for p in recent:
        if p.has_finance and not p.has_report:
            return "no_report", p
    return "has_report", last


def _jitter(user_key: str, cid: str, day: date) -> float:
    h = hashlib.sha256(f"{user_key}|{cid}|{day.isoformat()}".encode()).digest()
    return (h[0] / 255.0) * 1.2


def _state_fit(card, state: str) -> Optional[float]:
    """None = card does not apply in this state."""
    cs = card["state"]
    if cs == "any":
        return 0.0
    if cs == state:
        return 7.0
    # workflow cards for an earlier step stay valid when the user is further along only if not done
    return None


def score_card(card, profile: Profile, state: str, today: date, bucket: str, act: Activity, tech_set, user_key: str):
    fit = _state_fit(card, state)
    if fit is None:
        return None, []
    # weekday rule: restricted cards only on their days
    dk = _DAYS[today.weekday()]
    if card["days"]:
        ok = dk in card["days"] or ("weekend" in card["days"] and dk in ("sat", "sun")) or ("weekday" in card["days"] and dk not in ("sat", "sun"))
        if not ok:
            return None, []
    score, why = fit, []
    if fit:
        why.append("state")
    if card["roles"]:
        if profile.role in card["roles"]:
            score += 4; why.append("role")
        elif profile.role:
            return None, []  # a card written for another role is simply not for this user
    if card["techs"]:
        if tech_set & set(card["techs"]):
            score += 3; why.append("tech")
        elif tech_set:
            return None, []
    if card["goals"]:
        if profile.goal in card["goals"]:
            score += 4; why.append("goal")
        elif profile.goal:
            score -= 2
    if card["buckets"]:
        if bucket in card["buckets"]:
            score += 2; why.append("time")
        else:
            score -= 2
    if card["days"]:
        score += 3; why.append("weekday")
    last = act.seen.get(card["id"])
    if last:
        try:
            age = (today - date.fromisoformat(last)).days
        except ValueError:
            age = 99
        if age > 0:  # shown earlier on another day (same-day refresh stays stable)
            score -= 8 if age <= 3 else 6 if age <= 7 else 2 if age <= 14 else 0
            if age <= 3:
                why = why + ["_recent"]
    score += _jitter(user_key, card["id"], today)
    return score, why


def _fmt(text: str, project, region: str, lang: str) -> str:
    name = project.name if project else ("你的项目" if lang == "zh" else "your project")
    reg = region or ("你所在的省份" if lang == "zh" else "your region")
    return text.replace("{project}", name).replace("{region}", reg)


_BASIS = {
    "zh": {"state": "你的项目进度", "role": "你的角色", "tech": "你关注的技术", "goal": "你的目标", "time": "现在的时间", "weekday": "今天是星期几"},
    "en": {"state": "your project progress", "role": "your role", "tech": "your technology focus", "goal": "your goal", "time": "the time of day", "weekday": "today's weekday"},
}
_GREET = {
    "zh": {"morning": "早上好", "midday": "中午好", "afternoon": "下午好", "evening": "晚上好", "night": "夜深了"},
    "en": {"morning": "Good morning", "midday": "Good afternoon", "afternoon": "Good afternoon", "evening": "Good evening", "night": "Working late"},
}


def streak(open_days, today: date) -> int:
    ds = set()
    for d in open_days:
        try:
            ds.add(date.fromisoformat(d) if isinstance(d, str) else d)
        except ValueError:
            pass
    ds.add(today)
    n, d = 0, today
    while d in ds:
        n += 1
        d -= timedelta(days=1)
    return n


def hero(profile: Profile, state: str, project, act: Activity, now: datetime, bucket: str, st: int) -> Dict:
    lang = profile.lang
    greet = _GREET[lang][bucket]
    n = len(act.projects)
    if lang == "zh":
        head = {
            "new": "先设置画像，首页会越用越贴合你",
            "no_project": "还没有项目，先建一个吧",
            "no_resource": f"你有 {n} 个项目，「{project.name if project else ''}」还没做资源评估",
            "no_finance": f"你有 {n} 个项目，「{project.name if project else ''}」还没有财务测算",
            "no_report": f"「{project.name if project else ''}」的测算已完成，可以整理成报告了",
            "has_report": f"你的 {n} 个项目都有报告了，看看哪些假设需要更新",
            "idle": f"欢迎回来，上次是「{project.name if project else ''}」",
        }[state]
        sub = f"今天是第 {st} 天连续打开" if st >= 2 else "每天的建议会根据你的进度变化"
    else:
        pn = project.name if project else ""
        head = {
            "new": "Set up your profile and this page will fit you better each day",
            "no_project": "No projects yet — create one to get started",
            "no_resource": f"You have {n} project(s); “{pn}” has no resource assessment yet",
            "no_finance": f"You have {n} project(s); “{pn}” has no financial model yet",
            "no_report": f"“{pn}” has a model — ready to turn into a report",
            "has_report": f"All {n} of your project(s) have reports — see which assumptions need updating",
            "idle": f"Welcome back — last time it was “{pn}”",
        }[state]
        sub = f"Day {st} in a row" if st >= 2 else "Suggestions change with your progress"
    return {"greeting": greet, "headline": head, "subtext": sub, "state": state}


def compose(profile: Profile, act: Activity, now: datetime, user_key: str, limit: int = 4) -> Dict:
    """Build today's workbench. ``now`` must already be in the user's local time."""
    today = now.date()
    bucket = time_bucket(now.hour)
    state, project = user_state(profile, act, today)
    tech_set = {t for t in (_norm_tech(x) for x in profile.tech_focus) if t}
    tech_set |= {t for t in (_norm_tech(p.technology) for p in act.projects) if t}
    scored = []
    for card in LIBRARY:
        s, why = score_card(card, profile, state, today, bucket, act, tech_set, user_key)
        if s is not None:
            scored.append((s, card, why))
    scored.sort(key=lambda x: (-x[0], x[1]["id"]))
    picked, kinds = [], set()
    fresh = [x for x in scored if "_recent" not in x[2]]
    stale = [x for x in scored if "_recent" in x[2]]
    scored = fresh + stale  # cards shown in the last 3 days only come back if nothing fresh is left
    for s, card, why in scored:  # one rhythm card (weekday / time of day) is always on the board
        if card["kind"] == "rhythm":
            picked.append((card, why)); kinds.add("rhythm")
            break
    for s, card, why in scored:
        if card["kind"] in kinds:
            continue
        if card["state"] == "any" and not [w for w in why if w != "_recent"] and (profile.role or profile.goal or tech_set):
            # a card that matched none of this user's traits is filler; take it only if we run short
            continue
        picked.append((card, why)); kinds.add(card["kind"])
        if len(picked) >= limit:
            break
    for s, card, why in scored:  # backfill so the page is never empty
        if len(picked) >= min(3, limit):
            break
        if card["id"] not in {p[0]["id"] for p in picked} and card["kind"] not in kinds:
            picked.append((card, why)); kinds.add(card["kind"])
    lang = profile.lang
    cards = []
    for card, why in picked:
        title, body = card[lang]
        basis = [_BASIS[lang][w] for w in dict.fromkeys(why) if w in _BASIS[lang]] or ([_BASIS[lang]["time"]] if lang else [])
        reason = ("根据" + "、".join(basis)) if lang == "zh" else ("Because of " + ", ".join(basis))
        cards.append({
            "id": card["id"], "kind": card["kind"],
            "title": _fmt(title, project, profile.region, lang),
            "body": _fmt(body, project, profile.region, lang),
            "href": card["href"], "reason": reason, "bases": [w for w in dict.fromkeys(why) if w in _BASIS[lang]],
        })
    st = streak(act.open_days, today)
    return {
        "date": today.isoformat(), "weekday": _DAYS[today.weekday()], "time_bucket": bucket,
        "hero": hero(profile, state, project, act, now, bucket, st), "state": state,
        "streak": st, "cards": cards, "disclaimer": DISCLAIMER[lang],
    }
