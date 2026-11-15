import { freshnessView } from './FreshnessBadge';

describe('时效徽章', () => {
    const today = new Date('2026-10-27T00:00:00Z');
    it('没有日期时显示未连接', () => {
        expect(freshnessView(null, 90, today).label).toBe('未连接');
    });
    it('未来日期按已过期', () => {
        expect(freshnessView('2026-12-01', 90, today).usable).toBe(false);
    });
    it('临近复核为橙色口径', () => {
        expect(freshnessView('2026-08-01', 90, today).level).toBe('due');
    });
    it('超过周期不参与测算', () => {
        expect(freshnessView('2026-01-01', 90, today).level).toBe('expired');
    });
});
