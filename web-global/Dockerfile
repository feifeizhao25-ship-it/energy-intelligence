FROM node:20-alpine AS builder
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@8.12.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY web-global/package.json ./web-global/package.json
RUN pnpm install --frozen-lockfile --filter energy-intelligence-global...
COPY web-global ./web-global
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --dir web-global build

FROM nginx:1.27-alpine AS runtime
COPY --from=builder /workspace/web-global/out /usr/share/nginx/html
RUN printf 'server { listen 3000; server_name _; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ $uri.html =404; } location = /health { access_log off; return 200 "ok\\n"; add_header Content-Type text/plain; } add_header X-Content-Type-Options nosniff always; add_header X-Frame-Options DENY always; add_header Referrer-Policy strict-origin-when-cross-origin always; }' > /etc/nginx/conf.d/default.conf
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
