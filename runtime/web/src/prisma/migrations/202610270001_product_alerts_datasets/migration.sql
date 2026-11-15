CREATE TABLE "policy_alert_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT '',
    "channelInApp" BOOLEAN NOT NULL DEFAULT true,
    "channelEmail" BOOLEAN NOT NULL DEFAULT false,
    "channelWecom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "policy_alert_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "policy_alert_subscriptions_userId_idx" ON "policy_alert_subscriptions"("userId");

ALTER TABLE "policy_alert_subscriptions" ADD CONSTRAINT "policy_alert_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "policy_alert_notices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "policy_alert_notices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "policy_alert_notices_userId_createdAt_idx" ON "policy_alert_notices"("userId", "createdAt");

ALTER TABLE "policy_alert_notices" ADD CONSTRAINT "policy_alert_notices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "dataset_downloads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dataset_downloads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dataset_downloads_userId_createdAt_idx" ON "dataset_downloads"("userId", "createdAt");

ALTER TABLE "dataset_downloads" ADD CONSTRAINT "dataset_downloads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
