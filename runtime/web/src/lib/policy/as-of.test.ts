import { effectiveOn, visibleCohorts } from '@/lib/policy/as-of';
import { demoCohorts } from '@/lib/policy/demo-library';

const records = [
    { source_id: 'v1', effective_date: '2020-01-01', expiry_date: '2024-12-31', superseded_by: 'v2' },
    { source_id: 'v2', effective_date: '2025-01-01', expiry_date: null, superseded_by: null },
    { source_id: 'tariff-2024', effective_date: '2024-01-01', expiry_date: '2024-12-31' },
    { source_id: 'tariff-2025', effective_date: '2025-01-01', expiry_date: '2025-12-31' },
    { source_id: 'tariff-2026', effective_date: '2026-01-01', expiry_date: null },
];

describe('按日期回看和同类浏览', () => {
    it('十个日期与后端同一组期望', () => {
        const cases: Array<[string, string[]]> = [
            ['2019-12-31', []],
            ['2020-01-01', ['v1']],
            ['2024-06-01', ['v1', 'tariff-2024']],
            ['2024-12-31', ['v1', 'tariff-2024']],
            ['2025-01-01', ['v2', 'tariff-2025']],
            ['2025-06-01', ['v2', 'tariff-2025']],
            ['2025-12-31', ['v2', 'tariff-2025']],
            ['2026-01-01', ['v2', 'tariff-2026']],
            ['2026-10-27', ['v2', 'tariff-2026']],
            ['2027-01-01', ['v2', 'tariff-2026']],
        ];
        expect(cases).toHaveLength(10);
        for (const [day, expected] of cases) {
            expect(effectiveOn(records, day).map((item) => item.source_id).sort()).toEqual([...expected].sort());
        }
    });

    it('少于 20 人的分组不出现在示例里', () => {
        const shown = visibleCohorts([
            { province: '山东', role: '工商业业主', count: 19, items: ['电价'] },
            { province: '江苏', role: '项目开发', count: 20, items: ['政策'] },
        ]);
        expect(shown.map((item) => item.province)).toEqual(['江苏']);
        expect(demoCohorts().groups.map((item) => item.province)).toEqual(['江苏']);
        expect(demoCohorts().note).toContain('示例');
    });
});
