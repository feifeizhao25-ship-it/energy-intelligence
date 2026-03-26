# 新能源智库 — 部署指南

## 环境要求

- Python 3.13 (建议) / 3.11+
- PostgreSQL 15+
- Node.js 18+ (可选，用于前端资源)
- Flutter 3.x SDK

## Backend 本地开发

### 1. 安装依赖
```bash
cd ~/Documents/新能源智库/backend
python3.13 -m venv .venv313
.venv313/bin/pip install -r requirements.txt
```

### 2. 配置数据库
```bash
# 创建 PostgreSQL 数据库
psql -U postgres -c "CREATE DATABASE energy_global;"
psql -U postgres -d energy_global -c "CREATE USER energy WITH PASSWORD 'energy_dev_pass';"
psql -U postgres -d energy_global -c "GRANT ALL ON SCHEMA public TO energy;"
```

### 3. 配置环境变量
```bash
cp backend/.env.example backend/.env
# 编辑 .env:
# DATABASE_URL=postgresql+asyncpg://energy:energy_dev_pass@localhost:5432/energy_global
# SECRET_KEY=your-secret-key-here
```

### 4. 启动 Backend
```bash
cd ~/Documents/新能源智库/backend
PYTHONPATH=. DATABASE_URL="postgresql+asyncpg://energy:energy_dev_pass@localhost:5432/energy_global" \
.venv313/bin/uvicorn app.main:app --host 0.0.0.0 --port 4001 --reload
```

## Backend 生产部署

### Docker
```bash
cd ~/Documents/新能源智库/backend
docker build -t energy-backend .
docker run -d -p 4001:4001 \
  -e DATABASE_URL=$DATABASE_URL \
  -e SECRET_KEY=$SECRET_KEY \
  --name energy-backend energy-backend
```

### Docker Compose (推荐)
```yaml
services:
  backend:
    build: ./backend
    ports: ["4001:4001"]
    environment:
      DATABASE_URL: postgresql+asyncpg://user:pass@postgres:5432/energy
      REDIS_URL: redis://redis:6379/0
    depends_on: [postgres, redis]
```

## Flutter App

### Android
```bash
cd ~/Documents/新能源智库/android-cn
flutter pub get
flutter build apk --release
```

### iOS
```bash
cd ~/Documents/新能源智库/ios-cn
flutter pub get
flutter build ios --release
```

## 环境变量参考

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | postgresql+asyncpg://... |
| `REDIS_URL` | Redis 连接串 | redis://localhost:6379/0 |
| `SECRET_KEY` | JWT 签名密钥 | (必填) |
| `OPENAI_API_KEY` | OpenAI API 密钥 | (可选) |
| `NASA_POWER_BASE_URL` | NASA POWER API | https://power.larc.nasa.gov/api |
