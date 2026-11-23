import { CITATION_STANDARD, citationFieldsReady, documentTypeCode, formatGbt7714 } from './gbt7714';

describe('GB/T 7714', () => {
    it('缺字段写待核实', () => {
        expect(formatGbt7714({ title: '光伏发电站设计标准（2024 年版）', docNumber: 'GB 50797-2012' }))
            .toContain('待核实');
        expect(formatGbt7714({ title: '光伏发电站设计标准（2024 年版）', docNumber: 'GB 50797-2012' }))
            .toContain('GB 50797-2012');
    });
    it('标题或出处是占位时不生成引用', () => {
        expect(citationFieldsReady({ title: '政策原文', docNumber: null })).toBe(false);
        expect(citationFieldsReady({ title: '光伏发电站设计标准（2024 年版）', docNumber: '待核实' })).toBe(false);
        expect(citationFieldsReady({ title: '光伏发电站设计标准（2024 年版）', docNumber: 'GB 50797-2012' })).toBe(true);
    });
});

describe('GB/T 7714-2025（核15）', () => {
    it('依据的是 2025 版；标准用 [S]，政策文件用 [Z]', () => {
        expect(CITATION_STANDARD).toBe('GB/T 7714-2025');
        expect(documentTypeCode({ title: 'x', docNumber: 'GB/T 35694-2025' })).toBe('S');
        expect(documentTypeCode({ title: 'x', docNumber: 'NB/T 11894-2025' })).toBe('S');
        expect(documentTypeCode({ title: 'x', docNumber: '发改价格〔2025〕136号' })).toBe('Z');
        expect(formatGbt7714({ title: '光伏发电站安全规程', docNumber: 'GB/T 35694-2025', authors: '国家市场监督管理总局', source: '中国标准出版社', year: '2025' }))
            .toBe('国家市场监督管理总局. 光伏发电站安全规程: GB/T 35694-2025[S]. 中国标准出版社, 2025.');
        expect(formatGbt7714({ title: '关于深化新能源上网电价市场化改革的通知', docNumber: '发改价格〔2025〕136号', authors: '国家发展改革委', source: '国家发展改革委', year: '2025' }))
            .toBe('国家发展改革委. 关于深化新能源上网电价市场化改革的通知[Z]. 国家发展改革委, 2025. 发改价格〔2025〕136号.');
    });
});
