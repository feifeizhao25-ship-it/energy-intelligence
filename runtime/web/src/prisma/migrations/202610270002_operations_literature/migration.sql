CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assignee" TEXT,
    "dueAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "work_orders_projectId_status_idx" ON "work_orders"("projectId", "status");
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "work_order_attachments" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_order_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "work_order_attachments_workOrderId_idx" ON "work_order_attachments"("workOrderId");
ALTER TABLE "work_order_attachments" ADD CONSTRAINT "work_order_attachments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "work_order_events" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_order_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "work_order_events_workOrderId_createdAt_idx" ON "work_order_events"("workOrderId", "createdAt");
ALTER TABLE "work_order_events" ADD CONSTRAINT "work_order_events_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "telemetry_credentials" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "telemetry_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "telemetry_credentials_tokenHash_key" ON "telemetry_credentials"("tokenHash");
CREATE INDEX "telemetry_credentials_projectId_idx" ON "telemetry_credentials"("projectId");
ALTER TABLE "telemetry_credentials" ADD CONSTRAINT "telemetry_credentials_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "telemetry_samples" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "powerKw" DOUBLE PRECISION,
    "energyKwh" DOUBLE PRECISION,
    "irradiance" DOUBLE PRECISION,
    "alarmCode" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telemetry_samples_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "telemetry_samples_projectId_recordedAt_idx" ON "telemetry_samples"("projectId", "recordedAt");
ALTER TABLE "telemetry_samples" ADD CONSTRAINT "telemetry_samples_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "alarm_rules" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alarm_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alarm_rules_projectId_idx" ON "alarm_rules"("projectId");
ALTER TABLE "alarm_rules" ADD CONSTRAINT "alarm_rules_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "alarm_events" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ruleId" TEXT,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "observed" DOUBLE PRECISION,
    "threshold" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    CONSTRAINT "alarm_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alarm_events_projectId_status_idx" ON "alarm_events"("projectId", "status");
ALTER TABLE "alarm_events" ADD CONSTRAINT "alarm_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "literature_records" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT NOT NULL DEFAULT '',
    "year" INTEGER,
    "doi" TEXT,
    "abstract" TEXT NOT NULL DEFAULT '',
    "pdfUrl" TEXT,
    "licence" TEXT NOT NULL DEFAULT '',
    "licenceNote" TEXT NOT NULL DEFAULT '',
    "citations" JSONB NOT NULL DEFAULT '[]',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "literature_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "literature_records_source_externalId_key" ON "literature_records"("source", "externalId");
CREATE INDEX "literature_records_userId_idx" ON "literature_records"("userId");
ALTER TABLE "literature_records" ADD CONSTRAINT "literature_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
