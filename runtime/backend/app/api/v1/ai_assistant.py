from typing import Optional
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.dependencies import get_current_user_id
from app.core.database import get_db
from app.services.ai_service import ai_assistant
from app.core.subscription import QuotaExceeded, assert_ai_quota, consume_ai_quota
from app.services.evidence_envelope import envelope_from_rag
from app.services.rag_service import RAGService
from app.models.user import User
import json

router = APIRouter(prefix="/ai")

_AI_LIMITATIONS = ["AI 生成内容仅供辅助分析，关键投资与工程决策需人工复核"]


def _retrieve(query: str, market: str) -> list:
    """先检索、后生成：只保留有词面命中、且未过期的来源；检索失败降级为空。"""
    try:
        hits = RAGService().search(query, top_k=3, market=market, exclude_stale=True).hits
    except Exception:
        return []
    return [h for h in hits if h.score > 0]


def _grounded_prompt(base_prompt: str, hits: list, market: str) -> str:
    """把检索到的证据编号注入系统提示，要求模型按 [S1] 形式引用。"""
    if market == "global":
        if not hits:
            return base_prompt + "\n\nRetrieved sources: none. Say the source library has no matching document; do not cite anything."
        head = "\n\nRetrieved sources (cite as [S1], [S2] after each claim that uses them; do not cite anything else):"
    else:
        if not hits:
            return base_prompt + "\n\n检索到的资料：无。请说明本库尚未收录相关资料，不得编造引用。"
        head = "\n\n检索到的资料（使用时在句末以 [S1]、[S2] 标注引用；不得引用列表之外的来源）："
    lines = []
    for i, h in enumerate(hits, 1):
        md = h.metadata or {}
        lines.append(
            f"[S{i}] {h.title} | {md.get('source_org') or ''} | {md.get('published_at') or md.get('year')} | "
            f"{md.get('source_url') or ''}\n{h.content}"
        )
    return base_prompt + head + "\n" + "\n".join(lines)


def _evidence_for(answer: str, hits: list) -> dict:
    """证据封装使用与生成时相同的检索结果（不再事后另行检索）。"""
    return envelope_from_rag(answer, hits, limitations=_AI_LIMITATIONS)


class MobileChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)

SYSTEM_PROMPT = """You are the Energy Intelligence AI Assistant for renewable energy (solar PV, wind, storage, project finance).
Use only tool results or retrieved sources for specific figures, and cite source and date. If a tool fails or no source is
found, say so plainly ("No data available" / "Not in our source library") instead of estimating or inventing numbers.
Bottom lines you must always follow:
1. No investment advice or return guarantees (never say "recommend investing", "worth investing", "guaranteed return").
2. No price predictions (electricity, module or carbon prices).
3. Never speak as or impersonate a government or official body; quote official documents with a link to the original.
If asked for investment advice or a price prediction, reply: "I can provide facts, data, primary policy sources and
verifiable calculations, but not investment advice or price predictions."
Respond in the user's language."""

CN_SYSTEM_PROMPT = """你是新能源智库的分析助手，熟悉中国光伏、风电、储能和项目财务。
具体数据只使用工具结果或已收录资料，注明来源、日期、假设与适用地区；工具失败或资料库未收录时，直接说明"未获取到数据/本库尚未收录"，不得估算或编造。
三条底线：
1. 不提供投资建议或收益承诺（不说"建议投资""值得投资""稳赚""保本"）；
2. 不做价格预测（电价、组件价格、碳价）；
3. 不冒充官方，引用政府文件写"转引自……"并给出原文链接。
用户要求投资建议或价格预测时回答："我只能提供事实、数据、政策原文和可验证的计算，不提供投资建议或价格预测。"
使用通俗中文回答。"""


async def _market_for_user(user_id: str, db: AsyncSession) -> str:
    market = await db.scalar(select(User.market).where(User.id == user_id))
    return "global" if market == "global" else "cn"


@router.post("/chat")
async def chat(
    message: str,
    project_id: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Chat with AI assistant (streaming).

    与 /chat-json、/analyze 同一套配额：开始前校验，流式成功结束后才扣减一次
    （模型中途失败不扣）。原来流式接口完全不校验配额，免费用户可无限调用。
    """
    try:
        user = await assert_ai_quota(user_id, db)
    except QuotaExceeded as error:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "AI_QUOTA_EXCEEDED",
                "message": f"今日 AI 对话次数已用完（{error.limit} 次/日），可明日再试或升级会员获取更多次数。",
                "upgrade_url": "/pricing",
                "limit": error.limit,
            },
        ) from error
    market = await _market_for_user(user_id, db)
    hits = _retrieve(message, market)
    prompt = _grounded_prompt(SYSTEM_PROMPT if market == "global" else CN_SYSTEM_PROMPT, hits, market)
    sources = _evidence_for("", hits)["sources"]

    async def stream():
        # 先下发本次回答所依据的来源，前端可按 [S1] 编号渲染引用
        yield f"data: {json.dumps({'sources': sources}, ensure_ascii=False)}\n\n"
        produced = False
        async for chunk in ai_assistant.stream_openai(message, prompt, market=market):
            produced = produced or bool(chunk)
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        if produced:
            await consume_ai_quota(user, db)
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no"},
    )


@router.post("/chat-json")
async def chat_json(
    body: MobileChatRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Authenticated non-streaming chat response for mobile clients."""
    try:
        user = await assert_ai_quota(user_id, db)
    except QuotaExceeded as error:
        raise HTTPException(status_code=429, detail=str(error)) from error
    try:
        market = await _market_for_user(user_id, db)
        hits = _retrieve(body.message, market)
        prompt = _grounded_prompt(SYSTEM_PROMPT if market == "global" else CN_SYSTEM_PROMPT, hits, market)
        result = await ai_assistant.chat_openai_with_metadata(body.message, prompt, market=market)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable") from error
    await consume_ai_quota(user, db)
    return {
        "message": result["content"],
        "ai_metadata": result["metadata"],
        "evidence": _evidence_for(result["content"], hits),
    }


@router.post("/analyze")
async def analyze(
    query: str,
    context: dict,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get AI analysis of renewable energy data."""
    try:
        user = await assert_ai_quota(user_id, db)
    except QuotaExceeded as error:
        raise HTTPException(status_code=429, detail=str(error)) from error
    try:
        market = await _market_for_user(user_id, db)
        hits = _retrieve(query, market)
        prompt = _grounded_prompt(SYSTEM_PROMPT if market == "global" else CN_SYSTEM_PROMPT, hits, market)
        result = await ai_assistant.chat_openai_with_metadata(query, prompt, market=market)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable") from error
    await consume_ai_quota(user, db)
    return {
        "analysis": result["content"],
        "ai_metadata": result["metadata"],
        "evidence": _evidence_for(result["content"], hits),
    }


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
