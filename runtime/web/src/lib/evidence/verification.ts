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
