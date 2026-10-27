import { verifyNumericClaim } from './verification';

describe('数值核验', () => {
    it('官方原文加快照可以核验', () => {
        const view = verifyNumericClaim([{ value: 0.5, publisher: '国家能源局', type: 'official', snapshot_sha256: 'a'.repeat(64) }]);
        expect(view.label).toBe('已核验');
    });
    it('两个来源不一致时标冲突', () => {
        const view = verifyNumericClaim([
            { value: 0.4, publisher: '甲' },
            { value: 0.5, publisher: '乙' },
        ]);
        expect(view.label).toBe('冲突');
    });
});
