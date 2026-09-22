-- Verified against a fresh database and an existing subscription/payment row.
BEGIN;

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_subscriptionId_fkey";

-- Add nullable columns first so existing financial records survive the upgrade.
ALTER TABLE "payments" ADD COLUMN "billingPeriod" TEXT,
ADD COLUMN "orderNo" TEXT,
ADD COLUMN "plan" "Plan",
ADD COLUMN "userId" TEXT,
ALTER COLUMN "subscriptionId" DROP NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- The old schema requires a subscription. Use its owner and plan; never guess
-- the original billing period or replace existing provider transaction IDs.
UPDATE "payments" AS p
SET "userId" = s."userId", "plan" = s."plan",
    "orderNo" = 'legacy-' || p."id", "billingPeriod" = 'legacy_unknown'
FROM "subscriptions" AS s WHERE p."subscriptionId" = s."id";

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "payments" WHERE "userId" IS NULL OR "plan" IS NULL) THEN
    RAISE EXCEPTION 'Payment migration blocked: historical subscription ownership is missing';
  END IF;
  IF EXISTS (SELECT 1 FROM "payments" WHERE "transactionId" IS NOT NULL GROUP BY "transactionId" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Payment migration blocked: duplicate provider transaction IDs require reconciliation';
  END IF;
END $$;

ALTER TABLE "payments" ALTER COLUMN "billingPeriod" SET NOT NULL,
ALTER COLUMN "orderNo" SET NOT NULL,
ALTER COLUMN "plan" SET NOT NULL,
ALTER COLUMN "userId" SET NOT NULL;

-- CreateTable
CREATE TABLE "demo_requests" (
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

-- CreateIndex
CREATE INDEX "demo_requests_email_createdAt_idx" ON "demo_requests"("email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_orderNo_key" ON "payments"("orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transactionId_key" ON "payments"("transactionId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
