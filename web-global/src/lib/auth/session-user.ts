import type { User } from '@/types';

/** 登录接口和 /users/me 的外形不一致：有的包在 data.user 里，有的直接返回用户。 */
export function userFromPayload(body: unknown): User | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const data = record.data;
  const nested = data && typeof data === 'object'
    ? ((data as Record<string, unknown>).user ?? data)
    : null;
  const raw = (nested && typeof nested === 'object' ? nested : record) as Record<string, unknown>;
  if (raw.access_token && !raw.email && !raw.name) return null;
  if (typeof raw.id !== 'string' && typeof raw.email !== 'string' && typeof raw.name !== 'string') return null;
  if (!raw.id && !raw.email && !raw.name) return null;
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? raw.email ?? ''),
    email: String(raw.email ?? ''),
    phone: raw.phone ? String(raw.phone) : undefined,
    role: (raw.role as User['role']) || 'developer',
    company: raw.company ? String(raw.company) : undefined,
    country: raw.country ? String(raw.country) : undefined,
    timezone: String(raw.timezone ?? 'UTC'),
    language: String(raw.language ?? 'en'),
    currency: String(raw.currency ?? 'USD'),
    plan: (raw.plan as User['plan']) || 'free',
    avatarUrl: raw.avatar ? String(raw.avatar) : undefined,
    createdAt: String(raw.created_at ?? raw.createdAt ?? new Date().toISOString()),
    gdprConsent: Boolean(raw.gdprConsent ?? false),
    marketingConsent: Boolean(raw.marketingConsent ?? false),
  };
}
