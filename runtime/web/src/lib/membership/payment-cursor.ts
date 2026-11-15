import type { Prisma } from '@prisma/client';
type Boundary = { owner: string; id: string; createdAt: string };
export function encodePaymentCursor(owner: string, row: { id: string; createdAt: Date }) {
    return Buffer.from(JSON.stringify({ owner, id: row.id, createdAt: row.createdAt.toISOString() })).toString('base64url');
}
export function paymentBoundary(raw: string | null, owner: string): Prisma.PaymentWhereInput {
    if (raw === null) return {};
    if (raw.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error('付款记录游标无效');
    let value: Boundary;
    try { value = JSON.parse(Buffer.from(raw, 'base64url').toString()); } catch { throw new Error('付款记录游标无效'); }
    if (!value || value.owner !== owner || typeof value.id !== 'string' || !value.id || value.id.length > 200 ||
        typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) throw new Error('付款记录游标无效');
    const date = new Date(value.createdAt);
    return { OR: [{ createdAt: { lt: date } }, { createdAt: date, id: { lt: value.id } }] };
}
