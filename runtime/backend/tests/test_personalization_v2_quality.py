"""Quality gates for the seven-day, five-persona dashboard experience."""

from app.services.personalization_v2 import PersonalizationEngine


PERSONAS = {
    "chen_xin": "cn",
    "wang_qiang": "cn",
    "li_na": "cn",
    "john_smith": "global",
    "sarah_miller": "global",
}


def test_all_ui_personas_resolve():
    engine = PersonalizationEngine()
    for persona_id in PERSONAS:
        assert engine.get_profile(persona_id) is not None
        assert engine.get_widgets(persona_id)


def test_all_personas_have_seven_day_cards_with_demo_disclosure():
    engine = PersonalizationEngine()
    for persona_id, market in PERSONAS.items():
        headlines = set()
        for day in range(1, 8):
            card = engine.get_hero_card(persona_id, day)
            assert card is not None
            assert card.title
            assert card.headline
            assert card.subtext
            assert card.evidence_status == "demo"
            headlines.add(card.headline)
            if market == "cn":
                assert card.evidence_note == "演示数据，并非真实项目监测结果"
            else:
                assert card.evidence_note == "Demonstration data — not a live project measurement"
        assert len(headlines) >= 3, f"{persona_id} does not visibly evolve during the week"


def test_unknown_user_never_receives_fabricated_personal_metrics():
    engine = PersonalizationEngine()
    assert engine.get_hero_card("unknown-user", 1) is None


# ---------------------------------------------------------------------------
# 演化逻辑扩展用例（2026-07-27 追加，上方已有用例保持不变）
# ---------------------------------------------------------------------------

EXPECTED_STAGE_SEQUENCE = [
    "onboarding",     # D1 引导任务
    "collecting",     # D2 数据积累
    "collecting",     # D3 数据积累
    "insight",        # D4 洞察
    "insight",        # D5 洞察
    "action",         # D6 行动清单
    "weekly_review",  # D7 周报
]


def test_day_stage_progression_follows_five_stage_evolution():
    engine = PersonalizationEngine()
    for persona_id in PERSONAS:
        stages = [
            engine.get_hero_card(persona_id, day).day_stage
            for day in range(1, 8)
        ]
        assert stages == EXPECTED_STAGE_SEQUENCE, (
            f"{persona_id} stage sequence is not the five-stage evolution"
        )


def test_every_hero_card_carries_next_action():
    engine = PersonalizationEngine()
    for persona_id in PERSONAS:
        for day in range(1, 8):
            card = engine.get_hero_card(persona_id, day)
            assert card is not None
            assert card.next_action.get("label"), f"{persona_id} day {day} missing label"
            assert card.next_action.get("href", "").startswith("/"), (
                f"{persona_id} day {day} missing href"
            )


def test_daily_layout_differs_across_personas_and_days():
    engine = PersonalizationEngine()
    for day in (1, 4, 6):
        layouts = {
            persona_id: engine.get_daily_layout(persona_id, day)
            for persona_id in PERSONAS
        }
        assert all(layout is not None for layout in layouts.values())
        # 同一天不同人设：英雄卡文案与组件优先级必须不同
        headlines = {layout["hero"]["headline"] for layout in layouts.values()}
        assert len(headlines) == len(PERSONAS)
        first_widgets = {layout["widgets"][0]["id"] for layout in layouts.values()}
        assert len(first_widgets) == len(PERSONAS)
    # 同一人设不同天：布局内容随演化阶段变化
    for persona_id in PERSONAS:
        per_day = [engine.get_daily_layout(persona_id, day) for day in range(1, 8)]
        assert len({layout["day_stage"] for layout in per_day}) == 5
        assert len({layout["hero"]["headline"] for layout in per_day}) == 7


def test_daily_layout_structure_is_declarative_and_demo_marked():
    engine = PersonalizationEngine()
    for persona_id, market in PERSONAS.items():
        for day in range(1, 8):
            layout = engine.get_daily_layout(persona_id, day)
            assert layout["day"] == day
            assert layout["market"] == market
            assert layout["hero"]["evidence_status"] == "demo"
            assert layout["hero"]["next_action"]["label"]
            assert [w["priority"] for w in layout["widgets"]] == [1, 2, 3]
            assert all(w["evidence_status"] == "demo" for w in layout["widgets"])
            recommendation = layout["recommendation"]
            assert recommendation["evidence_status"] == "demo"
            assert len(recommendation["items"]) >= 2
            assert all(
                item["title"] and item["href"].startswith("/")
                for item in recommendation["items"]
            )
            if market == "cn":
                assert recommendation["title"] == "你可能关心"


def test_widget_priority_reflects_role_focus():
    engine = PersonalizationEngine()
    # 运维经理告警卡优先，投资人收益卡优先
    assert engine.get_daily_layout("wang_qiang", 1)["widgets"][0]["id"] == "alarm_list"
    assert engine.get_daily_layout("chen_xin", 1)["widgets"][0]["id"] == "revenue_trend"


def test_unknown_user_safe_across_all_new_apis():
    engine = PersonalizationEngine()
    assert engine.get_daily_layout("unknown-user", 1) is None
    assert engine.get_daily_layout("chen_xin", 0) is None
    assert engine.get_daily_layout("chen_xin", 8) is None
    assert engine.get_hero_card("chen_xin", 0) is None
    assert engine.get_hero_card("chen_xin", 8) is None
    assert engine.get_day_stage(0) is None
    assert engine.get_day_stage(8) is None
    assert engine.get_onboarding_questions("martian") is None


def test_onboarding_questions_are_bilingual():
    engine = PersonalizationEngine()
    for market in ("cn", "global"):
        questions = engine.get_onboarding_questions(market)
        assert questions is not None
        assert len(questions) == 3
        for question in questions:
            assert question.question["cn"].strip()
            assert question.question["en"].strip()
            assert len(question.options) >= 2
            for option in question.options:
                assert option["value"]
                assert option["label"]["cn"].strip()
                assert option["label"]["en"].strip()
