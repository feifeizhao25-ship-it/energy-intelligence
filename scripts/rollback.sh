#!/usr/bin/env bash
# 新能源智库 — 生产回滚脚本（docker compose 环境）
#
# 用法:
#   bash scripts/rollback.sh [VERSION]
#
#   VERSION   目标镜像 tag，缺省 "previous"（需确保该 tag 已推送到镜像仓库或存在于本地）。
#
# 环境变量:
#   COMPOSE_FILE       compose 文件路径（默认 runtime/docker-compose.production.yml）
#   RUN_DB_DOWNGRADE   =1 时回滚后执行 alembic downgrade -1（默认 0，不执行）
#   HEALTH_URL         外部健康检查 URL（如 https://energyiq.example.com/api/v1/health）；
#                      缺省在 backend 容器内检查 http://127.0.0.1:8000/health
#
# 健康检查失败时退出非零。
set -euo pipefail

VERSION="${1:-${VERSION:-previous}}"
COMPOSE_FILE="${COMPOSE_FILE:-runtime/docker-compose.production.yml}"
RUN_DB_DOWNGRADE="${RUN_DB_DOWNGRADE:-0}"
HEALTH_URL="${HEALTH_URL:-}"
SERVICES="backend web-cn web-int"

cd "$(dirname "$0")/.."

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

echo "[rollback] target version: $VERSION (compose: $COMPOSE_FILE)"
export IMAGE_TAG="$VERSION"

# 拉取指定 tag（失败则退回本地已有镜像）
compose pull $SERVICES || echo "[rollback] WARN: pull 失败，尝试使用本地镜像"
compose up -d $SERVICES

# 可选：数据库回退一个版本
if [ "$RUN_DB_DOWNGRADE" = "1" ]; then
  echo "[rollback] alembic downgrade -1"
  compose exec -T backend alembic downgrade -1
fi

# 健康检查（最多等 60s）
ok=0
for _ in $(seq 1 12); do
  if [ -n "$HEALTH_URL" ]; then
    curl -fsS -m 5 "$HEALTH_URL" >/dev/null 2>&1 && ok=1 && break
  else
    compose exec -T backend curl -fsS -m 5 http://127.0.0.1:8000/health >/dev/null 2>&1 && ok=1 && break
  fi
  sleep 5
done

if [ "$ok" != "1" ]; then
  echo "[rollback] ERROR: 健康检查失败" >&2
  exit 1
fi
echo "ROLLBACK_OK version=$VERSION"
