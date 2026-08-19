-- 护城河数据库架构
-- 审计、时间线、配额、企业权限

-- ========== 审计日志表 ==========
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,  -- CALCULATION, DIAGNOSIS, REPORT, EXPORT, AI_CALL, DATA_MUTATION
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "calcVersion" TEXT NOT NULL,
    "assumptionVersion" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "outputs" JSONB NOT NULL,
    "evidences" JSONB NOT NULL,
    "assumptions" JSONB NOT NULL,
    "intermediates" JSONB,
    "calibrations" TEXT[],
    "checksum" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AuditLog_projectId_idx" ON "AuditLog"("projectId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_orgId_idx" ON "AuditLog"("orgId");
CREATE INDEX "AuditLog_type_idx" ON "AuditLog"("type");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- ========== 项目时间线表 ==========
CREATE TABLE IF NOT EXISTS "ProjectTimeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,  -- PROJECT_CREATED, CALCULATION_DONE, DIAGNOSIS_DONE, etc
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "data" JSONB,
    "auditId" TEXT,
    "conclusionId" TEXT,
    "tags" TEXT[],
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ProjectTimeline_projectId_idx" ON "ProjectTimeline"("projectId");
CREATE INDEX "ProjectTimeline_userId_idx" ON "ProjectTimeline"("userId");
CREATE INDEX "ProjectTimeline_type_idx" ON "ProjectTimeline"("type");
CREATE INDEX "ProjectTimeline_createdAt_idx" ON "ProjectTimeline"("createdAt");
CREATE INDEX "ProjectTimeline_isMilestone_idx" ON "ProjectTimeline"("isMilestone");

-- ========== 配额使用表 ==========
CREATE TABLE IF NOT EXISTS "QuotaUsage" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,  -- AI_CALLS, CALCULATIONS, DIAGNOSES, EXPORTS, etc
    "count" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuotaUsage_unique" UNIQUE ("userId", "type", "periodStart")
);

CREATE INDEX "QuotaUsage_userId_idx" ON "QuotaUsage"("userId");
CREATE INDEX "QuotaUsage_type_idx" ON "QuotaUsage"("type");
CREATE INDEX "QuotaUsage_periodStart_idx" ON "QuotaUsage"("periodStart");

-- ========== 组织表 ==========
CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',  -- FREE, PRO, ENTERPRISE
    "approvalFlowEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dualConfirmRequired" BOOLEAN NOT NULL DEFAULT false,
    "sensitiveOpsApproval" BOOLEAN NOT NULL DEFAULT false,
    "exportApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
    "auditRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "ipWhitelist" TEXT[],
    "ssoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "watermarkEnabled" BOOLEAN NOT NULL DEFAULT false,
    "customRoles" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ========== 组织成员表 ==========
CREATE TABLE IF NOT EXISTS "OrganizationMember" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',  -- VIEWER, OPERATOR, ANALYST, ENGINEER, MANAGER, ADMIN, OWNER
    "customPermissions" TEXT[],
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedBy" TEXT,
    CONSTRAINT "OrganizationMember_unique" UNIQUE ("orgId", "userId")
);

CREATE INDEX "OrganizationMember_orgId_idx" ON "OrganizationMember"("orgId");
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- ========== 审批请求表 ==========
CREATE TABLE IF NOT EXISTS "ApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "type" TEXT NOT NULL,  -- EXPORT, WORKORDER, CONFIG_CHANGE, ROLE_CHANGE, DATA_DELETE, SENSITIVE_OP
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED, EXPIRED
    "approverIds" TEXT[] NOT NULL,
    "approvedBy" TEXT[],
    "rejectedBy" TEXT,
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ApprovalRequest_orgId_idx" ON "ApprovalRequest"("orgId");
CREATE INDEX "ApprovalRequest_requesterId_idx" ON "ApprovalRequest"("requesterId");
CREATE INDEX "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");

-- ========== 合规审计事件表 ==========
CREATE TABLE IF NOT EXISTS "ComplianceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "result" TEXT NOT NULL,  -- SUCCESS, DENIED, ERROR
    "denyReason" TEXT,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "metadata" JSONB,
    "riskLevel" TEXT NOT NULL,  -- LOW, MEDIUM, HIGH, CRITICAL
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ComplianceEvent_orgId_idx" ON "ComplianceEvent"("orgId");
CREATE INDEX "ComplianceEvent_userId_idx" ON "ComplianceEvent"("userId");
CREATE INDEX "ComplianceEvent_action_idx" ON "ComplianceEvent"("action");
CREATE INDEX "ComplianceEvent_riskLevel_idx" ON "ComplianceEvent"("riskLevel");
CREATE INDEX "ComplianceEvent_createdAt_idx" ON "ComplianceEvent"("createdAt");

-- ========== OpenClaw API Key 表 ==========
CREATE TABLE IF NOT EXISTS "OpenClawApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyQuota" INTEGER NOT NULL DEFAULT 10,
    "usedToday" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "lastResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3)
);

CREATE INDEX "OpenClawApiKey_userId_idx" ON "OpenClawApiKey"("userId");
CREATE INDEX "OpenClawApiKey_key_idx" ON "OpenClawApiKey"("key");

-- ========== 更新 User 表 ==========
-- 添加套餐字段（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'plan') THEN
        ALTER TABLE "User" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'FREE';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'orgId') THEN
        ALTER TABLE "User" ADD COLUMN "orgId" TEXT;
    END IF;
END $$;

-- ========== 结论卡片表（可选，用于持久化存储）==========
CREATE TABLE IF NOT EXISTS "ConclusionCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keyMetrics" JSONB NOT NULL,
    "recommendation" JSONB NOT NULL,
    "risks" JSONB,
    "nextSteps" JSONB,
    "auditId" TEXT NOT NULL,
    "calibrations" TEXT[],
    "dataRefs" JSONB,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ConclusionCard_projectId_idx" ON "ConclusionCard"("projectId");
CREATE INDEX "ConclusionCard_userId_idx" ON "ConclusionCard"("userId");
CREATE INDEX "ConclusionCard_type_idx" ON "ConclusionCard"("type");

-- ========== 诊断摘要表（可选，用于持久化存储）==========
CREATE TABLE IF NOT EXISTS "DiagnosticSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "stationId" TEXT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "headline" TEXT NOT NULL,
    "analysis" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "prioritizedActions" JSONB NOT NULL,
    "evidenceChain" JSONB NOT NULL,
    "lossEstimate" JSONB,
    "benchmark" JSONB,
    "auditId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "DiagnosticSummary_stationId_idx" ON "DiagnosticSummary"("stationId");
CREATE INDEX "DiagnosticSummary_userId_idx" ON "DiagnosticSummary"("userId");
CREATE INDEX "DiagnosticSummary_status_idx" ON "DiagnosticSummary"("status");

-- ========== 报告表 ==========
CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "confidentiality" TEXT NOT NULL DEFAULT 'INTERNAL',
    "watermark" TEXT,
    "content" JSONB NOT NULL,
    "auditIds" TEXT[],
    "exportUrls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3)
);

CREATE INDEX "Report_projectId_idx" ON "Report"("projectId");
CREATE INDEX "Report_userId_idx" ON "Report"("userId");
CREATE INDEX "Report_type_idx" ON "Report"("type");
