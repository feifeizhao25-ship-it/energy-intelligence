-- 验证码校验失败次数：同一条验证码错 5 次即作废，防止穷举 6 位数字。
ALTER TABLE "verification_codes" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
