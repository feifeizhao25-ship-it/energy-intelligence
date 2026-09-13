import { verifyAuditRecord } from './audit-service';
import { prisma } from '@/lib/prisma';
jest.mock('@/lib/prisma', () => ({ prisma: { auditLog: { findUnique: jest.fn() } } }));
test.each([null, '', 'wrong-checksum'])('absent or invalid checksum cannot verify a record: %s', async checksum => {
    (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({ id: 'record', userId: 'owner', type: 'CALCULATION', createdAt: new Date('2026-01-01'), inputs: {}, outputs: {}, evidences: [], assumptions: {}, checksum });
    expect((await verifyAuditRecord('record')).valid).toBe(false);
});
