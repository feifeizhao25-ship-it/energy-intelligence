ALTER TABLE "payments"
  ADD COLUMN "orderNo" TEXT,
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "plan" "Plan",
  ADD COLUMN "billingPeriod" TEXT;

UPDATE "payments" p
SET "userId" = s."userId", "plan" = s."plan", "billingPeriod" = 'legacy',
    "orderNo" = 'LEGACY-' || p."id"
FROM "subscriptions" s
WHERE p."subscriptionId" = s."id";

ALTER TABLE "payments"
  ALTER COLUMN "subscriptionId" DROP NOT NULL,
  ALTER COLUMN "orderNo" SET NOT NULL,
  ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "plan" SET NOT NULL,
  ALTER COLUMN "billingPeriod" SET NOT NULL,
  ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2);

CREATE UNIQUE INDEX "payments_orderNo_key" ON "payments"("orderNo");
CREATE UNIQUE INDEX "payments_transactionId_key" ON "payments"("transactionId");
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

