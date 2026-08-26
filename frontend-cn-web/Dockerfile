FROM node:20-alpine AS builder
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@8.12.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend-cn-web/package.json ./frontend-cn-web/package.json
RUN pnpm install --frozen-lockfile --filter energy-intelligence-cn-web...
COPY frontend-cn-web ./frontend-cn-web
RUN pnpm --dir frontend-cn-web build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN apk add --no-cache dumb-init wget \
    && addgroup -S app \
    && adduser -S app -G app
COPY --from=builder --chown=app:app /workspace/frontend-cn-web/.next/standalone ./
COPY --from=builder --chown=app:app /workspace/frontend-cn-web/.next/static ./frontend-cn-web/.next/static
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ai/AIChatPage >/dev/null || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "frontend-cn-web/server.js"]
