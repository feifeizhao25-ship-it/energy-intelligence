#!/usr/bin/env bash
# 新能源智库国内版 — 规范生产源一键发布门
# 用法: bash scripts/verify_release_readiness.sh [--with-flutter]
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
PASS=(); FAIL=()
step() { echo; echo "════ $1 ════"; }
mark() { if [ "$2" -eq 0 ]; then PASS+=("$1"); else FAIL+=("$1"); fi }

step "1/5 国内网站依赖与生产构建"
( cd runtime/web && pnpm install --frozen-lockfile --offline && pnpm build )
mark "runtime/web production build" $?

step "2/5 国内后端测试"
bash scripts/test_runtime_backend.sh
mark "runtime/backend pytest" $?

step "3/5 生产代码、Compose 与 Kubernetes 配置"
python3 scripts/verify_production_code.py && \
  python3 scripts/verify_compose_production.py && \
  python3 scripts/verify_k8s_production.py
mark "production deployment gates" $?

step "4/5 国内中文隔离"
python3 scripts/verify_language_isolation.py
mark "language isolation" $?

if [ "${1:-}" = "--with-flutter" ]; then
  step "5/5 国内 Android 发布构建"
  if [ -z "${API_BASE_URL:-}" ] || printf '%s' "$API_BASE_URL" | grep -Eq 'example\.(com|invalid)|localhost|127\.0\.0\.1'; then
    echo "必须通过 API_BASE_URL 传入真实的 HTTPS 生产 API 地址" >&2
    mark "android-cn appbundle" 1
  else
  ( cd android-cn && flutter pub get && flutter build appbundle --release \
      --dart-define=API_BASE_URL="$API_BASE_URL" )
  mark "android-cn appbundle" $?
  fi
else
  echo; echo "(跳过 Flutter；传入 --with-flutter 可执行 Android 发布构建)"
fi

echo; echo "══════════ 国内版结果 ══════════"
for p in "${PASS[@]:-}"; do [ -n "$p" ] && echo "✅ $p"; done
for f in "${FAIL[@]:-}"; do [ -n "$f" ] && echo "❌ $f"; done
[ ${#FAIL[@]} -eq 0 ] && echo "🎉 新能源智库国内版代码发布门通过" || exit 1
