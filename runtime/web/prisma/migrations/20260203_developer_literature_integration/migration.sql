-- ==================== API 开发者功能迁移 ====================
-- CreateTable: api_keys
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL UNIQUE,
    "permissions" JSONB NOT NULL,
    "rateLimit" INTEGER NOT NULL DEFAULT 10000,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");
CREATE INDEX "api_keys_status_idx" ON "api_keys"("status");

-- CreateTable: api_usage
CREATE TABLE "api_usage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apiKeyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_usage_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "api_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "api_usage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "api_usage_userId_createdAt_idx" ON "api_usage"("userId", "createdAt");
CREATE INDEX "api_usage_apiKeyId_createdAt_idx" ON "api_usage"("apiKeyId", "createdAt");
CREATE INDEX "api_usage_projectId_idx" ON "api_usage"("projectId");

-- ==================== 文献项目关联迁移 ====================
-- CreateTable: project_paper_recommendations
CREATE TABLE "project_paper_recommendations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[] NOT NULL,
    "abstract" TEXT,
    "year" INTEGER,
    "reason" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_paper_recommendations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "project_paper_recommendations_projectId_paperId_key" ON "project_paper_recommendations"("projectId", "paperId");
CREATE INDEX "project_paper_recommendations_projectId_score_idx" ON "project_paper_recommendations"("projectId", "score");
CREATE INDEX "project_paper_recommendations_status_idx" ON "project_paper_recommendations"("status");

-- 扩展SavedPaper表以支持项目关联
ALTER TABLE "saved_papers" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "saved_papers" ADD COLUMN IF NOT EXISTS "relevanceScore" DOUBLE PRECISION;
ALTER TABLE "saved_papers" ADD COLUMN IF NOT EXISTS "aiInsights" TEXT;

ALTER TABLE "saved_papers" ADD CONSTRAINT "saved_papers_projectId_fkey" 
    FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "saved_papers_projectId_idx" ON "saved_papers"("projectId");
