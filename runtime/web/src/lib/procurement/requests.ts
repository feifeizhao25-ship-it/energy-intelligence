export const PROCUREMENT_FIELDS = [
    { key: 'account_name', label: '户名' },
    { key: 'bank_name', label: '开户行' },
    { key: 'account_number', label: '账号' },
    { key: 'tax_id', label: '税号' },
] as const;

export const PROCUREMENT_KINDS = {
    quote: '报价申请',
    contract: '合同申请',
    invoice: '发票申请',
} as const;

export type ProcurementKind = keyof typeof PROCUREMENT_KINDS;

/** 只登记申请。不创建支付，不生成发票号。 */
export function reviewProcurement(kind: ProcurementKind, fields: Record<string, string>) {
    const missing = PROCUREMENT_FIELDS.filter((field) => !(fields[field.key] || '').trim()).map((field) => field.label);
    return {
        kind,
        title: PROCUREMENT_KINDS[kind],
        status: missing.length ? 'incomplete' : 'pending_wecom',
        missing,
        paymentCreated: false,
        invoiceNumber: null as null,
        approved: false,
        note: missing.length
            ? `还缺${missing.join('、')}。审批尚未发送，不会产生支付。`
            : '四项已记下。状态为待企业微信审批。不会产生支付，也不会生成发票号。',
    };
}
