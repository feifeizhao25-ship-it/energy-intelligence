"""
Skills 执行 API 路由

提供统一的 REST API 端点用于:
- 列出所有已注册的 Skills (GET /skills)
- 获取单个 Skill 详情 (GET /skills/{skill_id})
- 获取 Skill 的输入 Schema (GET /skills/{skill_id}/schema)
- 同步执行 Skill (POST /skills/{skill_id}/execute)
- 异步执行 Skill + 进度查询 (POST /skills/{skill_id}/execute?async=true)
- 查询异步任务状态 (GET /skills/tasks/{task_id})
- 按分类列出 Skills (GET /skills/categories/{category})

替换原有的 skills.py 静态列表端点。
"""

from __future__ import annotations

import asyncio
import uuid
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core.dependencies import get_current_user_id
from app.schemas.common import SuccessResponse
from app.skills.base import SkillStatus
from app.skills.registry import get_registry
from app.utils.response import error as error_response, success

router = APIRouter(prefix="/skills", tags=["技能"])

# ---------------------------------------------------------------------------
# 内存任务存储 (生产环境应使用 Redis)
# ---------------------------------------------------------------------------
_tasks_store: Dict[str, Dict[str, Any]] = {}


async def _run_skill_async(
    task_id: str, skill_id: str, params: Dict[str, Any], user_id: str
) -> None:
    """Execute a registered skill and persist a pollable terminal state."""
    task = _tasks_store[task_id]
    task["status"] = SkillStatus.RUNNING.value
    task["progress"] = 10
    started = time.time()
    try:
        from app.skills.param_adapter import adapt_skill_params

        result = await get_registry().execute(
            skill_id, adapt_skill_params(skill_id, params)
        )
        failed = result.get("status") == SkillStatus.FAILED.value
        task.update({
            "status": SkillStatus.FAILED.value if failed else SkillStatus.COMPLETED.value,
            "progress": 100,
            "result": None if failed else result.get("data"),
            "output": None if failed else result.get("data"),
            "error": result.get("error") if failed else None,
        })
    except Exception as exc:
        logger.exception("Asynchronous skill execution failed: %s", skill_id)
        task.update({
            "status": SkillStatus.FAILED.value,
            "progress": 100,
            "error": str(exc),
        })
    finally:
        task["duration_ms"] = int((time.time() - started) * 1000)
        task["completed_at"] = datetime.now().isoformat()


# ---------------------------------------------------------------------------
# GET /skills — 列出所有 Skills
# ---------------------------------------------------------------------------

@router.get("", response_model=SuccessResponse[dict])
async def list_skills(
    category: Optional[str] = Query(None, description="按分类过滤"),
    service: Optional[str] = Query(None, description="按微服务过滤"),
    user_id: str = Depends(get_current_user_id),
):
    """返回所有可用的 AI Skills 列表"""
    registry = get_registry()
    skills_meta = registry.list_skills(category=category, service=service)

    skills_list = [meta.to_dict() for meta in skills_meta]

    return success(data={
        "items": skills_list,
        "skills": skills_list,  # backward compat
        "total": len(skills_list),
        "categories": registry.list_categories(),
        "services": registry.list_services(),
    })


# ---------------------------------------------------------------------------
# GET /skills/categories — 获取所有分类
# ---------------------------------------------------------------------------

@router.get("/categories", response_model=SuccessResponse[dict])
async def list_categories(
    user_id: str = Depends(get_current_user_id),
):
    """获取所有 Skill 分类及其数量"""
    registry = get_registry()
    categories = registry.list_categories()
    result = []
    for cat in categories:
        skills = registry.list_skills(category=cat)
        result.append({
            "category": cat,
            "count": len(skills),
            "skills": [s.to_dict() for s in skills],
        })
    return success(data={
        "categories": result,
        "total_categories": len(result),
    })


# ---------------------------------------------------------------------------
# GET /skills/executions — 获取所有 Skill 执行历史
# ---------------------------------------------------------------------------

@router.get("/executions", response_model=SuccessResponse[dict])
async def list_executions(
    user_id: str = Depends(get_current_user_id),
):
    """获取所有已执行的任务记录"""
    # 过滤出当前用户的任务
    user_tasks = [t for t in _tasks_store.values() if t.get("user_id") == user_id]
    
    # 按照创建时间降序排序
    user_tasks.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    # 无记录时返回空列表（不再使用 mock 数据）
        
    return success(data={
        "items": user_tasks,
        "total": len(user_tasks)
    })


# ---------------------------------------------------------------------------
# GET /skills/{skill_id} — 获取 Skill 详情
# ---------------------------------------------------------------------------

@router.get("/{skill_id}", response_model=SuccessResponse[dict])
async def get_skill_detail(
    skill_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """获取指定 Skill 的详情"""
    registry = get_registry()
    meta = registry.get_meta(skill_id)
    if meta is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill '{skill_id}' not found",
        )

    wrapper = registry.get(skill_id)
    schema_info = wrapper.get_schema() if wrapper else {}

    return success(data={
        **meta.to_dict(),
        "schema": schema_info,
    })


# ---------------------------------------------------------------------------
# GET /skills/{skill_id}/schema — 获取输入/输出 Schema
# ---------------------------------------------------------------------------

@router.get("/{skill_id}/schema", response_model=SuccessResponse[dict])
async def get_skill_schema(
    skill_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """获取 Skill 的输入/输出 JSON Schema"""
    registry = get_registry()
    wrapper = registry.get(skill_id)
    if wrapper is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill '{skill_id}' not found",
        )

    return success(data={
        "skill_id": skill_id,
        "schema": wrapper.get_schema(),
    })


from pydantic import BaseModel

class FrontendSkillExecuteRequest(BaseModel):
    skill_id: str
    parameters: Dict[str, Any] = {}

# ---------------------------------------------------------------------------
# POST /skills/execute — 前端兼容执行 Skill 端点
# ---------------------------------------------------------------------------

@router.post("/execute", response_model=SuccessResponse[dict])
async def execute_skill_compat(
    req: FrontendSkillExecuteRequest,
    request: Request,
    async_exec: bool = Query(False, alias="async", description="是否异步执行"),
    timeout: float = Query(60.0, description="超时秒数 (同步模式)"),
    user_id: str = Depends(get_current_user_id),
):
    """前端兼容端点，通过请求体传入 skill_id"""
    return await execute_skill(
        skill_id=req.skill_id,
        request=request,
        params=req.parameters,
        async_exec=async_exec,
        timeout=timeout,
        user_id=user_id,
    )

# ---------------------------------------------------------------------------
# POST /skills/{skill_id}/execute — 执行 Skill
# ---------------------------------------------------------------------------

@router.post("/{skill_id}/execute", response_model=SuccessResponse[dict])
async def execute_skill(
    skill_id: str,
    request: Request,
    params: Dict[str, Any] = {},
    async_exec: bool = Query(False, alias="async", description="是否异步执行"),
    timeout: float = Query(60.0, description="超时秒数 (同步模式)"),
    user_id: str = Depends(get_current_user_id),
):
    """
    执行指定 Skill。

    - 同步模式 (默认): 阻塞等待结果返回
    - 异步模式 (?async=true): 立即返回 task_id，通过 GET /skills/tasks/{task_id} 查询进度
    """
    registry = get_registry()

    # 检查 Skill 是否存在
    meta = registry.get_meta(skill_id)
    if meta is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill '{skill_id}' not found",
        )

    if async_exec:
        # 异步模式: 创建后台任务
        task_id = str(uuid.uuid4())
        _tasks_store[task_id] = {
            "id": task_id,
            "task_id": task_id,
            "skill_id": skill_id,
            "skill_name": meta.name if meta else skill_id,
            "status": SkillStatus.PENDING.value,
            "progress": 0,
            "input": params,
            "result": None,
            "error": None,
            "user_id": user_id,
            "created_at": datetime.now().isoformat(),
            "duration_ms": 0,
        }

        # 在后台运行
        asyncio.create_task(
            _run_skill_async(task_id, skill_id, params, user_id)
        )

        return success(data={
            "task_id": task_id,
            "skill_id": skill_id,
            "status": SkillStatus.PENDING.value,
            "message": "Task created. Use GET /skills/tasks/{task_id} to check progress.",
        })

    # 同步模式: 直接执行
    # P0 修复: 工程参数自动适配为 Skill 金融参数
    from app.skills.param_adapter import adapt_skill_params
    adapted_params = adapt_skill_params(skill_id, params)
    market = request.headers.get("x-market", "cn").lower()
    if skill_id == "RA-001":
        adapted_params["market"] = "global" if market in {"global", "int", "en"} else "cn"
    
    start_time = time.time()
    created_at = datetime.now().isoformat()
    result = await registry.execute(skill_id, adapted_params, timeout=timeout)
    completed_at = datetime.now().isoformat()
    duration_ms = int((time.time() - start_time) * 1000)

    task_id = str(uuid.uuid4())
    _tasks_store[task_id] = {
        "id": task_id,
        "task_id": task_id,
        "skill_id": skill_id,
        "skill_name": meta.name if meta else skill_id,
        "status": "completed" if result.get("status") != SkillStatus.FAILED.value else "failed",
        "input": params,
        "output": result.get("data") if result.get("status") != SkillStatus.FAILED.value else None,
        "result": result.get("data") if result.get("status") != SkillStatus.FAILED.value else None,
        "error": result.get("error") if result.get("status") == SkillStatus.FAILED.value else None,
        "duration_ms": duration_ms,
        "created_at": created_at,
        "completed_at": completed_at,
        "user_id": user_id,
    }

    if result.get("status") == SkillStatus.FAILED.value:
        # F14 改进: 增强错误信息, 列出 missing fields + 提供 schema hint
        error_detail = {
            "skill_id": skill_id,
            "status": "failed",
            "error": result.get("error", "Unknown error"),
            "error_type": result.get("error_type", "ExecutionError"),
        }
        # 如果缺字段, 列出必需字段
        err_msg = str(result.get("error", ""))
        if "missing" in err_msg.lower() or "required" in err_msg.lower():
            try:
                # 从 schema 提取必需字段
                meta = registry.get_meta(skill_id)
                if meta:
                    error_detail["hint"] = f"Try GET /api/v1/skills/{skill_id}/schema for required fields"
            except Exception as e:
                logger.warning(f"[skills_executor] 提取schema提示失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_detail,
        )

    response_data = {
        **result,
        **_tasks_store[task_id],
    }
    return success(data=response_data)


# ---------------------------------------------------------------------------
# GET /skills/tasks/{task_id} — 查询异步任务状态
# ---------------------------------------------------------------------------

@router.get("/tasks/{task_id}", response_model=SuccessResponse[dict])
async def get_task_status(
    task_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """查询异步执行任务的状态和结果"""
    task = _tasks_store.get(task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task '{task_id}' not found",
        )

    return success(data=task)


# ---------------------------------------------------------------------------
# POST /skills/batch — 批量执行
