COPY --from=builder --chown=node:node /workspace/网页端-国内版/.next/standalone ./
COPY --from=builder --chown=node:node /workspace/网页端-国内版/.next/static ./网页端-国内版/.next/static
COPY --from=builder --chown=node:node /workspace/网页端-国内版/public ./网页端-国内版/public

USER node

# Probe the frontend itself; backend readiness is checked independently.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/ >/dev/null || exit 1