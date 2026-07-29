# ── Energy Intelligence — FastAPI Backend Dockerfile ─────────────────────────
# Multi-stage build: base → development → production

FROM python:3.12-slim AS base

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ── Development stage ──────────────────────────────────────────────────────────
FROM base AS development

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=development \
    DEBUG=true

# Install dev extras
RUN pip install --no-cache-dir \
    watchfiles \
    httpx \
    pytest \
    pytest-asyncio \
    pytest-cov \
    black \
    ruff

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "app"]

# ── Production stage ───────────────────────────────────────────────────────────
FROM base AS production

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=production \
    DEBUG=false \
    PORT=8000

# Create non-root user
RUN groupadd --gid 1001 appuser \
    && useradd --uid 1001 --gid appuser --shell /bin/bash --create-home appuser

COPY --chown=appuser:appuser . .

# Create required directories
RUN mkdir -p /app/static /app/logs \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD curl --fail --silent http://127.0.0.1:8000/health >/dev/null || exit 1

CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--log-level", "info", \
     "--forwarded-allow-ips", "*", \
     "--proxy-headers"]
