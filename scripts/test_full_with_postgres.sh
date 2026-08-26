#!/usr/bin/env bash
# 新能源智库 — 后端全量测试(含 Postgres 专属用例)
# 用法: bash scripts/test_full_with_postgres.sh
# 优先级:
#   1) 已设置 TEST_DATABASE_URL: 直接复用外部测试库
#   2) 本机 initdb/pg_ctl/createdb: 启动临时本地 Postgres
#   3) Docker daemon 可用: 启动 postgres:16-alpine 临时容器
#   4) embedded-postgres: 最后兜底(部分 macOS 机器可能缺 ICU 动态库)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -d "$ROOT/runtime/backend" ]; then
  BACKEND_DIR="$ROOT/runtime/backend"
elif [ -d "$ROOT/backend" ]; then
  BACKEND_DIR="$ROOT/backend"
elif [ -d "$ROOT/后端" ]; then
  BACKEND_DIR="$ROOT/后端"
else
  echo "未找到后端目录（期望 runtime/backend/、backend/ 或 后端/）" >&2
  exit 1
fi
PGDIR="$(mktemp -d /tmp/energy-pg.XXXXXX)"
PGDATA="$PGDIR/data"
PGPORT="${PGPORT:-55432}"
DBUSER="${PGUSER:-${USER:-postgres}}"
DBNAME="${PGDATABASE:-energy_intelligence_test}"
PG_CONTAINER=""
PG_BIN=""

cleanup() {
  if [ -n "$PG_BIN" ] && [ -x "$PG_BIN/pg_ctl" ] && [ -d "$PGDATA" ]; then
    "$PG_BIN/pg_ctl" -D "$PGDATA" stop -m immediate >/dev/null 2>&1 || true
  fi
  if [ -n "$PG_CONTAINER" ]; then
    docker rm -f "$PG_CONTAINER" >/dev/null 2>&1 || true
  fi
  rm -rf "$PGDIR"
}
trap cleanup EXIT

run_pytest() {
  cd "$BACKEND_DIR"
  export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgresql+asyncpg://$DBUSER@127.0.0.1:$PGPORT/$DBNAME}"
  export SUPERUSER_DATABASE_URL="${SUPERUSER_DATABASE_URL:-$TEST_DATABASE_URL}"
  echo "==> pytest (backend, 全量)"
  echo "==> TEST_DATABASE_URL=${TEST_DATABASE_URL%%:*}:***@${TEST_DATABASE_URL#*@}"
  python3 -m pytest tests -q "$@"
}

has_local_pg() {
  command -v initdb >/dev/null 2>&1 &&
    command -v pg_ctl >/dev/null 2>&1 &&
    command -v createdb >/dev/null 2>&1
}

start_local_pg() {
  PG_BIN="$(dirname "$(command -v pg_ctl)")"
  echo "==> 使用本地 Postgres 二进制启动临时库 (port $PGPORT)"
  initdb -D "$PGDATA" -U "$DBUSER" -A trust >/dev/null
  pg_ctl -D "$PGDATA" -o "-p $PGPORT -c listen_addresses=127.0.0.1" -w start >/dev/null
  createdb -h 127.0.0.1 -p "$PGPORT" -U "$DBUSER" "$DBNAME"
}

start_docker_pg() {
  DBUSER="postgres"
  PG_CONTAINER="energy-pg-test-$$"
  echo "==> 使用 Docker 启动临时 postgres:16-alpine (port $PGPORT)"
  docker run --rm -d \
    --name "$PG_CONTAINER" \
    -e POSTGRES_HOST_AUTH_METHOD=trust \
    -e POSTGRES_DB="$DBNAME" \
    -p "127.0.0.1:$PGPORT:5432" \
    postgres:16-alpine >/dev/null

  for _ in $(seq 1 45); do
    if docker exec "$PG_CONTAINER" pg_isready -U "$DBUSER" -d "$DBNAME" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "Docker Postgres 启动超时，请检查 docker logs $PG_CONTAINER" >&2
  return 1
}

start_embedded_pg() {
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64)  local pkg="@embedded-postgres/darwin-arm64" ;;
    Darwin-x86_64) local pkg="@embedded-postgres/darwin-x64" ;;
    Linux-aarch64) local pkg="@embedded-postgres/linux-arm64" ;;
    Linux-x86_64)  local pkg="@embedded-postgres/linux-x64" ;;
    *) echo "不支持的平台"; return 1 ;;
  esac

  echo "==> 下载 $pkg 到 $PGDIR"
  (
    cd "$PGDIR"
    local tarball
    tarball=$(npm view "$pkg" dist.tarball)
    curl -sL "$tarball" -o pg.tgz
    mkdir -p dist
    tar -xzf pg.tgz -C dist --strip-components=1
  )

  PG_BIN="$(find "$PGDIR/dist" -type d -name bin | head -1)"
  [ -x "$PG_BIN/initdb" ] || { echo "initdb 未找到"; return 1; }

  export LD_LIBRARY_PATH="$PG_BIN/../lib:${LD_LIBRARY_PATH:-}"
  export DYLD_LIBRARY_PATH="$PG_BIN/../lib:${DYLD_LIBRARY_PATH:-}"

  echo "==> 使用 embedded-postgres 启动临时库 (port $PGPORT)"
  if ! "$PG_BIN/initdb" -D "$PGDATA" -U "$DBUSER" -A trust >/dev/null; then
    cat >&2 <<'EOF'
embedded-postgres 初始化失败。常见原因是 macOS 缺少 ICU 动态库。
请任选一种方式：
  1. 启动 Docker/Colima 后重跑: colima start && bash scripts/test_full_with_postgres.sh
  2. 安装本地 Postgres: brew install postgresql@16
  3. 手动提供 TEST_DATABASE_URL 后重跑。
EOF
    return 1
  fi
  "$PG_BIN/pg_ctl" -D "$PGDATA" -o "-p $PGPORT -c listen_addresses=127.0.0.1" -w start >/dev/null
  "$PG_BIN/createdb" -h 127.0.0.1 -p "$PGPORT" -U "$DBUSER" "$DBNAME"
}

if [ -n "${TEST_DATABASE_URL:-}" ]; then
  echo "==> 使用外部 TEST_DATABASE_URL"
  run_pytest "$@"
  exit 0
fi

if has_local_pg; then
  start_local_pg
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  start_docker_pg
else
  start_embedded_pg
fi

run_pytest "$@"
echo "==> 完成(临时 Postgres 已清理)"
