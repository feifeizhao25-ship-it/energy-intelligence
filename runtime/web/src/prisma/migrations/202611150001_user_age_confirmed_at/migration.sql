-- 年龄确认时间。空值表示尚未在引导页确认已年满 16 周岁。
-- 已完成引导的老用户回填确认时间，避免被送回引导页。不改条款文本。
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ageConfirmedAt" TIMESTAMP(3);

UPDATE "users"
SET "ageConfirmedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "profileCompleted" = true
  AND "ageConfirmedAt" IS NULL;
