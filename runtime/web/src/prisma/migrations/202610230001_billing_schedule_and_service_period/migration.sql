-- 到期降级登记，以及每笔付款覆盖的服务周期（退款测算只认订单，不认调用方填写的金额）。
ALTER TABLE "subscriptions"
    ADD COLUMN IF NOT EXISTS "scheduledPlan" "Plan",
    ADD COLUMN IF NOT EXISTS "scheduledFromPlan" "Plan",
    ADD COLUMN IF NOT EXISTS "scheduledEffectiveAt" TIMESTAMP(3);

ALTER TABLE "payments"
    ADD COLUMN IF NOT EXISTS "serviceStart" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "serviceEnd" TIMESTAMP(3);
