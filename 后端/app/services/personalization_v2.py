"""
Personalization engine v2 — 七日五人设仪表盘体验。

恢复说明：原文件只剩一行残片。这里按测试契约重建：五个内置人设
（国内 3 个、国际 2 个），每人七天 hero 卡片；所有卡片必须明示
"演示数据"（evidence_status == "demo"），未知用户一律返回 None，
绝不编造个性化指标。

演化逻辑（2026-07-27 扩展）：卡片不再是静态文案轮换，而是按
day_stage 五阶段递进——D1 onboarding（引导任务）→ D2-3 collecting
（数据积累）→ D4-5 insight（洞察）→ D6 action（行动清单）→
D7 weekly_review（周报）。每张 hero 卡携带 next_action
（{label, href}），get_daily_layout 返回当天完整仪表盘编排
（hero + 有序 widgets + 「你可能关心」推荐卡），声明式、可被前端
直接渲染；get_onboarding_questions 提供冷启动快速画像问题
（中英双语）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

_DEMO_NOTE_CN = "演示数据，并非真实项目监测结果"
_DEMO_NOTE_GLOBAL = "Demonstration data — not a live project measurement"


@dataclass
class PersonaProfile:
    persona_id: str
    display_name: str
    market: str
    role: str
    tech_focus: List[str]
    subscription_plan: str


@dataclass
class HeroCard:
    title: str
    headline: str
    subtext: str
    evidence_status: str
    evidence_note: str
    day_stage: str = ""
    next_action: Dict[str, str] = field(default_factory=dict)


@dataclass
class OnboardingQuestion:
    question_id: str
    question: Dict[str, str]          # {"cn": ..., "en": ...}
    options: List[Dict[str, object]]  # [{"value": ..., "label": {"cn","en"}}]


# ---------------------------------------------------------------------------
# 演化阶段定义：D1 引导 → D2-3 数据积累 → D4-5 洞察 → D6 行动 → D7 周报
# ---------------------------------------------------------------------------

_STAGE_SEQUENCE = [
    "onboarding",     # day 1
    "collecting",     # day 2
    "collecting",     # day 3
    "insight",        # day 4
    "insight",        # day 5
    "action",         # day 6
    "weekly_review",  # day 7
]

_STAGE_LABELS = {
    "onboarding": {"cn": "上手引导", "en": "Onboarding"},
    "collecting": {"cn": "数据积累", "en": "Collecting data"},
    "insight": {"cn": "洞察生成", "en": "Insight"},
    "action": {"cn": "行动清单", "en": "Action"},
    "weekly_review": {"cn": "每周回顾", "en": "Weekly review"},
}

_STAGE_NEXT_ACTION = {
    "onboarding": {
        "cn": {"label": "完成画像设置", "href": "/onboarding"},
        "global": {"label": "Finish profile setup", "href": "/onboarding"},
    },
    "collecting": {
        "cn": {"label": "查看数据接入进度", "href": "/projects/connect"},
        "global": {"label": "Check data connection progress", "href": "/projects/connect"},
    },
    "insight": {
        "cn": {"label": "查看完整洞察", "href": "/insights"},
        "global": {"label": "View full insights", "href": "/insights"},
    },
    "action": {
        "cn": {"label": "执行本周行动清单", "href": "/actions"},
        "global": {"label": "Run this week's action list", "href": "/actions"},
    },
    "weekly_review": {
        "cn": {"label": "查看周报详情", "href": "/reports/weekly"},
        "global": {"label": "Open weekly report", "href": "/reports/weekly"},
    },
}


_PROFILES: Dict[str, PersonaProfile] = {
    "chen_xin": PersonaProfile(
        "chen_xin", "陈欣", "cn", "分布式光伏投资人",
        ["solar_pv", "distributed"], "pro",
    ),
    "wang_qiang": PersonaProfile(
        "wang_qiang", "王强", "cn", "电站运维经理",
        ["solar_pv", "operations"], "enterprise",
    ),
    "li_na": PersonaProfile(
        "li_na", "李娜", "cn", "储能项目开发",
        ["storage", "hybrid"], "pro",
    ),
    "john_smith": PersonaProfile(
        "john_smith", "John Smith", "global", "Solar project developer",
        ["solar_pv", "utility"], "pro",
    ),
    "sarah_miller": PersonaProfile(
        "sarah_miller", "Sarah Miller", "global", "Energy analyst",
        ["wind", "storage"], "enterprise",
    ),
}

# 组件顺序即优先级：运维经理告警卡优先、投资人收益卡优先，布局按人设差异化。
_WIDGETS: Dict[str, List[str]] = {
    "chen_xin": ["revenue_trend", "yield_overview", "policy_feed"],
    "wang_qiang": ["alarm_list", "pr_monitor", "maintenance_schedule"],
    "li_na": ["storage_dispatch", "arbitrage_window", "policy_feed"],
    "john_smith": ["pipeline_funnel", "interconnection_tracker", "itc_watch"],
    "sarah_miller": ["market_dashboard", "forecast_accuracy", "report_center"],
}

_WIDGET_META: Dict[str, Dict[str, str]] = {
    "revenue_trend": {
        "title_cn": "收益趋势", "title_en": "Revenue trend",
        "desc_cn": "日电费收入与电价波动对照", "desc_en": "Daily revenue vs. price movement",
    },
    "yield_overview": {
        "title_cn": "发电总览", "title_en": "Generation overview",
        "desc_cn": "在运电站发电量与达成率", "desc_en": "Fleet generation and target attainment",
    },
    "policy_feed": {
        "title_cn": "政策动态", "title_en": "Policy feed",
        "desc_cn": "补贴、并网与电价政策更新", "desc_en": "Subsidy, interconnection and tariff updates",
    },
    "alarm_list": {
        "title_cn": "实时告警", "title_en": "Active alarms",
        "desc_cn": "按停机损失排序的未闭环告警", "desc_en": "Open alarms ranked by downtime loss",
    },
    "pr_monitor": {
        "title_cn": "PR 监测", "title_en": "PR monitor",
        "desc_cn": "性能比基线与方阵对比", "desc_en": "Performance ratio vs. baseline by array",
    },
    "maintenance_schedule": {
        "title_cn": "运维排程", "title_en": "Maintenance schedule",
        "desc_cn": "本周巡检与消缺计划", "desc_en": "This week's inspection and repair plan",
    },
    "storage_dispatch": {
        "title_cn": "储能调度", "title_en": "Storage dispatch",
        "desc_cn": "充放电策略与 SOC 跟踪", "desc_en": "Charge/discharge strategy and SOC tracking",
    },
    "arbitrage_window": {
        "title_cn": "套利窗口", "title_en": "Arbitrage window",
        "desc_cn": "峰谷价差与两充两放窗口", "desc_en": "Peak-valley spread and dispatch windows",
    },
    "pipeline_funnel": {
        "title_cn": "项目漏斗", "title_en": "Pipeline funnel",
        "desc_cn": "开发阶段转化率与卡点", "desc_en": "Stage conversion and blockers",
    },
    "interconnection_tracker": {
        "title_cn": "并网进度", "title_en": "Interconnection tracker",
        "desc_cn": "排队时长与里程碑跟踪", "desc_en": "Queue duration and milestone tracking",
    },
    "itc_watch": {
        "title_cn": "ITC 政策追踪", "title_en": "ITC watch",
        "desc_cn": "税收抵免资格与截止日", "desc_en": "Credit eligibility and deadlines",
    },
    "market_dashboard": {
        "title_cn": "市场行情", "title_en": "Market dashboard",
        "desc_cn": "多市场电价与限电概览", "desc_en": "Prices and curtailment across markets",
    },
    "forecast_accuracy": {
        "title_cn": "预测精度", "title_en": "Forecast accuracy",
        "desc_cn": "日前预测 MAPE 走势", "desc_en": "Day-ahead forecast MAPE trend",
    },
    "report_center": {
        "title_cn": "报告中心", "title_en": "Report center",
        "desc_cn": "已生成研报与订阅推送", "desc_en": "Generated reports and subscriptions",
    },
}

# 每人设 7 天逐日文案，与 day_stage 阶段一一对应（演化而非轮换）。
_HERO_COPY: Dict[str, List[Dict[str, str]]] = {
    "chen_xin": [
        {"headline": "完成三步设置，生成你的投资组合基线",
         "subtext": "选择关注的电站类型与区域，系统将为你建立收益基准线"},
        {"headline": "已接入 2 个示例电站，正在积累发电数据",
         "subtext": "示例数据持续采集中，明日起可生成首个趋势判断"},
        {"headline": "辐照与出力数据积累过半",
         "subtext": "数据完整度 58%，覆盖晴天与多云两种典型工况"},
        {"headline": "首个洞察：午间出力峰谷差高于区域均值",
         "subtext": "示例分析显示 12:00–14:00 波动偏大，建议关注逆变器限功率时段"},
        {"headline": "收益敏感度：电价每变动 0.01 元/kWh 的影响",
         "subtext": "按示例电站测算，年收益弹性约 ±1.2 万元"},
        {"headline": "本周行动清单：核查限电时段与电价申报",
         "subtext": "3 项建议按预期收益影响排序，点击逐项执行"},
        {"headline": "第一周周报：组合收益率与基准对比",
         "subtext": "示例组合本周跑赢区域基准 2.3 个百分点（演示）"},
    ],
    "wang_qiang": [
        {"headline": "完成班组与电站范围设置，开启告警订阅",
         "subtext": "选择负责电站与告警等级，第一时间接收异常推送"},
        {"headline": "告警通道已开启，正在同步设备台账",
         "subtext": "示例电站 128 台逆变器台账同步中"},
        {"headline": "PR 监测基线建立中",
         "subtext": "性能比基线需要 3 天数据，当前完整度 61%"},
        {"headline": "首个洞察：3 号方阵 PR 连续低于阈值",
         "subtext": "示例数据提示组串失配可能，建议安排现场排查"},
        {"headline": "设备健康度排名更新",
         "subtext": "2 台逆变器温度趋势偏高，进入重点观察名单"},
        {"headline": "本周行动清单：按优先级处理 4 项告警",
         "subtext": "按停机损失排序，先处理组串失配与通讯中断"},
        {"headline": "第一周周报：告警闭环率与 PR 走势",
         "subtext": "示例电站告警闭环率 87%，PR 环比回升 0.8%（演示）"},
    ],
    "li_na": [
        {"headline": "设置目标省份与商业模式，获取政策日历",
         "subtext": "选择现货/辅助服务关注点，定制开发节奏"},
        {"headline": "正在汇总目标省份峰谷价差数据",
         "subtext": "示例价差曲线同步中，覆盖 8 个省级市场"},
        {"headline": "套利窗口测算需要完整分时电价",
         "subtext": "数据完整度 55%，明日可输出首个测算结果"},
        {"headline": "首个洞察：山东现货峰谷价差季节性走阔",
         "subtext": "示例测算显示夏季两充两放窗口稳定（演示）"},
        {"headline": "容量租赁与现货套利的收益结构对比",
         "subtext": "两种模式下 IRR 差异与敏感性已生成示例对比"},
        {"headline": "本周行动清单：锁定 2 个重点省份的并网窗口",
         "subtext": "按政策时效排序，先完成山东项目边界条件确认"},
        {"headline": "第一周周报：目标省份机会评分变化",
         "subtext": "示例评分：山东上调、甘肃持平、广东下调（演示）"},
    ],
    "john_smith": [
        {"headline": "Set up your pipeline to generate a baseline",
         "subtext": "Pick target markets and project stages; we'll build your development baseline"},
        {"headline": "Syncing a sample pipeline of 3 utility-scale projects",
         "subtext": "Sample interconnection and permitting milestones are being collected"},
        {"headline": "Milestone data accumulation in progress",
         "subtext": "Data completeness 57% — first trend readout lands tomorrow"},
        {"headline": "First insight: interconnection queue wait times rising in ERCOT",
         "subtext": "Sample data shows median queue duration up 14% quarter over quarter (demo)"},
        {"headline": "ITC watch: safe-harbor deadlines and your pipeline",
         "subtext": "Sample mapping of projects to credit eligibility windows"},
        {"headline": "This week's action list: de-risk two late-stage projects",
         "subtext": "Ranked by schedule impact — confirm offtake terms first"},
        {"headline": "Week 1 report: pipeline velocity vs. benchmark",
         "subtext": "Sample pipeline advanced 2 milestones this week (demo)"},
    ],
    "sarah_miller": [
        {"headline": "Configure your coverage universe to start",
         "subtext": "Choose markets, technologies and report cadence"},
        {"headline": "Collecting sample market data across 5 ISOs",
         "subtext": "Sample price and curtailment series are syncing"},
        {"headline": "Forecast accuracy tracking needs more history",
         "subtext": "Data completeness 60% — baseline MAPE ready tomorrow"},
        {"headline": "First insight: wind capture rates diverging from day-ahead prices",
         "subtext": "Sample analysis flags a widening capture discount in SPP (demo)"},
        {"headline": "Storage revenue stack: arbitrage vs. ancillary services",
         "subtext": "Sample comparison across ERCOT and CAISO"},
        {"headline": "This week's action list: update 3 quarterly assumptions",
         "subtext": "Ranked by model sensitivity — curtailment first"},
        {"headline": "Week 1 report: forecast accuracy and coverage changes",
         "subtext": "Sample MAPE improved 0.6 pts after the data refresh (demo)"},
    ],
}

# 「你可能关心」推荐卡：每人设一个条目池，按天轮换，均标注演示。
_RECOMMENDATIONS: Dict[str, List[Dict[str, str]]] = {
    "chen_xin": [
        {"title": "分布式光伏整县推进政策解读", "href": "/insights/county-pv"},
        {"title": "工商业分时电价最新调整一览", "href": "/insights/tou-tariff"},
        {"title": "同区域投资人都在看的收益率基准", "href": "/benchmarks/roi"},
        {"title": "绿电交易对分布式收益的影响", "href": "/insights/green-power"},
    ],
    "wang_qiang": [
        {"title": "组串失配排查作业指导书", "href": "/kb/string-mismatch"},
        {"title": "逆变器高温告警处置 SOP", "href": "/kb/inverter-overheat"},
        {"title": "同类电站 PR 基准对比", "href": "/benchmarks/pr"},
        {"title": "无人机巡检航线规划模板", "href": "/kb/drone-inspection"},
    ],
    "li_na": [
        {"title": "山东独立储能容量租赁行情月报", "href": "/reports/shandong-lease"},
        {"title": "两充两放策略测算工具", "href": "/tools/dual-cycle"},
        {"title": "共享储能商业模式案例库", "href": "/insights/shared-storage"},
        {"title": "辅助服务市场规则更新速览", "href": "/insights/ancillary-rules"},
    ],
    "john_smith": [
        {"title": "ERCOT interconnection queue reform brief", "href": "/insights/ercot-queue"},
        {"title": "ITC safe-harbor checklist for 2026", "href": "/kb/itc-safe-harbor"},
        {"title": "PPA price benchmark, utility-scale solar", "href": "/benchmarks/ppa"},
        {"title": "Permitting timelines by state — Q3 update", "href": "/reports/permitting-q3"},
    ],
    "sarah_miller": [
        {"title": "Wind capture-rate methodology note", "href": "/kb/capture-rate"},
        {"title": "ERCOT vs. CAISO storage revenue stack", "href": "/insights/storage-stack"},
        {"title": "Day-ahead forecast MAPE benchmarks", "href": "/benchmarks/mape"},
        {"title": "Curtailment outlook for SPP wind", "href": "/reports/spp-curtailment"},
    ],
}

# 冷启动快速画像问题（中英双语），3 题即可定位人设方向。
_ONBOARDING_QUESTIONS: List[OnboardingQuestion] = [
    OnboardingQuestion(
        question_id="role",
        question={"cn": "你目前在新能源行业的主要角色是？",
                  "en": "What best describes your role in the energy industry?"},
        options=[
            {"value": "investor", "label": {"cn": "投资人 / 资产持有者", "en": "Investor / asset owner"}},
            {"value": "operations", "label": {"cn": "电站运维 / 现场管理", "en": "Plant O&M / site management"}},
            {"value": "developer", "label": {"cn": "项目开发", "en": "Project developer"}},
            {"value": "analyst", "label": {"cn": "研究 / 分析", "en": "Research / analyst"}},
        ],
    ),
    OnboardingQuestion(
        question_id="tech_focus",
        question={"cn": "你最关注的技术方向是？",
                  "en": "Which technology do you focus on most?"},
        options=[
            {"value": "solar_pv", "label": {"cn": "光伏", "en": "Solar PV"}},
            {"value": "wind", "label": {"cn": "风电", "en": "Wind"}},
            {"value": "storage", "label": {"cn": "储能", "en": "Energy storage"}},
            {"value": "hybrid", "label": {"cn": "多能互补 / 混合项目", "en": "Hybrid / multi-energy"}},
        ],
    ),
    OnboardingQuestion(
        question_id="goal",
        question={"cn": "接下来一个月你最想解决的问题是？",
                  "en": "What is your top priority for the coming month?"},
        options=[
            {"value": "yield", "label": {"cn": "提升发电量与收益", "en": "Improve generation and revenue"}},
            {"value": "reliability", "label": {"cn": "降低故障与停机", "en": "Reduce faults and downtime"}},
            {"value": "pipeline", "label": {"cn": "推进项目开发进度", "en": "Advance project pipeline"}},
            {"value": "market", "label": {"cn": "跟踪市场与政策变化", "en": "Track market and policy shifts"}},
        ],
    ),
]


class PersonalizationEngine:
    """人设驱动的仪表盘内容解析（演示数据，明示来源）。"""

    def get_profile(self, persona_id: str) -> Optional[PersonaProfile]:
        return _PROFILES.get(persona_id)

    def get_widgets(self, persona_id: str) -> List[str]:
        return list(_WIDGETS.get(persona_id, []))

    def get_day_stage(self, day: int) -> Optional[str]:
        """第 N 天（1-7）对应的演化阶段。"""
        if not 1 <= day <= 7:
            return None
        return _STAGE_SEQUENCE[day - 1]

    def get_hero_card(self, persona_id: str, day: int) -> Optional[HeroCard]:
        profile = _PROFILES.get(persona_id)
        if profile is None:
            return None  # 未知用户不编造个性化指标
        stage = self.get_day_stage(day)
        if stage is None:
            return None

        copy = _HERO_COPY[persona_id][day - 1]
        locale = "cn" if profile.market == "cn" else "global"
        next_action = dict(_STAGE_NEXT_ACTION[stage][locale])
        if profile.market == "cn":
            title = f"{profile.display_name}的第 {day} 天 · {_STAGE_LABELS[stage]['cn']}"
            note = _DEMO_NOTE_CN
        else:
            title = f"{profile.display_name} — day {day} · {_STAGE_LABELS[stage]['en']}"
            note = _DEMO_NOTE_GLOBAL

        return HeroCard(
            title=title,
            headline=copy["headline"],
            subtext=copy["subtext"],
            evidence_status="demo",
            evidence_note=note,
            day_stage=stage,
            next_action=next_action,
        )

    def get_daily_layout(self, persona_id: str, day: int) -> Optional[Dict[str, object]]:
        """该人设当天的完整仪表盘编排（声明式，前端可直接渲染）。

        结构：hero 卡 + 有序 widgets（按人设优先级）+ 一张「你可能关心」
        推荐卡。所有内容标注演示来源；未知用户或非法天数返回 None。
        """
        profile = _PROFILES.get(persona_id)
        if profile is None:
            return None
        hero = self.get_hero_card(persona_id, day)
        if hero is None:
            return None

        lang = "cn" if profile.market == "cn" else "en"
        widgets = []
        for priority, widget_id in enumerate(self.get_widgets(persona_id), start=1):
            meta = _WIDGET_META[widget_id]
            widgets.append({
                "id": widget_id,
                "priority": priority,
                "title": meta[f"title_{lang}"],
                "summary": meta[f"desc_{lang}"],
                "evidence_status": "demo",
            })

        pool = _RECOMMENDATIONS[persona_id]
        picks = [pool[(day - 1 + i) % len(pool)] for i in range(2)]
        recommendation = {
            "kind": "recommendation",
            "title": "你可能关心" if lang == "cn" else "You may also be interested",
            "items": [{"title": p["title"], "href": p["href"]} for p in picks],
            "evidence_status": "demo",
        }

        return {
            "persona_id": persona_id,
            "display_name": profile.display_name,
            "market": profile.market,
            "day": day,
            "day_stage": hero.day_stage,
            "hero": {
                "title": hero.title,
                "headline": hero.headline,
                "subtext": hero.subtext,
                "evidence_status": hero.evidence_status,
                "evidence_note": hero.evidence_note,
                "day_stage": hero.day_stage,
                "next_action": dict(hero.next_action),
            },
            "widgets": widgets,
            "recommendation": recommendation,
        }

    def get_onboarding_questions(self, market: str) -> Optional[List[OnboardingQuestion]]:
        """冷启动快速画像：3 个双语问题。未知市场返回 None。"""
        if market not in ("cn", "global"):
            return None
        return list(_ONBOARDING_QUESTIONS)
