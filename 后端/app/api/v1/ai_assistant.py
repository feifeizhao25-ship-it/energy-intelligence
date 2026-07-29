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

    service = RAGService()
    result = service.search(req.question, top_k=req.top_k, market=market)
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
