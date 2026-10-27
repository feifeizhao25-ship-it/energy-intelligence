/** 审计 7-5：引用卡核验状态（与后端 app/services/evidence_envelope.py 规则一致）。 */
export type VerificationStatus = 'verified' | 'review_recommended' | 'unverified' | 'conflict';

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  verified: '已核验',
  review_recommended: '待核验',
  unverified: '待核验',
  conflict: '冲突',
};

export interface EvidenceVerification {
  status: VerificationStatus;
  label?: string;
  reason?: string;
  usable_as_conclusion?: boolean;
}

/** 未知或缺失的状态一律按“待核验”处理，绝不默认成“已核验” */
export function verificationView(v?: Partial<EvidenceVerification> | null) {
  const status: VerificationStatus = v?.status && v.status in VERIFICATION_LABELS ? v.status : 'unverified';
  return {
    status,
    label: VERIFICATION_LABELS[status],
    reason: v?.reason ?? (status === 'unverified' ? '未提供核验信息' : ''),
    usableAsConclusion: status === 'verified',
    tone: status === 'verified' ? 'ok' : status === 'conflict' ? 'danger' : 'warn',
  } as const;
}

// ---------------------------------------------------------------------------
// 与后端 evidence_envelope.verify_policy_claim 相同的规则，用于 web /api/chat
// ---------------------------------------------------------------------------
export interface EvidenceSource {
  title?: string;
  url?: string;
  publisher?: string;
  type?: string;
  tool?: string;
}

const OFFICIAL_TYPES = new Set(['official', 'policy_original', 'government', 'regulator', 'standard']);
const OFFICIAL_MARKERS = ['国务院', '发改委', '发展改革委', '能源局', '生态环境部', '统计局', '工信部', '财政部', '人民政府', '电网'];

export function isOfficialSource(s: EvidenceSource): boolean {
  if (s.type && OFFICIAL_TYPES.has(s.type.toLowerCase())) return true;
  const url = (s.url || '').toLowerCase().split('?')[0];
  if (/\.gov(\.cn)?(\/|$)/.test(url.replace(/^https?:\/\//, '').split('/')[0] + '/')) return true;
  return OFFICIAL_MARKERS.some((m) => (s.publisher || '').includes(m) || (s.title || '').includes(m));
}

function independentKey(s: EvidenceSource): string {
  if (s.publisher?.trim()) return s.publisher.trim();
  const host = (s.url || '').replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
  return host || s.title || s.tool || 'unknown';
}

export interface NumericPoint extends EvidenceSource {
  value?: number;
  snapshot_sha256?: string;
}

/** 一个官方来源加 64 位快照即可核验；两个以上来源不一致则标冲突且不择一。 */
export function verifyNumericClaim(values: NumericPoint[], tolerance = 0.01): EvidenceVerification {
  const mk = (status: VerificationStatus, reason: string): EvidenceVerification => ({
    status, label: VERIFICATION_LABELS[status], reason, usable_as_conclusion: status === 'verified',
  });
  const points = values.filter((row) => typeof row.value === 'number' && Number.isFinite(row.value));
  if (!points.length) return mk('unverified', '无数值来源');
  const byPub = new Map<string, number>();
  for (const row of points) byPub.set(independentKey(row), row.value as number);
  if (byPub.size < 2) {
    const only = points[0];
    if (isOfficialSource(only) && (only.snapshot_sha256 || '').length === 64) return mk('verified', '一手官方原文并附快照');
    return mk('review_recommended', '只有 1 个独立来源');
  }
  const nums = [...byPub.values()];
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const base = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
  if ((hi - lo) / base < tolerance) return mk('verified', `${nums.length} 个独立来源一致`);
  return mk('conflict', `${nums.length} 个来源数值冲突（${lo}–${hi}），已全部展示，待人工核验`);
}

export function verifySources(sources: EvidenceSource[]): EvidenceVerification {
  const mk = (status: VerificationStatus, reason: string): EvidenceVerification => ({
    status, label: VERIFICATION_LABELS[status], reason, usable_as_conclusion: status === 'verified',
  });
  if (!sources.length) return mk('unverified', '本次回答未调用带来源的工具，内容基于模型知识');
  const officials = sources.filter(isOfficialSource);
  if (!officials.length) return mk('review_recommended', '只有转载/第三方来源，未找到官方原文');
  const others = new Set(sources.map(independentKey));
  others.delete(independentKey(officials[0]));
  if (others.size) return mk('verified', `官方原文 + ${others.size} 个独立来源`);
  return mk('review_recommended', '仅有官方原文，缺少独立来源交叉核对');
}

/** 已知数据工具的固定来源（工具结果里没有结构化来源时使用） */
const TOOL_SOURCES: Record<string, EvidenceSource> = {
  get_solar_resource: { title: 'NASA POWER 辐照数据', publisher: 'NASA POWER', url: 'domestic-cache://nasa-power/' },
  get_wind_resource: { title: 'NASA POWER 风速数据', publisher: 'NASA POWER', url: 'domestic-cache://nasa-power/' },
  get_climate_data: { title: 'NASA POWER 气象数据', publisher: 'NASA POWER', url: 'domestic-cache://nasa-power/' },
  get_historical_data: { title: 'NASA POWER 历史数据', publisher: 'NASA POWER', url: 'domestic-cache://nasa-power/' },
};

/** 从工具结果中递归收集来源（url / source_url / publisher / source_org / source 字段） */
export function collectSourcesFromToolResult(toolName: string, result: unknown): EvidenceSource[] {
  const out: EvidenceSource[] = [];
  const seen = new Set<string>();
  const visit = (v: unknown, depth: number) => {
    if (!v || typeof v !== 'object' || depth > 5) return;
    if (Array.isArray(v)) { v.slice(0, 50).forEach((x) => visit(x, depth + 1)); return; }
    const o = v as Record<string, unknown>;
    const url = typeof o.url === 'string' ? o.url : typeof o.source_url === 'string' ? o.source_url : typeof o.sourceUrl === 'string' ? o.sourceUrl : undefined;
    const publisher = typeof o.publisher === 'string' ? o.publisher : typeof o.source_org === 'string' ? o.source_org : typeof o.source === 'string' ? o.source : undefined;
    if ((url && /^https?:\/\//.test(url)) || publisher) {
      const s: EvidenceSource = { url, publisher, title: typeof o.title === 'string' ? o.title : undefined, type: typeof o.type === 'string' ? o.type : undefined, tool: toolName };
      const key = `${s.url}|${s.publisher}`;
      if (!seen.has(key)) { seen.add(key); out.push(s); }
    }
    for (const x of Object.values(o)) visit(x, depth + 1);
  };
  visit(result, 0);
  if (!out.length && TOOL_SOURCES[toolName]) out.push({ ...TOOL_SOURCES[toolName], tool: toolName });
  return out;
}
