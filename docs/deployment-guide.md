# Energy Intelligence Platform — Deployment Guide

**Version:** 1.0.0 | **Target:** AWS (ECS Fargate + RDS + ElastiCache + CloudFront)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Development](#2-local-development)
3. [Environment Variables Reference](#3-environment-variables-reference)
4. [AWS Infrastructure Setup](#4-aws-infrastructure-setup)
5. [Database Migrations](#5-database-migrations)
6. [CI/CD Pipeline](#6-cicd-pipeline)
7. [Mobile App Distribution](#7-mobile-app-distribution)
8. [SSL/TLS Configuration](#8-ssltls-configuration)
9. [Monitoring and Logging](#9-monitoring-and-logging)
10. [Scaling Guide](#10-scaling-guide)
11. [Rollback Procedures](#11-rollback-procedures)
12. [Security Checklist](#12-security-checklist)

---

## 1. Prerequisites

### Tools Required

| Tool | Version | Install |
|------|---------|---------|
| Docker | ≥ 24.0 | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Docker Compose | ≥ 2.20 | Bundled with Docker Desktop |
| Node.js | 20 LTS | [nodejs.org](https://nodejs.org) |
| Python | 3.12 | [python.org](https://python.org) |
| Flutter | 3.24 | [flutter.dev](https://flutter.dev) |
| Terraform | ≥ 1.9 | [terraform.io](https://terraform.io) |
| AWS CLI | ≥ 2.15 | [aws.amazon.com/cli](https://aws.amazon.com/cli/) |
| Git | ≥ 2.40 | [git-scm.com](https://git-scm.com) |

### AWS Account Requirements

- IAM user with `AdministratorAccess` (for initial setup)
- Verified domain in Route 53 (or external DNS)
- ACM certificate issued for `energy.example.com` and `*.energy.example.com` in `us-east-1`

### External Services

- **Stripe** — Create account at stripe.com, get API keys from Dashboard → Developers
- **OpenAI** — API key from platform.openai.com with GPT-4o access
- **Google Cloud** — OAuth 2.0 credentials (Web Application type)
- **GitHub** — OAuth app (for GitHub login)
- **SendGrid** — API key for transactional email
- **Sentry** — DSN for error tracking (optional but recommended)

---

## 2. Local Development

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/your-org/energy-intelligence.git
cd energy-intelligence

# 2. Copy environment file
cp backend/.env.example backend/.env
# Edit backend/.env with your keys (minimum: OPENAI_API_KEY, STRIPE_SECRET_KEY)

# 3. Start all services
cd infrastructure
docker compose up -d

# 4. Run database migrations
docker compose exec backend alembic upgrade head

# 5. Verify services
curl http://localhost:8000/health     # → {"status": "ok"}
open http://localhost:3000            # Next.js frontend
open http://localhost:8080            # Adminer (DB admin)
```

### Service URLs (Local)

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | — |
| API | http://localhost:8000 | — |
| API Docs | http://localhost:8000/docs | — |
| Adminer | http://localhost:8080 | energy / energy_dev_pass |
| Redis | localhost:6379 | redis_dev_pass |

### Hot Reload

Both frontend (Next.js) and backend (uvicorn `--reload`) support hot reload automatically in the dev Docker Compose configuration.

### Running Without Docker

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in DATABASE_URL, REDIS_URL etc.
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend
cd web-global
npm install
cp .env.example .env.local  # fill in NEXT_PUBLIC_API_URL etc.
npm run dev

# Flutter (iOS)
cd ios-global
flutter pub get
flutter run
```

---

## 3. Environment Variables Reference

### Backend (`backend/.env`)

```bash
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://energy:password@localhost:5432/energy_global
REDIS_URL=redis://:password@localhost:6379/0

# ── Security ──────────────────────────────────────────────────────────────────
SECRET_KEY=<generate: openssl rand -hex 32>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# ── Application ───────────────────────────────────────────────────────────────
ENVIRONMENT=production          # development | staging | production
DEBUG=false
CORS_ORIGINS=["https://energy.example.com"]

# ── OpenAI ────────────────────────────────────────────────────────────────────
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
OPENAI_MAX_TOKENS=4096

# ── Stripe ────────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...

# ── Email ─────────────────────────────────────────────────────────────────────
SENDGRID_API_KEY=SG...
FROM_EMAIL=noreply@energy.example.com
FROM_NAME=Energy Intelligence

# ── AWS ───────────────────────────────────────────────────────────────────────
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=energy-prod-assets-xxxx

# ── OAuth ─────────────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

# ── Monitoring ────────────────────────────────────────────────────────────────
SENTRY_DSN=https://...@sentry.io/...
NASA_POWER_BASE_URL=https://power.larc.nasa.gov/api/temporal/monthly/point
```

### Frontend (`web-global/.env.local`)

```bash
NEXT_PUBLIC_API_URL=https://energy.example.com/api/v1
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# NextAuth.js
NEXTAUTH_SECRET=<generate: openssl rand -base64 32>
NEXTAUTH_URL=https://energy.example.com

# OAuth (server-side only)
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

---

## 4. AWS Infrastructure Setup

### Step 1: Bootstrap Terraform State

```bash
# Create S3 bucket for Terraform state (one-time)
aws s3 mb s3://energy-global-terraform-state --region us-east-1
aws s3api put-bucket-versioning \
  --bucket energy-global-terraform-state \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption \
  --bucket energy-global-terraform-state \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Create DynamoDB lock table
aws dynamodb create-table \
  --table-name energy-global-terraform-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### Step 2: Configure Variables

```bash
cd infrastructure/terraform

cat > terraform.tfvars << 'EOF'
aws_region    = "us-east-1"
environment   = "prod"
domain_name   = "energy.example.com"
certificate_arn = "arn:aws:acm:us-east-1:123456789:certificate/..."
rds_multi_az  = true
EOF
```

### Step 3: Apply Infrastructure

```bash
terraform init
terraform plan -var-file=terraform.tfvars -out=tfplan
terraform apply tfplan

# Record outputs
terraform output -json > terraform-outputs.json
```

### Step 4: Store Secrets in SSM Parameter Store

```bash
ENV=prod
REGION=us-east-1

# Store each secret
aws ssm put-parameter --name "/energy/$ENV/database_url" \
  --value "postgresql+asyncpg://..." --type SecureString --region $REGION

aws ssm put-parameter --name "/energy/$ENV/redis_url" \
  --value "redis://:..." --type SecureString --region $REGION

aws ssm put-parameter --name "/energy/$ENV/secret_key" \
  --value "$(openssl rand -hex 32)" --type SecureString --region $REGION

aws ssm put-parameter --name "/energy/$ENV/openai_api_key" \
  --value "sk-..." --type SecureString --region $REGION

aws ssm put-parameter --name "/energy/$ENV/stripe_secret_key" \
  --value "sk_live_..." --type SecureString --region $REGION

aws ssm put-parameter --name "/energy/$ENV/stripe_webhook_secret" \
  --value "whsec_..." --type SecureString --region $REGION

aws ssm put-parameter --name "/energy/$ENV/nextauth_secret" \
  --value "$(openssl rand -base64 32)" --type SecureString --region $REGION

aws ssm put-parameter --name "/energy/$ENV/google_client_id" \
  --value "...apps.googleusercontent.com" --type SecureString --region $REGION

aws ssm put-parameter --name "/energy/$ENV/google_client_secret" \
  --value "GOCSPX-..." --type SecureString --region $REGION

aws ssm put-parameter --name "/energy/$ENV/stripe_publishable_key" \
  --value "pk_live_..." --type SecureString --region $REGION
```

### Step 5: Configure Stripe Webhook

In Stripe Dashboard → Webhooks → Add endpoint:
- URL: `https://energy.example.com/api/v1/billing/webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`

Store the signing secret:
```bash
aws ssm put-parameter --name "/energy/$ENV/stripe_webhook_secret" \
  --value "whsec_..." --type SecureString --region $REGION
```

### Step 6: Configure DNS

After Terraform apply, point your domain to CloudFront:
```bash
# Get CloudFront domain
terraform output cloudfront_domain
# → d1234abcdef.cloudfront.net

# Create DNS record (Route 53)
aws route53 change-resource-record-sets \
  --hosted-zone-id Z... \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "energy.example.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "d1234abcdef.cloudfront.net"}]
      }
    }]
  }'
```

---

## 5. Database Migrations

### Running Migrations

```bash
# Local (via Docker Compose)
docker compose exec backend alembic upgrade head

# Production (via ECS one-off task)
aws ecs run-task \
  --cluster energy-prod \
  --task-definition energy-prod-backend \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["alembic","upgrade","head"]}]}' \
  --region us-east-1
```

### Creating New Migrations

```bash
cd backend
# Auto-generate migration from model changes
alembic revision --autogenerate -m "add_team_members_table"

# Or create empty migration
alembic revision -m "add_index_to_projects"

# Always review generated migrations before applying!
```

### Rollback

```bash
# Roll back one step
alembic downgrade -1

# Roll back to specific revision
alembic downgrade 0001_initial_schema

# View migration history
alembic history --verbose
```

---

## 6. CI/CD Pipeline

The GitHub Actions workflow at `.github/workflows/ci-cd.yml` runs automatically:

| Event | Stages |
|-------|--------|
| Pull Request to `main` | test-backend, test-frontend, test-mobile, security-scan |
| Push to `main` | All tests + build-and-push + deploy-staging |
| Manual dispatch (env=prod) | All stages + deploy-prod (requires GitHub environment approval) |

### Required GitHub Secrets

Navigate to repository → Settings → Secrets and Variables → Actions:

```
AWS_ACCOUNT_ID          = 123456789012
AWS_ACCESS_KEY_ID       = AKIA...
AWS_SECRET_ACCESS_KEY   = ...
DOMAIN                  = energy.example.com
STRIPE_PUBLISHABLE_KEY  = pk_live_...
STAGING_SUBNET_ID       = subnet-xxx
STAGING_SG_ID           = sg-xxx
PROD_SUBNET_ID          = subnet-yyy
PROD_SG_ID              = sg-yyy
SLACK_WEBHOOK_URL       = https://hooks.slack.com/...
```

### Manual Production Deploy

```bash
# Via GitHub Actions UI → Actions → CI/CD → Run workflow → environment: prod

# Or via AWS CLI (skip CI)
IMAGE_TAG=abc12345  # git SHA short
aws ecs update-service \
  --cluster energy-prod \
  --service energy-prod-backend \
  --force-new-deployment \
  --region us-east-1

aws ecs update-service \
  --cluster energy-prod \
  --service energy-prod-frontend \
  --force-new-deployment \
  --region us-east-1
```

---

## 7. Mobile App Distribution

### iOS (App Store)

```bash
cd ios-global

# Build release IPA
flutter build ipa --release \
  --export-options-plist=ios/ExportOptions.plist

# Upload to App Store Connect
xcrun altool --upload-app \
  --type ios \
  --file build/ios/ipa/*.ipa \
  --username "apple@yourcompany.com" \
  --password "@keychain:AC_PASSWORD"
```

**App Store configuration:**
- Bundle ID: `com.energyintelligence.global`
- Minimum iOS: 16.0
- Categories: Business, Finance

### Android (Google Play)

```bash
cd android-global

# Build release AAB
flutter build appbundle --release

# The AAB is at: build/app/outputs/bundle/release/app-release.aab
# Upload via Google Play Console or fastlane
```

**Play Store configuration:**
- Package name: `com.energyintelligence.global`
- Min SDK: API 24 (Android 7.0)
- Target SDK: API 34

### OTA Updates

Configure `shorebird` for Flutter OTA code push (optional):
```bash
dart pub global activate shorebird
shorebird login
shorebird release android
shorebird release ios
```

---

## 8. SSL/TLS Configuration

### AWS ACM Certificate (Recommended)

```bash
# Request certificate (must be in us-east-1 for CloudFront)
aws acm request-certificate \
  --domain-name energy.example.com \
  --subject-alternative-names "*.energy.example.com" \
  --validation-method DNS \
  --region us-east-1

# Get validation CNAME records
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:... \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[*].ResourceRecord'

# Add CNAME records to DNS, then wait for validation
aws acm wait certificate-validated \
  --certificate-arn arn:aws:acm:... \
  --region us-east-1
```

### Self-hosted Nginx (VPS deployment)

```bash
# Install Certbot
apt-get install certbot python3-certbot-nginx

# Obtain certificate
certbot certonly --standalone \
  -d energy.example.com \
  -d www.energy.example.com \
  --email admin@energy.example.com \
  --agree-tos

# Certificates stored at:
# /etc/letsencrypt/live/energy.example.com/fullchain.pem
# /etc/letsencrypt/live/energy.example.com/privkey.pem

# Auto-renewal (add to crontab)
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 9. Monitoring and Logging

### CloudWatch Dashboards

After deployment, logs are in:
- `/ecs/energy-prod/backend` — FastAPI application logs
- `/ecs/energy-prod/frontend` — Next.js logs
- `/ecs/energy-prod` — ECS cluster logs

Create a dashboard:
```bash
aws cloudwatch put-dashboard \
  --dashboard-name "EnergyIntelligence-Prod" \
  --dashboard-body file://infrastructure/cloudwatch-dashboard.json
```

### Sentry Error Tracking

1. Create project at sentry.io
2. Add `SENTRY_DSN` to SSM Parameter Store
3. Errors auto-capture with stack traces and user context

### Uptime Monitoring

Recommended: AWS Route 53 Health Checks or external tools (Better Uptime, PagerDuty):

```bash
aws route53 create-health-check \
  --caller-reference "energy-prod-$(date +%s)" \
  --health-check-config '{
    "FullyQualifiedDomainName": "energy.example.com",
    "Port": 443,
    "Type": "HTTPS",
    "ResourcePath": "/health",
    "RequestInterval": 30,
    "FailureThreshold": 3
  }'
```

### Performance Metrics

FastAPI exposes Prometheus metrics at `/metrics` (internal only):
```bash
# Scrape with Prometheus (optional)
curl http://backend:8000/metrics
```

---

## 10. Scaling Guide

### Backend Scaling

```bash
# Scale ECS service manually
aws ecs update-service \
  --cluster energy-prod \
  --service energy-prod-backend \
  --desired-count 4 \
  --region us-east-1

# Auto-scaling is configured in Terraform:
# - Min: 2 tasks
# - Max: 10 tasks
# - Scale out at 70% CPU
# - Scale in cooldown: 5 minutes
```

### Database Scaling

```bash
# Upgrade RDS instance class (requires brief downtime)
aws rds modify-db-instance \
  --db-instance-identifier energy-prod \
  --db-instance-class db.r6g.large \
  --apply-immediately

# Read replicas are provisioned via Terraform (prod only)
```

### Connection Pooling

The backend uses SQLAlchemy connection pooling. For high traffic, add PgBouncer:

```yaml
# Add to docker-compose.prod.yml
pgbouncer:
  image: pgbouncer/pgbouncer:1.22
  environment:
    DATABASES_HOST: postgres
    DATABASES_PORT: 5432
    DATABASES_DBNAME: energy_global
    PGBOUNCER_POOL_MODE: transaction
    PGBOUNCER_MAX_CLIENT_CONN: 1000
    PGBOUNCER_DEFAULT_POOL_SIZE: 20
```

---

## 11. Rollback Procedures

### Application Rollback

```bash
# Find previous task definition revision
aws ecs describe-task-definition \
  --task-definition energy-prod-backend \
  --region us-east-1

# Roll back to previous revision
aws ecs update-service \
  --cluster energy-prod \
  --service energy-prod-backend \
  --task-definition energy-prod-backend:PREVIOUS_REVISION \
  --region us-east-1
```

### Database Rollback

```bash
# Roll back last migration
docker compose exec backend alembic downgrade -1

# Or restore from RDS snapshot
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier energy-prod \
  --target-db-instance-identifier energy-prod-restored \
  --restore-time 2024-01-01T12:00:00Z
```

### Frontend Rollback

```bash
# Re-deploy previous ECR image
IMAGE_TAG=abc12345  # previous SHA
aws ecs update-service \
  --cluster energy-prod \
  --service energy-prod-frontend \
  --task-definition energy-prod-frontend:PREVIOUS_REVISION \
  --region us-east-1
```

---

## 12. Security Checklist

Before going to production, verify:

### Authentication & Authorization
- [ ] JWT secret is ≥ 32 random bytes
- [ ] Access tokens expire in ≤ 1 hour
- [ ] Refresh token rotation enabled
- [ ] Google OAuth redirect URIs restricted to production domain
- [ ] GitHub OAuth callback URL set to production

### Stripe
- [ ] Using live mode keys (not test)
- [ ] Webhook signature verification enabled
- [ ] Webhook endpoint is HTTPS only

### Infrastructure
- [ ] RDS not publicly accessible
- [ ] ElastiCache not publicly accessible
- [ ] S3 bucket public access blocked
- [ ] VPC private subnets used for ECS tasks
- [ ] Security groups follow least privilege

### Application
- [ ] Debug mode disabled in production
- [ ] CORS origins restricted to production domain
- [ ] CSP headers configured in Nginx
- [ ] Rate limiting active on all API routes
- [ ] Input validation on all endpoints (Pydantic v2)
- [ ] SQL injection prevention (SQLAlchemy parameterized queries)
- [ ] GDPR consent recorded before analytics

### Monitoring
- [ ] Sentry DSN configured
- [ ] CloudWatch alarms for CPU, memory, error rates
- [ ] Uptime monitoring configured
- [ ] Database backup retention ≥ 7 days
- [ ] Log retention configured

### GDPR
- [ ] Cookie consent banner active (CookieConsent.tsx)
- [ ] `/privacy/export-data` endpoint tested
- [ ] `/privacy/delete-account` endpoint tested
- [ ] Privacy policy published at `/privacy`
- [ ] Terms of service published at `/terms`

---

## Appendix: Useful Commands

```bash
# View running ECS tasks
aws ecs list-tasks --cluster energy-prod --region us-east-1

# Execute command in running container (ECS Exec)
aws ecs execute-command \
  --cluster energy-prod \
  --task <task-id> \
  --container backend \
  --interactive \
  --command "/bin/bash"

# View backend logs (last 100 lines)
aws logs get-log-events \
  --log-group-name /ecs/energy-prod/backend \
  --log-stream-name backend/backend/<task-id> \
  --limit 100

# Database connection (via SSM tunnel)
aws ssm start-session \
  --target <ec2-bastion-id> \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["energy-prod.cluster-xxx.us-east-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5432"]}'
# Then: psql -h localhost -U energy -d energy_global

# Check Stripe events
stripe events list --limit 10

# Test AI endpoint locally
curl -N -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"message": "What is the current LCOE for solar in the US?"}' \
  http://localhost:8000/api/v1/ai/chat
```
