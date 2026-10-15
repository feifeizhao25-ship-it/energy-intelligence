import React from 'react';
import { verificationView, type EvidenceVerification } from '@/lib/evidence/verification';

const TONE: Record<string, string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
};

export function VerificationBadge({ verification }: { verification?: Partial<EvidenceVerification> | null }) {
  const v = verificationView(verification);
  return (
    <span
      data-testid="verification-badge"
      data-status={v.status}
      title={v.reason || undefined}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${TONE[v.tone]}`}
    >
      {v.label}
      {!v.usableAsConclusion && <span className="font-normal">· 不作为结论依据</span>}
    </span>
  );
}
