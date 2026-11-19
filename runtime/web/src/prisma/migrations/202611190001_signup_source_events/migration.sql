-- 国内版注册来源题「从哪知道我们」：每个用户最多一条，只存枚举代码。新增表，不改已有表和数据。
CREATE TABLE IF NOT EXISTS "signup_source_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "signup_source_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "signup_source_events_userId_key" ON "signup_source_events"("userId");
CREATE INDEX IF NOT EXISTS "signup_source_events_source_createdAt_idx" ON "signup_source_events"("source", "createdAt");

DO $$ BEGIN
    ALTER TABLE "signup_source_events" ADD CONSTRAINT "signup_source_events_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
