import { formatGbt7714 } from './gbt7714';

describe('GB/T 7714', () => {
    it('缺字段写待核实', () => {
        expect(formatGbt7714({ title: '光伏发电站设计标准（2024 年版）', docNumber: 'GB 50797-2012' }))
            .toContain('待核实');
        expect(formatGbt7714({ title: '光伏发电站设计标准（2024 年版）', docNumber: 'GB 50797-2012' }))
            .toContain('GB 50797-2012');
    });
});
