import { factLineIssues } from './ExplainLayer';

describe('解释层事实句', () => {
    it('不包含建议、值得、划算、利好', () => {
        const fact = '年发电量 1000 kWh，按当前输入与假设算出。';
        expect(factLineIssues(fact)).toEqual([]);
    });

    it('命中禁用词时列出来', () => {
        expect(factLineIssues('这个方案值得做')).toContain('值得');
    });
});
