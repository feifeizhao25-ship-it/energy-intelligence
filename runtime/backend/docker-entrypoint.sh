#!/bin/sh
set -eu
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --log-level info --forwarded-allow-ips="${FORWARDED_ALLOW_IPS:-127.0.0.1}" --proxy-headers
