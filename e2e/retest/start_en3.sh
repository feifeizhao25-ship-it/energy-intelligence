#!/bin/bash
# usage: start_en3.sh cn|global PORT DBFILE   (fix2 retest: current feat/energy-cjk-counter backend, own sqlite + redis db 8)
ED=$1; PORT=$2; DB=$3
export ENVIRONMENT=development APP_EDITION=$ED MARKET_REGION=$ED
export DATABASE_URL=sqlite+aiosqlite:////workspace/ui_full_test/retest/run/$DB
export REDIS_URL=redis://127.0.0.1:16379/8
export SECRET_KEY=$(python3 -c "import secrets;print(secrets.token_hex(32))")
export JWT_PRIVATE_KEY="$(cat /workspace/ui_full_test/data/jwt/priv.pem)" JWT_PUBLIC_KEY="$(cat /workspace/ui_full_test/data/jwt/pub.pem)"
export CORS_ORIGINS="*"
unset NENGJIAN_DEEPSEEK_API_KEY NENGJIAN_DASHSCOPE_API_KEY NENGJIAN_GLM_API_KEY
export DEEPSEEK_API_KEY=local-test-placeholder OPENROUTER_API_KEY=local-test-placeholder
export DEEPSEEK_BASE_URL=http://127.0.0.1:9110 OPENROUTER_BASE_URL=http://127.0.0.1:9110
export REPORTS_DIR=/workspace/ui_full_test/retest/run/reports3_$ED
mkdir -p $REPORTS_DIR
cd /workspace/fix2/en_calc/runtime/backend
exec /workspace/venv_en/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port $PORT
