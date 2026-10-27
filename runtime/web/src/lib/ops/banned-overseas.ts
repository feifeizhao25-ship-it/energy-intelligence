/** 与 runtime/backend/ops/preflight.py 的 BANNED_OVERSEAS 对齐。空值不算已配置。 */
export const BANNED_OVERSEAS = [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'OPENROUTER_API_KEY',
    'OPENROUTER_BASE_URL',
    'SENTRY_DSN',
    'DATADOG_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRO_PRICE_ID',
    'STRIPE_ENTERPRISE_PRICE_ID',
    'SENDGRID_API_KEY',
    'NREL_API_KEY',
    'OPENWEATHERMAP_API_KEY',
    'OPENWEATHER_API_KEY',
    'PINECONE_API_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'APPLE_CLIENT_ID',
    'APPLE_CLIENT_SECRET',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'FCM_SERVER_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SILICONFLOW_API_KEY',
    'OPENALEX_CONTACT_EMAIL',
    'CORE_API_KEY',
    'UNPAYWALL_EMAIL',
    'SEMANTIC_SCHOLAR_API_KEY',
    'CROSSREF_MAILTO',
] as const;

export function presentOverseas(env: Record<string, string | undefined> = process.env): string[] {
    return BANNED_OVERSEAS.filter((name) => Boolean(env[name]));
}
