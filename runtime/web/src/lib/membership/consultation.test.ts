import { bookConsultation } from './consultation';

describe('口径咨询', () => {
    it('只登记待审批，不自动通过', () => {
        const row = bookConsultation('电价口径');
        expect(row.approved).toBe(false);
        expect(row.status).toBe('pending');
        expect(row.message).toContain('不会自动通过');
    });
});
