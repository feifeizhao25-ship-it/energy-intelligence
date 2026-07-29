# Energy Intelligence Platform — 后端 API

新能源项目全栈平台后端，基于 FastAPI + PostgreSQL + Redis + Celery。

## 技术栈

- **API**: FastAPI (Python 3.12, async)
- **数据库**: PostgreSQL + SQLAlchemy (async, Alembic 迁移)
- **缓存/队列**: Redis + Celery
- **AI**: OpenAI GPT-4o (流式 SSE)
- **支付**: Stripe (订阅 + webhook)
- **资源数据**: NASA POWER + Open-Meteo (真实气象数据)

## 本地开发

```bash
cd /opt/energy/backend
source .venv/bin/activate
cp .env.example .env   # 填写真实密钥
alembic upgrade head   # 执行数据库迁移
uvicorn app.main:app --reload --port 4001
```

## 生产部署

### 方式1: Systemd (当前)
```bash
systemctl start energy-backend      # API 服务
systemctl start energy-celery       # 异步任务 (Celery)
systemctl status energy-backend energy-celery
```

### 方式2: Docker Compose
```bash
cp .env.example .env.production   # 填写生产密钥
docker-compose up -d
```

### Nginx 反向代理 (生产 HTTPS)
```bash
# 复制 nginx/production.conf 到 /etc/nginx/conf.d/
# 申请 Let's Encrypt 证书
certbot --nginx -d your-domain.com
docker-compose up -d nginx
```

## 环境变量 (.env)

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql+asyncpg://user:pass@host:5432/db` |
| `REDIS_URL` | Redis 连接串 | `redis://:pass@localhost:6379/0` |
| `OPENAI_API_KEY` | OpenAI API Key | `sk-proj-...` |
| `STRIPE_SECRET_KEY` | Stripe Secret Key | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 签名密钥 | `whsec_...` |
| `SENDGRID_API_KEY` | SendGrid 邮件发送 | `SG....` |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth | `xxx.apps.googleusercontent.com` |

## API 端点

### 认证
- `POST /api/v1/auth/register` — 注册
- `POST /api/v1/auth/login` — 登录
- `POST /api/v1/auth/magic-link` — 发送魔法链接（邮件）
- `POST /api/v1/auth/magic-verify` — 验证魔法链接
- `POST /api/v1/auth/refresh` — 刷新 Token
- `POST /api/v1/auth/google` — Google OAuth

### 项目
- `GET/POST /api/v1/projects` — 列表/创建
- `GET/PUT/DELETE /api/v1/projects/{id}` — 详情/更新/删除
- `GET /api/v1/projects/{id}/summary` — 项目汇总

### 资源评估
- `POST /api/v1/resource/solar` — 太阳能资源评估（NASA POWER/Open-Meteo）
- `POST /api/v1/resource/wind` — 风能资源评估（Open-Meteo ERA5）
- `GET /api/v1/resource/{id}` — 查询已保存评估

### 财务建模
- `POST /api/v1/finance/calculate` — 单场景计算
- `POST /api/v1/finance/compare` — 多场景对比
- `GET /api/v1/finance/models/{project_id}` — 查询已保存模型
- `POST /api/v1/finance/models/{project_id}` — 保存财务模型

### 运营诊断
- `POST /api/v1/operations/diagnose/{project_id}` — 资产健康诊断
- `POST /api/v1/operations/cleaning-plan` — 最优清洗计划
- `POST /api/v1/operations/performance-metrics` — 性能指标

### AI 助手
- `POST /api/v1/ai/chat` — 流式聊天（SSE）
- `GET /api/v1/ai/suggestions/{project_id}` — 基于项目数据的AI优化建议

### 订阅计费
- `POST /api/v1/billing/create-checkout` — Stripe 结账
- `GET /api/v1/billing/subscription` — 订阅状态
- `POST /api/v1/billing/webhook` — Stripe Webhook
- `GET /api/v1/billing/portal` — 客户账单门户

### GDPR / 隐私
- `POST /api/v1/privacy/export-data` — 导出用户数据（Celery异步）
- `POST /api/v1/privacy/delete-account` — 删除账户（30天宽限期）
- `GET/PUT /api/v1/privacy/consent` — 同意书管理

### 其他
- `GET /api/v1/research/papers` — 学术论文搜索
- `GET /api/v1/health` — 健康检查
- `GET /api/v1/ready` — 就绪检查（含数据库状态）

## API 文档

- 开发环境: http://localhost:4001/docs
- Redoc: http://localhost:4001/redoc

## 测试

```bash
source .venv/bin/activate
python -m pytest tests/ -v
```

当前: **34/34 测试通过**

## 数据库迁移

```bash
alembic current              # 当前版本
alembic history             # 历史版本
alembic upgrade head        # 升级到最新
alembic migrate -m "desc"   # 创建新迁移
```

## 项目结构

```
app/
├── main.py              # FastAPI 应用入口
├── config.py            # 配置 (pydantic-settings)
├── api/v1/              # API 路由
│   ├── auth.py
│   ├── projects.py
│   ├── finance.py
│   ├── resource.py
│   ├── operations.py
│   ├── ai_assistant.py
│   ├── research.py
│   ├── billing.py
│   └── privacy.py
├── core/
│   ├── database.py      # 异步 DB 会话
│   ├── security.py      # JWT + 密码工具
│   └── dependencies.py  # 依赖注入
├── models/
│   └── database.py      # SQLAlchemy 模型
├── schemas/             # Pydantic 请求/响应模型
├── services/            # 业务逻辑
│   ├── ai_service.py
│   ├── resource_service.py
│   └── stripe_service.py
├── tasks/               # Celery 异步任务
│   ├── celery_app.py
│   └── gdpr.py
└── utils/
    └── financial_utils.py  # 财务计算工具
```

## 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| energy-backend | 4001 | FastAPI 主服务 |
| energy-celery | — | 异步任务 Worker |
| PostgreSQL | 5432 | 数据库 |
| Redis | 6379 | 缓存/消息队列 |
| nginx | 8080 | 反向代理（开发）|
