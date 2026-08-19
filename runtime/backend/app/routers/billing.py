class UsageItem(BaseModel):
    category: str
    total_quantity: int
    unit: str
    limit: int = -1
    remaining: int = -1
    period: str = "month"
async def get_plans(market: Optional[str] = Query(default=None)):
    name_map_cn = {"free": "免费版", "pro": "专业版", "enterprise": "企业版"}
async def get_usage(
    """TC-BILL-007: 真实用量与当前套餐限额。

    用户配额计数器是产品限额的权威来源；usage_records 用于补充其他
    已落库动作。旧实现查询了模型不存在的 category/unit/quantity
    字段，生产调用会直接失败。
    """
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    plan = user.subscription_plan or "free"
    limits = PLAN_QUOTAS.get(plan, PLAN_QUOTAS["free"])
    usage = dict(user.usage_quota or {})
    day_key = f"daily_{now.strftime('%Y-%m-%d')}"
    month_key = f"monthly_{now.strftime('%Y-%m')}"

    stmt = (
        select(UsageRecord.action_type, func.count(UsageRecord.id))
        .where(UsageRecord.user_id == user_id)
        .where(UsageRecord.created_at >= start_of_month)
        .group_by(UsageRecord.action_type)
    )
    result = await db.execute(stmt)
    recorded_actions = {action: int(total or 0) for action, total in result.all()}

    def item(category: str, used: int, limit: int, unit: str, period: str) -> UsageItem:
        remaining = -1 if limit == -1 else max(limit - used, 0)
        return UsageItem(
            category=category,
            total_quantity=used,
            unit=unit,
            limit=limit,
            remaining=remaining,
            period=period,
        )

    known = [
        item("ai_queries", int(dict(usage.get("ai_calls", {})).get(day_key, 0) or 0),
             limits["ai_queries_per_day"], "calls", "day"),
        item("report_exports", int(dict(usage.get("report_exports", {})).get(month_key, 0) or 0),
             limits["report_exports_per_month"], "exports", "month"),
    ]
    known.extend(
        item(action, count, -1, "actions", "month")
        for action, count in sorted(recorded_actions.items())
        if action not in {"ai_queries", "report_exports"}
    )
    return success(data=known)