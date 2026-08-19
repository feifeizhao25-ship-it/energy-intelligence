#!/usr/bin/env bash
# 新能源智库 — 上线前最终验收(一条命令跑完全部未盖章项)
# 用法: bash scripts/verify_release_readiness.sh [--with-flutter]
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
PASS=(); FAIL=()
step() { echo; echo "════ $1 ════"; }
mark() { if [ "$2" -eq 0 ]; then PASS+=("$1"); else FAIL+=("$1"); fi }

step "1/5 pnpm install + Prisma Client"
pnpm install && pnpm --dir 后端API db:generate
mark "pnpm install + prisma generate" $?

step "2/5 国内版生产构建 (typecheck 强制)"
( cd frontend-cn-web && npx next build ); mark "cn-web build" $?

step "3/5 国际版生产构建 (静态导出)"
( cd web-global && npx next build ); mark "web-global build" $?

step "3.5/5 语言隔离检查 (国内版中文/国际版英文)"
python3 scripts/verify_language_isolation.py; mark "language isolation" $?

step "4/5 后端全量测试 (临时 Postgres, 无需安装)"
bash scripts/test_full_with_postgres.sh; mark "backend pytest (postgres)" $?

if [ "${1:-}" = "--with-flutter" ]; then
  step "5/5 Flutter 首次真实编译 (android-cn)"
  ( cd android-cn && flutter pub get && flutter analyze && \
    flutter build appbundle --release --dart-define=API_BASE_URL=https://api.example.com )
  mark "flutter build (android-cn)" $?
else
  echo; echo "(跳过 Flutter — 加 --with-flutter 启用)"
fi

echo; echo "══════════ 结果 ══════════"
for p in "${PASS[@]:-}"; do [ -n "$p" ] && echo "✅ $p"; done
for f in "${FAIL[@]:-}"; do [ -n "$f" ] && echo "❌ $f"; done
[ ${#FAIL[@]} -eq 0 ] && echo "🎉 新能源智库代码层全部验收通过" || exit 1
