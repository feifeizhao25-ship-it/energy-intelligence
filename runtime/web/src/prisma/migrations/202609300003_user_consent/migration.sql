-- 登录同意凭证：记录用户何时、同意了哪一版《服务条款》《隐私政策》。
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;
