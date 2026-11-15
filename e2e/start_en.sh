#!/bin/bash
# usage: start_en.sh cn|global PORT DB
ED=$1; PORT=$2; DB=$3
export ENVIRONMENT=development APP_EDITION=$ED MARKET_REGION=$ED
export DATABASE_URL=postgresql+asyncpg://pg@127.0.0.1:5433/$DB
export REDIS_URL=redis://127.0.0.1:16379/1
export SECRET_KEY=$(python3 -c "import secrets;print(secrets.token_hex(32))")
export JWT_PRIVATE_KEY="$(cat /workspace/ui_full_test/data/jwt/priv.pem)" JWT_PUBLIC_KEY="$(cat /workspace/ui_full_test/data/jwt/pub.pem)"
export CORS_ORIGINS="*"
unset NENGJIAN_DEEPSEEK_API_KEY NENGJIAN_DASHSCOPE_API_KEY NENGJIAN_GLM_API_KEY
export DEEPSEEK_API_KEY=local-test-placeholder DEEPSEEK_BASE_URL=http://127.0.0.1:9110
export OPENROUTER_API_KEY=local-test-placeholder OPENROUTER_BASE_URL=http://127.0.0.1:9110
export DEEPSEEK_BASE_URL=http://127.0.0.1:9110 OPENROUTER_BASE_URL=http://127.0.0.1:9110
cd /workspace/ui_full_test/src/energy/runtime/backend
exec /workspace/venv_en/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port $PORT
