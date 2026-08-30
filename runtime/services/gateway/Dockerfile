# syntax=docker/dockerfile:1
# gateway — production edge proxy image (nginx)
FROM nginx:1.27-alpine AS runtime

ENV NGINX_ENTRYPOINT_QUIET_LOGS=1

RUN addgroup -g 10001 gateway \
    && adduser -D -H -u 10001 -G gateway gateway \
    && rm -f /etc/nginx/conf.d/default.conf \
    && mkdir -p /var/cache/nginx/proxy /var/run \
    && chown -R gateway:gateway /var/cache/nginx /var/run

COPY nginx.conf /etc/nginx/nginx.conf

USER 10001:10001

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]
