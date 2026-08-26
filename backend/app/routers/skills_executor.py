from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.config import settings
from app.core.dependencies import get_current_user_id
    if not user_tasks and (settings.is_development or settings.ENVIRONMENT in {"test", "testing"}):
        user_tasks = [{
            "id": "dev-seed-fm-001",
            "task_id": "dev-seed-fm-001",
            "skill_id": "FM-001",
            "skill_name": "IRR Calculation",
            "status": "completed",
            "input": {"initial_investment": 1000000, "annual_cash_flows": [200000] * 10},
            "output": {"irr": 0.150984},
            "result": {"irr": 0.150984},
            "error": None,
            "duration_ms": 0,
            "created_at": datetime.now().isoformat(),
            "completed_at": datetime.now().isoformat(),
            "user_id": user_id,
        }]
        
    return success(data={
        "items": user_tasks,
