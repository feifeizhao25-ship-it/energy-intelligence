-- 补齐「支付订单」和「预约演示」两处迁移缺口。
--
-- 之前这两段只写在 runtime/web/prisma/migrations（另一个目录），而容器启动执行的是
-- src/prisma/migrations（docker-entrypoint.sh: prisma migrate deploy --schema=src/prisma/schema.prisma）。
-- 结果：库里的 payments 没有 orderNo / userId / plan / billingPeriod，也没有 demo_requests 表，
-- 会员下单、预约演示、账号注销时删除预约记录都会在运行时报「列/表不存在」。
-- 写法全部可重复执行（IF NOT EXISTS），以免在手工补过表的环境上失败。

-- ==================== payments：订单号、用户、方案、周期 ====================
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "orderNo" TEXT,
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "plan" "Plan",
  ADD COLUMN IF NOT EXISTS "billingPeriod" TEXT;

-- 旧记录（订阅关联的老流水）回填，保证下面的 NOT NULL 能成立
UPDATE "payments" p
SET "userId" = s."userId", "plan" = s."plan", "billingPeriod" = 'legacy',
    "orderNo" = 'LEGACY-' || p."id"
FROM "subscriptions" s
WHERE p."subscriptionId" = s."id" AND p."orderNo" IS NULL;

ALTER TABLE "payments"
  ALTER COLUMN "subscriptionId" DROP NOT NULL,
  ALTER COLUMN "orderNo" SET NOT NULL,
  ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "plan" SET NOT NULL,
  ALTER COLUMN "billingPeriod" SET NOT NULL,
  ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2);

-- 订单号唯一；支付宝交易号唯一（同一笔交易不能记到两个订单上，回调幂等靠它兜底）
CREATE UNIQUE INDEX IF NOT EXISTS "payments_orderNo_key" ON "payments"("orderNo");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_transactionId_key" ON "payments"("transactionId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_userId_fkey') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ==================== demo_requests：企业预约演示 ====================
CREATE TABLE IF NOT EXISTS "demo_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "demo_requests_email_createdAt_idx" ON "demo_requests"("email", "createdAt");
