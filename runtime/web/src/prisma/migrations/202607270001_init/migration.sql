-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'MAINTENANCE', 'FULL', 'TEAM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PAUSED');

-- CreateEnum
CREATE TYPE "AchievementCategory" AS ENUM ('GENERATION', 'CARBON', 'USAGE', 'STREAK', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('PRO_DAYS', 'POINTS', 'DISCOUNT', 'BADGE');

-- CreateEnum
CREATE TYPE "ActivationStatus" AS ENUM ('INACTIVE', 'ACTIVATING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectLifecycleStage" AS ENUM ('PLANNING', 'DESIGN', 'FINANCING', 'CONSTRUCTION', 'COMMISSIONING', 'OPERATING', 'OPTIMIZATION', 'DECOMMISSIONING');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "CalcType" AS ENUM ('SOLAR_REVENUE', 'WIND_REVENUE', 'STORAGE_REVENUE', 'PR_ANALYSIS', 'FAULT_DIAGNOSIS', 'CLEANING_ROI', 'RESOURCE_ASSESSMENT');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectEventType" AS ENUM ('PROJECT_CREATED', 'FEASIBILITY_STARTED', 'FEASIBILITY_COMPLETED', 'RESOURCE_ASSESSED', 'DESIGN_UPDATED', 'APPROVAL_SUBMITTED', 'APPROVAL_RECEIVED', 'CONSTRUCTION_STARTED', 'EQUIPMENT_ARRIVED', 'INSTALLATION_COMPLETED', 'GRID_CONNECTED', 'OPERATION_STARTED', 'GENERATION_MILESTONE', 'REVENUE_MILESTONE', 'DIAGNOSIS_PERFORMED', 'ISSUE_DETECTED', 'ISSUE_RESOLVED', 'CLEANING_PERFORMED', 'MAINTENANCE_SCHEDULED', 'MAINTENANCE_COMPLETED', 'REPORT_GENERATED', 'DATA_EXPORTED', 'COMPARISON_MADE', 'NOTE_ADDED');

-- CreateEnum
CREATE TYPE "EventImportance" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ComparisonType" AS ENUM ('TIME_SERIES', 'SCENARIO', 'ACTUAL_VS_FORECAST', 'BENCHMARK');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "phone" TEXT,
    "password" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "industry" TEXT,
    "bio" TEXT,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "planExpireAt" TIMESTAMP(3),
    "dailyAiCalls" INTEGER NOT NULL DEFAULT 0,
    "dailyResourceQueries" INTEGER NOT NULL DEFAULT 0,
    "dailyCalculations" INTEGER NOT NULL DEFAULT 0,
    "dailyPaperSearches" INTEGER NOT NULL DEFAULT 0,
    "dailyDiagnoses" INTEGER NOT NULL DEFAULT 0,
    "lastResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectCount" INTEGER NOT NULL DEFAULT 0,
    "paperCount" INTEGER NOT NULL DEFAULT 0,
    "stationCount" INTEGER NOT NULL DEFAULT 0,
    "folderCount" INTEGER NOT NULL DEFAULT 0,
    "teamId" TEXT,
    "teamRole" TEXT,
    "referralCode" TEXT,
    "referredById" TEXT,
    "referralPoints" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "lastCheckInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "transactionId" TEXT,
    "description" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'TEAM',
    "memberLimit" INTEGER NOT NULL DEFAULT 5,
    "storageLimit" DOUBLE PRECISION NOT NULL DEFAULT 10737418240.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "location" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "capacity" DOUBLE PRECISION,
    "area" DOUBLE PRECISION,
    "siteData" JSONB,
    "comparisonResult" JSONB,
    "recommendedType" TEXT,
    "reportStatus" TEXT NOT NULL DEFAULT 'LOCKED',
    "parameters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "capacity" DOUBLE PRECISION,
    "currentPower" DOUBLE PRECISION,
    "dailyEnergy" DOUBLE PRECISION,
    "totalEnergy" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'normal',
    "lastUpdated" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "station_records" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "power" DOUBLE PRECISION,
    "energy" DOUBLE PRECISION,
    "irradiance" DOUBLE PRECISION,
    "windSpeed" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'normal',

    CONSTRAINT "station_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewardClaimed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "morningReport" BOOLEAN NOT NULL DEFAULT true,
    "eveningReport" BOOLEAN NOT NULL DEFAULT true,
    "alerts" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
    "channels" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "isAnswered" BOOLEAN NOT NULL DEFAULT false,
    "bestAnswerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "isBest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_records" (
    "id" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'registered',
    "rewardDays" INTEGER NOT NULL DEFAULT 0,
    "rewardCash" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "referral_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_locations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "solarGHI" DOUBLE PRECISION,
    "windSpeed" DOUBLE PRECISION,
    "lastFetch" TIMESTAMP(3),
    "notes" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnoses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_papers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "folderId" TEXT,
    "projectId" TEXT,
    "paperId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" JSONB NOT NULL,
    "year" INTEGER,
    "journal" TEXT,
    "abstract" TEXT,
    "pdfUrl" TEXT,
    "source" TEXT,
    "status" TEXT DEFAULT 'idle',
    "citationCount" INTEGER DEFAULT 0,
    "tags" TEXT[],
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "aiSummary" TEXT,
    "aiInsights" TEXT,
    "relevanceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_paper_recommendations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" JSONB NOT NULL,
    "abstract" TEXT,
    "year" INTEGER,
    "reason" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_paper_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_folders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paper_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_notes" (
    "id" TEXT NOT NULL,
    "savedPaperId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "highlight" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paper_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_calls" (
    "id" TEXT NOT NULL,
    "apiName" TEXT NOT NULL,
    "userId" TEXT,
    "endpoint" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "applicablePlans" "Plan"[],
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "conditions" TEXT,
    "sourceUrl" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quota_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quota_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_timeline" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "data" JSONB,
    "auditId" TEXT,
    "conclusionId" TEXT,
    "tags" TEXT[],
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "morningPush" BOOLEAN NOT NULL DEFAULT true,
    "eveningPush" BOOLEAN NOT NULL DEFAULT true,
    "alertPush" BOOLEAN NOT NULL DEFAULT true,
    "achievementPush" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" "AchievementCategory" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "rewardType" "RewardType" NOT NULL,
    "rewardValue" INTEGER NOT NULL,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements_detail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_achievements_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "userId" TEXT,
    "deviceId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "properties" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercentage" INTEGER NOT NULL DEFAULT 0,
    "targetingRules" JSONB,
    "variants" JSONB,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'CALCULATE',
    "resourceType" TEXT NOT NULL DEFAULT 'calculation',
    "resourceId" TEXT NOT NULL DEFAULT '',
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "projectId" TEXT,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activated_projects" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activationStatus" "ActivationStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentStage" "ProjectLifecycleStage" NOT NULL DEFAULT 'OPERATING',
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedAt" TIMESTAMP(3),
    "dataConnections" JSONB NOT NULL DEFAULT '{}',
    "automationConfig" JSONB NOT NULL DEFAULT '{}',
    "monitoringStats" JSONB NOT NULL DEFAULT '{"totalDaysMonitored": 0, "dataPointsCollected": 0, "anomaliesDetected": 0, "alertsSent": 0, "reportsGenerated": 0}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activated_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_analysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "activatedProjectId" TEXT NOT NULL,
    "analysisDate" DATE NOT NULL,
    "generationActual" DECIMAL(12,2) NOT NULL,
    "generationExpected" DECIMAL(12,2) NOT NULL,
    "generationRatio" DECIMAL(5,4) NOT NULL,
    "pr" DECIMAL(5,4) NOT NULL,
    "prTrend" TEXT NOT NULL DEFAULT 'STABLE',
    "revenueActual" DECIMAL(12,2) NOT NULL,
    "revenueExpected" DECIMAL(12,2) NOT NULL,
    "revenueDeviation" DECIMAL(12,2) NOT NULL,
    "healthScore" DECIMAL(5,2) NOT NULL,
    "trend" TEXT NOT NULL DEFAULT 'STABLE',
    "anomalies" JSONB NOT NULL DEFAULT '[]',
    "faultCount" INTEGER NOT NULL DEFAULT 0,
    "weatherData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_health_history" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "activatedProjectId" TEXT NOT NULL,
    "overallScore" DECIMAL(5,2) NOT NULL,
    "investmentGrade" TEXT NOT NULL,
    "gradeRationale" TEXT NOT NULL,
    "dimensions" JSONB NOT NULL,
    "improvementActions" JSONB NOT NULL DEFAULT '[]',
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_health_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_plans" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "activatedProjectId" TEXT NOT NULL,
    "weekOf" DATE NOT NULL,
    "tasks" JSONB NOT NULL DEFAULT '[]',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "real_time_data" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "activatedProjectId" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "dataSource" TEXT NOT NULL,
    "rawData" JSONB NOT NULL,
    "parsedData" JSONB,
    "dataTimestamp" TIMESTAMP(3) NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "real_time_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_alerts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "activatedProjectId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendation" TEXT,
    "relatedData" JSONB,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "sentTo" JSONB NOT NULL DEFAULT '[]',
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "calcType" "CalcType" NOT NULL,
    "calcVersion" TEXT NOT NULL,
    "assumptionVersion" TEXT NOT NULL,
    "dataSourceVersion" TEXT NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "outputSnapshot" JSONB NOT NULL,
    "calculationTrace" JSONB NOT NULL,
    "dataEvidence" JSONB NOT NULL,
    "conclusion" JSONB NOT NULL,
    "risks" JSONB NOT NULL,
    "nextSteps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculation_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calc_version_registry" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "changelog" TEXT NOT NULL,
    "formulaDefinitions" JSONB NOT NULL,
    "status" "VersionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calc_version_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assumption_sets" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assumptions" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "applicableRegions" TEXT[],
    "status" "VersionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assumption_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_events" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "eventType" "ProjectEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "snapshotId" TEXT,
    "metadata" JSONB,
    "userId" TEXT NOT NULL,
    "importance" "EventImportance" NOT NULL DEFAULT 'NORMAL',
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_comparisons" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "comparisonType" "ComparisonType" NOT NULL,
    "leftSnapshot" JSONB NOT NULL,
    "rightSnapshot" JSONB NOT NULL,
    "differences" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "name" TEXT,
    "userId" TEXT NOT NULL,
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissions" JSONB,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "duration" INTEGER NOT NULL,
    "status" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_ownerId_key" ON "teams"("ownerId");

-- CreateIndex
CREATE INDEX "station_records_stationId_timestamp_idx" ON "station_records"("stationId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_userId_achievementId_key" ON "user_achievements"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "push_configs_userId_key" ON "push_configs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_papers_userId_paperId_key" ON "saved_papers"("userId", "paperId");

-- CreateIndex
CREATE INDEX "project_paper_recommendations_projectId_score_idx" ON "project_paper_recommendations"("projectId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "project_paper_recommendations_projectId_paperId_key" ON "project_paper_recommendations"("projectId", "paperId");

-- CreateIndex
CREATE UNIQUE INDEX "discount_codes_code_key" ON "discount_codes"("code");

-- CreateIndex
CREATE INDEX "verification_codes_phone_idx" ON "verification_codes"("phone");

-- CreateIndex
CREATE INDEX "policies_region_type_idx" ON "policies"("region", "type");

-- CreateIndex
CREATE INDEX "usage_logs_userId_date_idx" ON "usage_logs"("userId", "date");

-- CreateIndex
CREATE INDEX "quota_usage_userId_periodStart_idx" ON "quota_usage"("userId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "quota_usage_userId_type_periodStart_key" ON "quota_usage"("userId", "type", "periodStart");

-- CreateIndex
CREATE INDEX "project_timeline_projectId_createdAt_idx" ON "project_timeline"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "project_timeline_userId_createdAt_idx" ON "project_timeline"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_code_key" ON "achievements"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_detail_userId_achievementId_key" ON "user_achievements_detail"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "analytics_events_event_timestamp_idx" ON "analytics_events"("event", "timestamp");

-- CreateIndex
CREATE INDEX "analytics_events_userId_timestamp_idx" ON "analytics_events"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "analytics_events_timestamp_idx" ON "analytics_events"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_name_key" ON "feature_flags"("name");

-- CreateIndex
CREATE INDEX "audit_logs_userId_timestamp_idx" ON "audit_logs"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_timestamp_idx" ON "audit_logs"("resourceType", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_projectId_createdAt_idx" ON "audit_logs"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "activated_projects_projectId_key" ON "activated_projects"("projectId");

-- CreateIndex
CREATE INDEX "activated_projects_userId_idx" ON "activated_projects"("userId");

-- CreateIndex
CREATE INDEX "activated_projects_activationStatus_idx" ON "activated_projects"("activationStatus");

-- CreateIndex
CREATE INDEX "activated_projects_currentStage_idx" ON "activated_projects"("currentStage");

-- CreateIndex
CREATE INDEX "daily_analysis_projectId_idx" ON "daily_analysis"("projectId");

-- CreateIndex
CREATE INDEX "daily_analysis_analysisDate_idx" ON "daily_analysis"("analysisDate");

-- CreateIndex
CREATE INDEX "daily_analysis_healthScore_idx" ON "daily_analysis"("healthScore");

-- CreateIndex
CREATE INDEX "daily_analysis_pr_idx" ON "daily_analysis"("pr");

-- CreateIndex
CREATE UNIQUE INDEX "daily_analysis_projectId_analysisDate_key" ON "daily_analysis"("projectId", "analysisDate");

-- CreateIndex
CREATE INDEX "asset_health_history_projectId_idx" ON "asset_health_history"("projectId");

-- CreateIndex
CREATE INDEX "asset_health_history_investmentGrade_idx" ON "asset_health_history"("investmentGrade");

-- CreateIndex
CREATE INDEX "asset_health_history_overallScore_idx" ON "asset_health_history"("overallScore");

-- CreateIndex
CREATE INDEX "asset_health_history_assessedAt_idx" ON "asset_health_history"("assessedAt");

-- CreateIndex
CREATE INDEX "maintenance_plans_projectId_idx" ON "maintenance_plans"("projectId");

-- CreateIndex
CREATE INDEX "maintenance_plans_weekOf_idx" ON "maintenance_plans"("weekOf");

-- CreateIndex
CREATE INDEX "maintenance_plans_completed_idx" ON "maintenance_plans"("completed");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_plans_projectId_weekOf_key" ON "maintenance_plans"("projectId", "weekOf");

-- CreateIndex
CREATE INDEX "real_time_data_projectId_idx" ON "real_time_data"("projectId");

-- CreateIndex
CREATE INDEX "real_time_data_dataType_idx" ON "real_time_data"("dataType");

-- CreateIndex
CREATE INDEX "real_time_data_dataTimestamp_idx" ON "real_time_data"("dataTimestamp");

-- CreateIndex
CREATE INDEX "asset_alerts_projectId_idx" ON "asset_alerts"("projectId");

-- CreateIndex
CREATE INDEX "asset_alerts_severity_idx" ON "asset_alerts"("severity");

-- CreateIndex
CREATE INDEX "asset_alerts_status_idx" ON "asset_alerts"("status");

-- CreateIndex
CREATE INDEX "asset_alerts_createdAt_idx" ON "asset_alerts"("createdAt");

-- CreateIndex
CREATE INDEX "calculation_snapshots_userId_calcType_idx" ON "calculation_snapshots"("userId", "calcType");

-- CreateIndex
CREATE INDEX "calculation_snapshots_projectId_idx" ON "calculation_snapshots"("projectId");

-- CreateIndex
CREATE INDEX "calculation_snapshots_createdAt_idx" ON "calculation_snapshots"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "calc_version_registry_version_key" ON "calc_version_registry"("version");

-- CreateIndex
CREATE UNIQUE INDEX "assumption_sets_version_key" ON "assumption_sets"("version");

-- CreateIndex
CREATE INDEX "project_events_projectId_eventDate_idx" ON "project_events"("projectId", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE INDEX "api_logs_userId_createdAt_idx" ON "api_logs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_records" ADD CONSTRAINT "station_records_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_locations" ADD CONSTRAINT "saved_locations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculations" ADD CONSTRAINT "calculations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_papers" ADD CONSTRAINT "saved_papers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_papers" ADD CONSTRAINT "saved_papers_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "paper_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_papers" ADD CONSTRAINT "saved_papers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_paper_recommendations" ADD CONSTRAINT "project_paper_recommendations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_folders" ADD CONSTRAINT "paper_folders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_folders" ADD CONSTRAINT "paper_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "paper_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_notes" ADD CONSTRAINT "paper_notes_savedPaperId_fkey" FOREIGN KEY ("savedPaperId") REFERENCES "saved_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements_detail" ADD CONSTRAINT "user_achievements_detail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements_detail" ADD CONSTRAINT "user_achievements_detail_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activated_projects" ADD CONSTRAINT "activated_projects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activated_projects" ADD CONSTRAINT "activated_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_analysis" ADD CONSTRAINT "daily_analysis_activatedProjectId_fkey" FOREIGN KEY ("activatedProjectId") REFERENCES "activated_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_analysis" ADD CONSTRAINT "daily_analysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_health_history" ADD CONSTRAINT "asset_health_history_activatedProjectId_fkey" FOREIGN KEY ("activatedProjectId") REFERENCES "activated_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_health_history" ADD CONSTRAINT "asset_health_history_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_activatedProjectId_fkey" FOREIGN KEY ("activatedProjectId") REFERENCES "activated_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "real_time_data" ADD CONSTRAINT "real_time_data_activatedProjectId_fkey" FOREIGN KEY ("activatedProjectId") REFERENCES "activated_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "real_time_data" ADD CONSTRAINT "real_time_data_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_alerts" ADD CONSTRAINT "asset_alerts_activatedProjectId_fkey" FOREIGN KEY ("activatedProjectId") REFERENCES "activated_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_alerts" ADD CONSTRAINT "asset_alerts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "calculation_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comparisons" ADD CONSTRAINT "project_comparisons_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "calculation_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_logs" ADD CONSTRAINT "api_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

