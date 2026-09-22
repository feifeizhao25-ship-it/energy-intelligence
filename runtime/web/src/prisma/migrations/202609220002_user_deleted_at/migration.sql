-- 注销：记录注销时间；注销后的账号不能再登录或刷新会话。
ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);
