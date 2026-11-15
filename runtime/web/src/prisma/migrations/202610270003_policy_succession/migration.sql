-- 政策生效、失效与替代关系。均可空，未核对的条目保持空值。
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "effectiveDate" TIMESTAMP(3);
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3);
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "supersededBy" TEXT;
