@router.get("/plans", response_model=SuccessResponse[dict])
async def get_plans(market: Optional[str] = Query(default=None)):
    """Return public subscription plan definitions."""
    is_gl = (market or "").lower() in ("global", "intl", "int", "en")
    
    currency = "USD" if is_gl else "CNY"
    if is_gl:
        prices = {"free": 0, "pro": 299, "enterprise": 5999}
    else:
        prices = {"free": 0, "pro": 29900, "enterprise": 99900}
    name_map_cn = {"free": "Free", "pro": "Pro", "enterprise": "Enterprise"}
    name_map_gl = {"free": "Free", "pro": "Plus", "enterprise": "Pro"}
