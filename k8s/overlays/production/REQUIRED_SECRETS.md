# Production secret contract

The production overlay intentionally does not render Kubernetes `Secret`
objects. Create these resources through the deployment platform's secret
manager or an External Secrets controller before applying the workload:

- `database-secrets`: `DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`,
  `POSTGRES_PASSWORD`
- `redis-secrets`: `REDIS_URL`, `REDIS_PASSWORD`
- `rabbitmq-secrets`: `RABBITMQ_URL`, `RABBITMQ_USER`,
  `RABBITMQ_PASSWORD`, `RABBITMQ_ERLANG_COOKIE`
- `security-secrets`: `JWT_SECRET`, `ENCRYPTION_KEY`, `API_KEY`
- `external-api-secrets`: `OPENAI_API_KEY`, `PINECONE_API_KEY`,
  `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- `sso-secrets`: Google, GitHub and Microsoft client IDs and secrets
- `messaging-secrets`: SMTP, Aliyun and FCM credentials
- `monitoring-secrets`: Sentry, Datadog and Grafana credentials
- `monitoring-basic-auth`: ingress basic-auth credential

The monolithic Python backend additionally requires its production runtime
secret contract from `后端/.env.production.example`, including object storage.
Never commit real values or Base64-encoded values to this repository.
