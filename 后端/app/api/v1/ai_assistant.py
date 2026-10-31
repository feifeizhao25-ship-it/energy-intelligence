from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.dependencies import get_current_user_id
from app.core.database import get_db
from app.core.subscription import assert_ai_quota, consume_ai_quota
from app.services.ai_service import ai_assistant
from app.services.rag_service import RAGService
import json

router = APIRouter(prefix="/ai")

SYSTEM_PROMPT = """You are the Energy Intelligence AI Assistant, an expert in global renewable energy.
You are fluent in solar PV, wind energy, energy storage, and project finance.
You can call tools to perform resource assessments, financial calculations, and operational diagnostics.
Respond in the user's language. Always cite data sources and provide confidence levels for estimates."""


GLOBAL_ENGLISH_PROMPT = SYSTEM_PROMPT + "\nAlways respond in English only, regardless of the user's language. Keep answers practical and under 180 words."


# ── Deterministic English tips engine (LLM-free fallback for review & offline) ──
_TIPS = {
    "bill": "To cut your electricity bill fast: 1) Shift heavy loads (dryer, dishwasher, EV charging) to off-peak hours — on time-of-use plans this saves 20-40% on those loads. 2) Set your thermostat 7-10°F closer to outdoor temperature for 8h/day (about 10% off HVAC). 3) Kill phantom loads with smart power strips (5-10% of typical bills). 4) Heat water to 120°F and wash clothes cold (another 5-10%). 5) Get a free utility energy audit — most US utilities offer one.",
    "solar": "Home solar checklist: Check your annual kWh usage on your bill, then size roughly 100% of usage (typical US home needs 8-12 kW). South-facing roofs with minimal shade yield best. With the 30% federal Residential Clean Energy Credit, typical payback is 6-10 years. Always get 3 quotes and compare $/W (installed cost per watt) — the fair range is $2.50-3.50/W before credits.",
    "wind": "Small wind for homes makes sense only with consistent wind: you need average wind speed above 10 mph (4.5 m/s) at hub height and open land — suburban roofs are usually too turbulent. A 5 kW turbine produces ~8,000-12,000 kWh/yr in a good site. Check zoning setbacks and bird/bat rules before buying, and prioritize a certified (AWEA 9.1) turbine.",
    "battery": "Home battery economics: a 10-13 kWh pack (e.g., powerwall-class) covers evening peaks and short outages. Best value comes from stacking: time-of-use arbitrage (charge cheap, use at peak), demand-charge reduction, and backup. With the 30% federal credit, typical installed cost lands near $8-12k. Size to your evening consumption, not your daily total.",
    "ev": "EV charging savings: charge after 9pm or during your utility's off-peak window (many offer special EV rates like PG&E EV2-A). A 40-mile daily top-up is ~12 kWh — off-peak that's $1.20-1.80 vs $3-5 at public fast chargers. Avoid charging 4-9pm on peak. Level 1 (regular outlet) covers ~40 miles overnight; Level 2 (240V) is only needed for long commutes or two-EV homes.",
    "cooling": "Cooling for less: set AC to 78°F when home, 85°F when out. Use ceiling fans (feels 4°F cooler, costs ~1¢/h — turn off when you leave). Seal leaky ducts (can be 20-30% of cooling loss). Close blinds on sun-side windows 10am-4pm. Clean/replace filters monthly in summer — a clogged filter can raise AC energy use 5-15%.",
    "heating": "Heating for less: set 68°F when home and awake, 60-62°F overnight or away (each degree saves ~3%). Add attic insulation to R-49 if yours is below R-30 — one of the highest-ROI upgrades. Seal drafts around doors/windows (a $20 weatherstrip kit). Service the furnace yearly. If you heat with electric resistance, a heat pump cuts heating energy 30-60%.",
    "lighting": "Lighting: replace remaining incandescents/halogens with LEDs (75-80% less energy, 25x lifespan). Focus on the 5 most-used fixtures — they account for ~50% of lighting energy. Use timers/motion sensors for outdoor and hallway lights. One 60W-equivalent LED costs about $1/year at 3h/day vs $7 for incandescent.",
    "appliance": "Appliance savings: run dishwashers and washers full, on eco mode, and air-dry. Keep the fridge at 35-38°F, freezer at 0°F; vacuum coils twice a year. Replace water heaters older than 12 years — heat pump water heaters cut water heating cost 60%+ and qualify for a 30% federal credit. When buying, look for ENERGY STAR Most Efficient.",
    "rates": "Reading your rate plan: check if you're on a flat rate or time-of-use (TOU). On TOU, peak hours (often 4-9pm) can cost 2-3x off-peak — shifting usage is free money. Ask your utility about EV, medical baseline, or low-income CARE/FERA discounts. Compare plans yearly on your utility's Power to Choose / rate comparison page; staying on the wrong plan can cost $200-500/yr extra.",
    "credit": "US clean-energy tax credits (through 2032, inflation-adjusted): 30% of solar/battery/wind-heat-pump costs (Residential Clean Energy Credit); up to $2,000/yr for heat pumps and heat pump water heaters plus $1,200 for insulation/air sealing (Energy Efficient Home Improvement Credit). Utilities often stack rebates on top — always check dsireusa.org and your utility's rebate page before purchasing.",
    "grid": "Understanding grid signals: high wholesale prices usually hit 5-9pm on hot/cold days (duck curve evening ramp). Some utilities pay for demand response — letting them cycle your AC/water heater during peaks can earn $25-100/season. Smart panels and batteries can auto-respond. Follow your grid's alert days (Flex Alerts in CA, conservation appeals in TX) — shaving peak usage helps everyone's rates.",
    "audit": "Start with an energy audit: it finds your biggest losses for $0-250 (many utilities do them free). Typical findings pay for themselves within months: attic air sealing, duct leaks, thermostat schedules, phantom loads. Get the blower-door test if offered — it quantifies exactly where your heated/cooled air escapes.",
}
_TIP_KEYS = [
    ("bill", ("bill", "expensive", "save money", "reduce my", "lower my", "cheap", "cost")),
    ("solar", ("solar", "pv", "photovoltaic", "panel")),
    ("wind", ("wind", "turbine")),
    ("battery", ("battery", "storage", "powerwall", "backup power", "outage")),
    ("ev", ("ev", "electric car", "electric vehicle", "charging my car", "tesla")),
    ("cooling", ("cool", "ac", "air condition", "hot", "summer", "fan")),
    ("heating", ("heat", "furnace", "winter", "cold", "insulat", "draft")),
    ("lighting", ("light", "led", "bulb")),
    ("appliance", ("appliance", "fridge", "refrigerator", "dishwasher", "washer", "dryer", "water heater", "kettle")),
    ("rates", ("rate", "plan", "tariff", "peak", "off-peak", "tou", "time of use")),
    ("credit", ("credit", "rebate", "incentive", "subsidy", "tax")),
    ("grid", ("grid", "demand response", "flex", "wholesale")),
    ("audit", ("audit", "where to start", "begin")),
]


def _tips_reply(message: str) -> str:
    m = (message or "").lower()
    for topic, words in _TIP_KEYS:
        if any(w in m for w in words):
            return _TIPS[topic]
    return ("Here are the five highest-ROI moves for most US homes: 1) Shift heavy loads to off-peak hours. "
            "2) Set thermostat schedules (7-10°F setback, 8h/day). 3) Seal attic air leaks and check ducts. "
            "4) LEDs in your top-5 used fixtures. 5) Cold-water washes and a 120°F water heater. "
            "Ask me about solar, home batteries, EV charging, cooling, heating, rate plans, or tax credits for details.")


class ChatJsonRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


@router.post("/chat-json")
async def chat_json(req: ChatJsonRequest, user_id: str = Depends(get_current_user_id)):
    """Non-streaming JSON chat (mobile app contract; English-enforced; deterministic fallback)."""
    try:
        reply = await ai_assistant.chat_openai(req.message, GLOBAL_ENGLISH_PROMPT)
        return {"success": True, "reply": reply, "source": "llm"}
    except Exception:  # noqa: BLE001 - deterministic English tips keep the app functional without an LLM key
        return {"success": True, "reply": _tips_reply(req.message), "source": "tips"}


@router.post("/chat")
async def chat(message: str, project_id: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    """Chat with AI assistant (streaming)."""
    async def stream():
        async for chunk in ai_assistant.stream_openai(message, SYSTEM_PROMPT):
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no"},
    )


@router.post("/analyze")
async def analyze(
    query: str,
    context: dict,
    user_id: str = Depends(get_current_user_id),
):
    """Get AI analysis of renewable energy data."""
    response = await ai_assistant.chat_openai(query, SYSTEM_PROMPT)
    return {"analysis": response}


@router.get("/suggestions/{project_id}")
async def get_suggestions(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get AI recommendations for project optimization based on real project data."""
    from app.models.database import Project, ResourceAssessment, FinancialModel

    # Verify project belongs to user
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    suggestions = []

    # Get latest resource assessment
    res_result = await db.execute(
        select(ResourceAssessment)
        .where(ResourceAssessment.project_id == project_id)
        .order_by(ResourceAssessment.created_at.desc())
        .limit(1)
    )
    assessment = res_result.scalar_one_or_none()

    # Get latest financial model
    fin_result = await db.execute(
        select(FinancialModel)
        .where(FinancialModel.project_id == project_id)
        .order_by(FinancialModel.created_at.desc())
        .limit(1)
    )
    fin_model = fin_result.scalar_one_or_none()

    tech = project.technology or "solar"

    # Base suggestions from project type
    if tech == "solar":
        suggestions.append({
            "category": "Resource",
            "title": "Assess solar resource quality",
            "description": "Run a solar resource assessment to determine GHI and optimal tilt angle."
                if not assessment else
                f"GHI of {assessment.ghi:.0f} kWh/m²/yr detected. "
                f"Optimal tilt: {assessment.optimal_tilt or 'calculate'}° for this location.",
            "priority": "high" if (not assessment or (assessment.score or 0) < 70) else "medium",
        })
        if project.capacity_mw and project.capacity_mw < 10:
            suggestions.append({
                "category": "Economics",
                "title": "Consider scaling up for better economics",
                "description": f"Projects under 10 MW often have higher LCOE. "
                    f"Current size: {project.capacity_mw} MW. "
                    f"Consider bundling with nearby sites for economies of scale.",
                "priority": "medium",
            })
        if fin_model:
            if fin_model.lcoe and fin_model.lcoe > 0.08:
                suggestions.append({
                    "category": "Finance",
                    "title": "LCOE is above market average",
                    "description": f"Current LCOE: ${fin_model.lcoe:.3f}/kWh. "
                        f"Target for competitive projects: <$0.05/kWh. "
                        f"Review CAPEX assumptions and explore ITC or PBI incentives.",
                    "priority": "high",
                })
            if fin_model.irr and fin_model.irr < 8:
                suggestions.append({
                    "category": "Finance",
                    "title": "IRR below weighted average cost of capital",
                    "description": f"IRR of {fin_model.irr:.1f}% may not meet typical equity return thresholds (10-12%). "
                        f"Consider PPA price negotiation or CAPEX reduction via module/inverter procurement optimization.",
                    "priority": "high",
                })
            if fin_model.payback_years and fin_model.payback_years > 10:
                suggestions.append({
                    "category": "Finance",
                    "title": "Extended payback period",
                    "description": f"Payback of {fin_model.payback_years:.1f} years. "
                        f"Shorten by exploring accelerated depreciation (MACRS), ITC stacking, or revenue stacking with storage.",
                    "priority": "medium",
                })

    elif tech == "wind":
        suggestions.append({
            "category": "Resource",
            "title": "Assess wind resource quality",
            "description": "Run a wind resource assessment to determine mean wind speed and turbulence intensity."
                if not assessment else
                f"Wind power density: {assessment.wind_power_density or 'N/A'} W/m². "
                f"Resource class: {assessment.resource_class or 'N/A'}.",
            "priority": "high" if not assessment else "medium",
        })
        if fin_model and fin_model.irr and fin_model.irr < 8:
            suggestions.append({
                "category": "Finance",
                "title": "Wind project IRR below typical thresholds",
                "description": f"IRR of {fin_model.irr:.1f}%. "
                    f"Consider tax equity monetization, PTC extension, or repowering with higher-capacity turbines.",
                "priority": "high",
            })

    # Universal suggestions
    if project.location and not (project.latitude and project.longitude):
        suggestions.append({
            "category": "Data",
            "title": "Add precise coordinates",
            "description": "Adding lat/lng enables satellite-based resource analysis and precise yield modeling.",
            "priority": "medium",
        })

    if not fin_model:
        suggestions.append({
            "category": "Finance",
            "title": "Run financial modeling",
            "description": "Build a financial model to assess IRR, NPV, LCOE and sensitivity to key variables.",
            "priority": "high",
        })

    # Storage suggestion for any project >20MW
    if project.capacity_mw and project.capacity_mw >= 20:
        suggestions.append({
            "category": "Storage",
            "title": "Consider battery storage integration",
            "description": "Projects ≥20 MW may benefit from co-located BESS for frequency regulation, "
                "energy arbitrage, and IRA investment tax credit stacking (ITC + standalone BESS credit).",
            "priority": "medium",
        })

    return {
        "project_id": project_id,
        "project_name": project.name,
        "technology": tech,
        "suggestions": suggestions,
    }


# ── RAG 问答（/ai/ask）────────────────────────────────────────────────────────

_LLM_KEYS = (
    "DASHSCOPE_API_KEY",
    "DEEPSEEK_API_KEY",
    "GLM_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
)

NO_LLM_NOTICE = "未接入生成模型，以下为检索原文"
# 来源注册表是只读快照。进程内复用检索器，避免每个请求重复读取和解析
# rag_sources.json，同时减少短生命周期列表带来的内存抖动。
_RAG_SERVICE = RAGService()


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1)
    top_k: int = Field(5, ge=1, le=10)


def _llm_configured() -> bool:
    return any(getattr(settings, key, None) for key in _LLM_KEYS)


@router.post("/ask")
async def ask(
    req: AskRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """RAG 问答：检索注册表语料 + 带来源引用的回答骨架。

    未配置 LLM 时不编造段落：返回检索原文摘录与来源引用，并明确标注
    「未接入生成模型，以下为检索原文」。每次问答扣减 AI 日配额
    （free 20 次/日，超限 429）。
    """
    user = await assert_ai_quota(user_id, db)
    market = user.market or "cn"

    result = _RAG_SERVICE.search(req.question, top_k=req.top_k, market=market)
    hits = [hit for hit in result.hits if hit.score > 0]

    sources = [
        {
            "source_id": hit.source_id,
            "title": hit.title,
            "score": round(hit.score, 4),
            "last_verified_at": hit.metadata.get("last_verified_at"),
            "freshness_status": hit.metadata.get("freshness_status"),
            "verification": hit.metadata.get("verification"),
        }
        for hit in hits
    ]
    passages = [
        {
            "source_id": hit.source_id,
            "title": hit.title,
            "excerpt": hit.content[:500],
        }
        for hit in hits
    ]

    answer = None
    notice = NO_LLM_NOTICE
    generated = False
    if _llm_configured():
        context = "\n\n".join(
            f"[{hit.source_id}] {hit.title}: {hit.content}" for hit in hits
        )
        prompt = (
            "基于以下检索资料回答问题，逐条标注来源 [source_id]；"
            "资料不足时如实说明，禁止编造。\n\n"
            f"资料：\n{context or '（无检索命中）'}\n\n问题：{req.question}"
        )
        try:
            answer = await ai_assistant.chat_openai(prompt, SYSTEM_PROMPT)
            generated = True
            notice = "回答由生成模型基于检索资料生成，来源见 sources"
        except Exception:
            # LLM 调用失败同样 fail-closed：退回检索原文，不编造
            answer = None
            notice = NO_LLM_NOTICE

    await consume_ai_quota(user, db)

    return {
        "data": {
            "question": req.question,
            "answer": answer,
            "generated": generated,
            "notice": notice,
            "sources": sources,
            "passages": passages,
        }
    }
