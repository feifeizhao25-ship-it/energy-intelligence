-- 政策库加来源与人工审核字段。已有条目（大模型抽取、未经审核）一律为 PENDING，不再影响测算，需人工审核后改为 APPROVED。
CREATE TYPE "PolicyReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "policies"
    ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "fetchedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "reviewStatus" "PolicyReviewStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS "reviewer" TEXT,
    ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "sourceTitle" TEXT,
    ADD COLUMN IF NOT EXISTS "docNumber" TEXT;

CREATE INDEX IF NOT EXISTS "policies_reviewStatus_region_idx" ON "policies"("reviewStatus", "region");
