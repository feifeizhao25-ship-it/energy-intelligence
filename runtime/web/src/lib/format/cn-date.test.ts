import { formatCnDate } from './cn-date';

test('国内日期用年月日，不用美式月/日/年', () => {
    const text = formatCnDate('2026-11-26T00:30:00Z');
    expect(text).toBe('2026年11月26日');
    expect(text).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
});

test('空值和非法日期不编造', () => {
    expect(formatCnDate(null)).toBe('--');
    expect(formatCnDate('不是日期')).toBe('--');
});
