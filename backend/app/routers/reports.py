from app.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.report import Report
@router.get("")
async def list_reports_compat(
    return success(data={
            "items": items[start:end],
            "total": total,
            "page": page,
            "page_size": page_size,
        })


@router.post("")
async def create_report_compat(
    _: Dict[str, Any],
    user_id: str = Depends(get_current_user_id),
):
    """Legacy create-report entrypoint; use /reports/generate for generation."""
    raise HTTPException(status_code=422, detail="Use /api/v1/reports/generate")
@router.delete("/{report_id}")
async def delete_report(
    report_id: str,
    user_id: str = Depends(get_current_user_id),
):
