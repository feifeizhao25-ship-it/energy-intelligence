#!/bin/bash
# ============================================
# Core Function Validation Script
# ============================================
# 30 分钟验证新能源智库核心功能是否可用
#
# 前置要求:
#   - Docker + Docker Compose
#   - Python 3.13+ (backend)
#   - Node.js 20 + pnpm (web-cn, 可选)
#
# 用法:
#   ./scripts/validate-core-functions.sh
#
# 测试流程:
#   1. 启动 PostgreSQL + Redis
#   2. 初始化数据库 (alembic upgrade head)
#   3. 启动后端 API
#   4. 导入测试数据
#   5. 运行核心功能 smoke tests (curl)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
STEP=0

log_step() {
    STEP=$((STEP+1))
    echo ""
    echo "========================================"
    echo -e "${BLUE}Step $STEP: $1${NC}"
    echo "========================================"
}

log_pass() { echo -e "${GREEN}✅ $1${NC}"; }
log_fail() { echo -e "${RED}❌ $1${NC}"; ERRORS=$((ERRORS+1)); }
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# ── Step 1: 检查依赖 ─────────────────────────────────────────────────────

check_dependencies() {
    log_step "检查依赖"

    if ! command -v docker &> /dev/null; then
        log_fail "Docker 未安装。请安装 Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! command -v python3 &> /dev/null; then
        log_fail "Python 3 未安装"
        exit 1
    fi

    if ! command -v curl &> /dev/null; then
        log_fail "curl 未安装"
        exit 1
    fi

    log_pass "所有依赖已安装"
}

# ── Step 2: 启动基础设施 ─────────────────────────────────────────────────

start_infra() {
    log_step "启动 PostgreSQL + Redis"

    cd "$PROJECT_ROOT"

    if docker compose -f docker-compose.staging.yml ps | grep -q "eip_staging_postgres"; then
        log_warn "PostgreSQL 已在运行，跳过启动"
    else
        docker compose -f docker-compose.staging.yml up -d postgres redis
        log_info "等待服务就绪 (约 10s)..."
        sleep 10
    fi

    # 健康检查
    if docker compose -f docker-compose.staging.yml ps | grep -q "healthy"; then
        log_pass "PostgreSQL + Redis 已就绪"
    else
        log_warn "服务可能尚未完全就绪，继续执行..."
    fi
}

# ── Step 3: 初始化数据库 ─────────────────────────────────────────────────

init_database() {
    log_step "初始化数据库 (alembic upgrade head)"

    cd "$BACKEND_DIR"

    # 复制 staging 环境变量
    if [[ ! -f ".env" ]]; then
        cp "$PROJECT_ROOT/.env.staging" .env
        log_info "已复制 .env.staging 到 backend/.env"
    fi

    # 检查 Python 虚拟环境
    if [[ ! -d ".venv" && ! -d ".venv313" ]]; then
        log_info "创建 Python 虚拟环境..."
        python3 -m venv .venv
        source .venv/bin/activate
        pip install -r requirements.txt -q
    else
        if [[ -d ".venv313" ]]; then
            source .venv313/bin/activate
        else
            source .venv/bin/activate
        fi
    fi

    # 运行 migration
    log_info "运行 alembic upgrade head..."
    if alembic upgrade head; then
        log_pass "数据库 migration 成功"
    else
        log_fail "数据库 migration 失败"
        return 1
    fi

    # 验证
    local version
    version=$(python3 -c "
import asyncio
from app.database import async_engine
from sqlalchemy import text
async def check():
    async with async_engine.connect() as conn:
        result = await conn.execute(text('SELECT version_num FROM alembic_version'))
        return result.scalar()
print(asyncio.run(check()))
" 2>/dev/null || echo "unknown")
    log_info "当前 Alembic version: $version"
}

# ── Step 4: 导入测试数据 ─────────────────────────────────────────────────

seed_data() {
    log_step "导入测试数据"

    cd "$BACKEND_DIR"
    source .venv/bin/activate 2>/dev/null || source .venv313/bin/activate 2>/dev/null

    if python3 scripts/seed_test_data.py; then
        log_pass "测试数据导入成功"
    else
        log_warn "测试数据导入失败或脚本不存在，跳过（不影响核心测试）"
    fi
}

# ── Step 5: 启动后端 API ─────────────────────────────────────────────────

start_backend() {
    log_step "启动后端 API"

    cd "$BACKEND_DIR"
    source .venv/bin/activate 2>/dev/null || source .venv313/bin/activate 2>/dev/null

    # 检查端口占用
    if lsof -i :8000 &> /dev/null; then
        log_warn "端口 8000 已被占用，尝试复用现有进程"
    else
        log_info "启动 uvicorn (后台运行)..."
        nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > "$PROJECT_ROOT/backend_staging.log" 2>&1 &
        echo $! > "$PROJECT_ROOT/backend.pid"
        log_info "等待 API 就绪 (约 5s)..."
        sleep 5
    fi

    # 健康检查
    local retries=0
    while [[ $retries -lt 10 ]]; do
        if curl -s http://localhost:8000/health | grep -q "healthy"; then
            log_pass "后端 API 已就绪 (http://localhost:8000)"
            return 0
        fi
        retries=$((retries+1))
        sleep 2
    done

    log_fail "后端 API 启动失败，请检查 $PROJECT_ROOT/backend_staging.log"
    return 1
}

# ── Step 6: 运行核心功能 Smoke Tests ─────────────────────────────────────

run_smoke_tests() {
    log_step "运行核心功能 Smoke Tests"

    cd "$PROJECT_ROOT"
    bash scripts/core-smoke-tests.sh
}

# ── Step 7: 汇总结果 ─────────────────────────────────────────────────────

print_summary() {
    echo ""
    echo "========================================"
    echo "  验证完成"
    echo "========================================"

    if [[ $ERRORS -eq 0 ]]; then
        echo -e "${GREEN}✅ 所有核心功能验证通过！${NC}"
        echo ""
        echo "服务地址:"
        echo "  API:       http://localhost:8000"
        echo "  Health:    http://localhost:8000/health"
        echo "  Docs:      http://localhost:8000/docs"
        echo "  Metrics:   http://localhost:8000/metrics"
        echo ""
        echo "停止服务:"
        echo "  ./scripts/stop-staging.sh"
        echo "========================================"
        exit 0
    else
        echo -e "${RED}❌ $ERRORS 项验证失败${NC}"
        echo ""
        echo "排查建议:"
        echo "  1. 查看后端日志: tail -f backend_staging.log"
        echo "  2. 检查数据库: docker exec -it eip_staging_postgres psql -U energy -d energy_staging"
        echo "  3. 检查 Redis: docker exec -it eip_staging_postgres redis-cli ping"
        echo "========================================"
        exit 1
    fi
}

# ── Main ─────────────────────────────────────────────────────────────────

main() {
    echo "========================================"
    echo "  新能源智库 — 核心功能 30 分钟验证"
    echo "========================================"

    check_dependencies
    start_infra
    init_database
    seed_data
    start_backend
    run_smoke_tests
    print_summary
}

main "$@"
