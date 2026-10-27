-- 用户画像。旧偏好仍在 usage_logs，由应用层迁移后再写入本表。
CREATE TABLE IF NOT EXISTS "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "subRole" TEXT,
    "provinces" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "projectStage" TEXT,
    "readingMode" TEXT NOT NULL DEFAULT 'professional',
    "notifyFrequency" TEXT NOT NULL DEFAULT '即时',
    "notifyChannel" TEXT NOT NULL DEFAULT '站内',
    "notifyWindow" TEXT NOT NULL DEFAULT '08:00-20:00',
    "personalized" BOOLEAN NOT NULL DEFAULT true,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "follows" JSONB NOT NULL DEFAULT '[]',
    "understoodTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_userId_key" ON "user_profiles"("userId");

DO $$ BEGIN
    ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
