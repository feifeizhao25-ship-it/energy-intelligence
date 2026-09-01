#!/usr/bin/env bash
# 在完整、可复现的依赖环境中测试实际生产后端。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/runtime/backend"

# 生产后端使用 PEP 604 类型语法，最低需要 Python 3.10。
# 不能只检查依赖：旧 Python 恰好安装了依赖时，会在收集测试时才以
# 难以理解的 `type | None` 错误退出。版本不合格时直接走与生产一致的 Docker 环境。
if python3 -c 'import sys; assert sys.version_info >= (3, 10); import openai, anthropic, sqlalchemy, fastapi' >/dev/null 2>&1; then
  cd "$BACKEND"
  exec python3 -m pytest tests -q "$@"
fi

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "缺少 runtime/backend Python 依赖，且 Docker 不可用。" >&2
  echo "请运行: python3 -m pip install -r runtime/backend/requirements.txt" >&2
  exit 1
fi

IMAGE="energy-runtime-backend:test"
docker build --target development -t "$IMAGE" "$BACKEND"
exec docker run --rm \
  -e APP_ENV=test \
  -e ENVIRONMENT=test \
  -e DATABASE_URL=sqlite+aiosqlite:////tmp/energy_pytest.db \
  -v "$BACKEND:/app" \
  -v "$ROOT/services:/services:ro" \
  -w /app \
  "$IMAGE" python -m pytest tests -q "$@"
