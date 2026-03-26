# Energy Intelligence Platform — Database Schema

**Database:** PostgreSQL 16 | **ORM:** SQLAlchemy 2.0 (async) | **Migrations:** Alembic

---

## Entity Relationship Overview

```
users
├── projects (1:N)
│   ├── resource_assessments (1:N)
│   ├── financial_models (1:N)
│   └── alerts (1:N)
├── resource_assessments (1:N, without project)
├── financial_models (1:N, without project)
├── ai_sessions (1:N)
├── consent_records (1:1)
├── subscriptions (1:1)
└── team_members (owner M:N member)
```

---

## Tables

### `users`
Primary user accounts table.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Unique user ID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Login email |
| hashed_password | VARCHAR(255) | NULLABLE | Null for OAuth-only users |
| name | VARCHAR(255) | NOT NULL | Display name |
| company | VARCHAR(255) | NULLABLE | Company/organization |
| country | CHAR(2) | NULLABLE | ISO 3166-1 alpha-2 country code |
| role | VARCHAR(50) | DEFAULT 'viewer' | admin, editor, viewer |
| plan | VARCHAR(20) | DEFAULT 'free' | free, pro, enterprise |
| currency | CHAR(3) | DEFAULT 'USD' | ISO 4217 currency code |
| timezone | VARCHAR(64) | DEFAULT 'UTC' | IANA timezone name |
| locale | VARCHAR(10) | DEFAULT 'en' | BCP 47 language tag |
| is_active | BOOLEAN | DEFAULT true | Account enabled/disabled |
| is_verified | BOOLEAN | DEFAULT false | Email verified |
| stripe_customer_id | VARCHAR(255) | NULLABLE, INDEXED | Stripe cus_xxx |
| stripe_subscription_id | VARCHAR(255) | NULLABLE | Stripe sub_xxx |
| google_id | VARCHAR(255) | NULLABLE | Google OAuth sub claim |
| github_id | VARCHAR(255) | NULLABLE | GitHub user ID |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Registration time |
| updated_at | TIMESTAMPTZ | AUTO | Auto-updated by trigger |
| last_login_at | TIMESTAMPTZ | NULLABLE | Last successful login |

**Indexes:** `idx_users_email`, `idx_users_stripe_customer` (partial, where NOT NULL)

---

### `projects`
Renewable energy projects owned by users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Project ID |
| user_id | UUID | FK → users(id) CASCADE | Owner |
| name | VARCHAR(255) | NOT NULL | Project name |
| type | VARCHAR(20) | CHECK (solar\|wind\|storage\|hybrid) | Technology type |
| status | VARCHAR(20) | DEFAULT 'development' | development\|construction\|operating\|decommissioned |
| location_address | VARCHAR(500) | NULLABLE | Human-readable address |
| location_country | CHAR(2) | NULLABLE | ISO country code |
| capacity | NUMERIC(10,2) | NULLABLE | Installed capacity (MW) |
| lat | NUMERIC(10,6) | NULLABLE | WGS84 latitude |
| lng | NUMERIC(10,6) | NULLABLE | WGS84 longitude |
| start_date | DATE | NULLABLE | Commercial operation date |
| budget | NUMERIC(18,2) | NULLABLE | Total project budget |
| currency | CHAR(3) | DEFAULT 'USD' | Budget currency |
| tags | TEXT[] | DEFAULT '{}' | Searchable tag array |
| metadata | JSONB | DEFAULT '{}' | Flexible extra data |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTO | |

**Indexes:** `idx_projects_user_id`, `idx_projects_type`, `idx_projects_status`

---

### `resource_assessments`
Solar and wind resource data from external APIs (NASA POWER, ERA5).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| project_id | UUID | FK → projects(id) SET NULL | Optional link |
| user_id | UUID | FK → users(id) CASCADE | |
| type | VARCHAR(10) | CHECK (solar\|wind) | |
| lat | NUMERIC(10,6) | NOT NULL | WGS84 |
| lng | NUMERIC(10,6) | NOT NULL | WGS84 |
| resource_class | VARCHAR(5) | NULLABLE | I, II, III, or IV |
| score | NUMERIC(5,2) | NULLABLE | 0–100 composite score |
| data | JSONB | NOT NULL | Full assessment payload |
| data_source | VARCHAR(50) | DEFAULT 'NASA_POWER' | Data origin |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Resource Classification (Solar GHI kWh/m²/yr):**
- Class I: > 2000
- Class II: 1600–2000
- Class III: 1200–1600
- Class IV: < 1200

**`data` JSONB structure (solar):**
```json
{
  "ghi": 2187.4,
  "dni": 1943.2,
  "dhi": 412.8,
  "peak_sun_hours": 5.99,
  "optimal_tilt": 27,
  "avg_temperature": 21.3,
  "monthly_ghi": [142, 165, 201, 228, 247, 265, 259, 242, 208, 175, 143, 132]
}
```

---

### `financial_models`
Saved financial model results (IRR, NPV, LCOE, cashflows).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| project_id | UUID | FK → projects(id) SET NULL | |
| user_id | UUID | FK → users(id) CASCADE | |
| type | VARCHAR(20) | NOT NULL | solar, wind, storage |
| inputs | JSONB | NOT NULL | Input parameters |
| results | JSONB | NOT NULL | Full results including cashflows |
| irr | NUMERIC(8,4) | NULLABLE | IRR as decimal (0.147 = 14.7%) |
| npv | NUMERIC(18,2) | NULLABLE | NPV in USD |
| lcoe | NUMERIC(10,4) | NULLABLE | LCOE in USD/MWh |
| payback | NUMERIC(6,2) | NULLABLE | Payback period (years) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

---

### `consent_records`
GDPR cookie/data consent tracking (one record per user, updated in place).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| user_id | UUID | FK → users(id) CASCADE | |
| analytics | BOOLEAN | DEFAULT false | Analytics cookies consent |
| marketing | BOOLEAN | DEFAULT false | Marketing cookies consent |
| ip_address | INET | NULLABLE | IP at time of consent |
| user_agent | TEXT | NULLABLE | Browser at time of consent |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | First consent |
| updated_at | TIMESTAMPTZ | AUTO | Last consent change |

---

### `alerts`
System-generated operational alerts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| user_id | UUID | FK → users(id) CASCADE | Alert recipient |
| project_id | UUID | FK → projects(id) SET NULL | Related project |
| title | VARCHAR(255) | NOT NULL | Short title |
| message | TEXT | NULLABLE | Full alert message |
| severity | VARCHAR(20) | CHECK (info\|warning\|critical) | |
| is_read | BOOLEAN | DEFAULT false | Read status |
| metadata | JSONB | DEFAULT '{}' | Extra context |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_alerts_user_id`, `idx_alerts_is_read` (composite: user_id, is_read)

---

### `ai_sessions`
AI chat conversation history.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| user_id | UUID | FK → users(id) CASCADE | |
| title | VARCHAR(255) | NULLABLE | Auto-generated from first message |
| messages | JSONB | NOT NULL, DEFAULT '[]' | Message array |
| token_count | INTEGER | DEFAULT 0 | Cumulative tokens used |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTO | |

**`messages` JSONB structure:**
```json
[
  {
    "role": "user",
    "content": "What is the LCOE for solar in Nevada?",
    "timestamp": "2024-01-15T10:30:00Z"
  },
  {
    "role": "assistant",
    "content": "Based on current data, LCOE for utility-scale solar in Nevada...",
    "timestamp": "2024-01-15T10:30:02Z",
    "tokens": 142
  }
]
```

---

### `subscriptions`
Stripe subscription cache (updated via webhook).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| user_id | UUID | FK → users(id) CASCADE | |
| stripe_subscription_id | VARCHAR(255) | UNIQUE, NULLABLE | Stripe sub_xxx |
| plan | VARCHAR(20) | NOT NULL | free, pro, enterprise |
| status | VARCHAR(30) | NOT NULL | active, past_due, canceled, trialing |
| current_period_start | TIMESTAMPTZ | NULLABLE | Billing period start |
| current_period_end | TIMESTAMPTZ | NULLABLE | Billing period end |
| cancel_at_period_end | BOOLEAN | DEFAULT false | Cancellation scheduled |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTO | |

---

### `team_members`
Many-to-many relationship for team/organization access control.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| owner_id | UUID | FK → users(id) CASCADE | Team owner |
| member_id | UUID | FK → users(id) CASCADE | Team member |
| role | VARCHAR(20) | CHECK (admin\|editor\|viewer) | Member's role |
| invited_at | TIMESTAMPTZ | DEFAULT NOW() | |
| accepted_at | TIMESTAMPTZ | NULLABLE | NULL = pending |

**Unique constraint:** `(owner_id, member_id)`

---

## Triggers

### `update_updated_at_column()`
Automatically updates `updated_at` before any UPDATE operation.

Applied to: `users`, `projects`, `consent_records`, `ai_sessions`, `subscriptions`

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';
```

---

## Extensions

| Extension | Purpose |
|-----------|---------|
| `uuid-ossp` | `uuid_generate_v4()` for primary keys |
| `pg_trgm` | Trigram indexes for text search |
| `pg_stat_statements` | Query performance monitoring |

---

## Common Queries

```sql
-- Active projects by type for a user
SELECT type, COUNT(*), SUM(capacity) as total_mw
FROM projects
WHERE user_id = $1 AND status = 'operating'
GROUP BY type;

-- Portfolio health overview
SELECT p.name, p.capacity, p.type,
       (SELECT data->>'score' FROM resource_assessments
        WHERE project_id = p.id ORDER BY created_at DESC LIMIT 1) as resource_score
FROM projects p
WHERE p.user_id = $1;

-- Unread critical alerts
SELECT * FROM alerts
WHERE user_id = $1 AND is_read = false AND severity = 'critical'
ORDER BY created_at DESC;

-- User's AI token usage this month
SELECT SUM(token_count) as total_tokens
FROM ai_sessions
WHERE user_id = $1
  AND created_at >= date_trunc('month', NOW());

-- Financial model history for project
SELECT irr, npv, lcoe, payback, created_at
FROM financial_models
WHERE project_id = $1
ORDER BY created_at DESC
LIMIT 10;
```

---

## Data Retention Policy

| Table | Retention | Notes |
|-------|-----------|-------|
| users | Indefinite (until delete request) | GDPR right to erasure |
| projects | Indefinite | Deleted with user |
| resource_assessments | 2 years | Compressed after 6 months |
| financial_models | 5 years | Regulatory requirement |
| ai_sessions | 90 days | Configurable per user |
| alerts | 180 days | Auto-deleted after read + 30 days |
| consent_records | 7 years | GDPR audit requirement |
| subscriptions | 7 years | Financial/tax records |

GDPR deletion cascade: When a user invokes the right to erasure (`DELETE /privacy/delete-account`), all data with `ON DELETE CASCADE` foreign keys is automatically removed.
