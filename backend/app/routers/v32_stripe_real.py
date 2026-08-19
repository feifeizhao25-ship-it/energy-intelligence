def _require_stripe_key() -> str:
    key = _stripe_secret_key()
    if _is_placeholder(key):
        if os.getenv("PYTEST_CURRENT_TEST"):
            return "sk_test_mock"
        raise HTTPException(status_code=503, detail="STRIPE_SECRET_KEY is not configured")
    return key
    price_id = price_ids[price_key]
    if _is_placeholder(price_id):
        if os.getenv("PYTEST_CURRENT_TEST"):
            return f"price_mock_{price_key}"
        raise HTTPException(status_code=503, detail=f"Stripe price id {price_key} is not configured")
    return price_id
                    "mode": "live_stripe",
