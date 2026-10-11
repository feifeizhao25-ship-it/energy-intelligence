/**
 * 工作台推荐的三个问题：政策区空时不把空卡排最前；同一件事只出现一次、低优先级提示有频率控制且可关闭；
 * 免费额度用完时不再推荐去测算。
 */
import { buildPersonalDashboard, type SummaryInput } from './personal-summary';
import { buildPersonalization, dedupeNextActions, type Preferences } from './personalization';

const NOW = new Date('2026-10-10T01:30:00Z'); // 北京时间 10 月 10 日（周六）09:30
const prefs = (p: Partial<Preferences>): Preferences => ({ role: null, province: null, interest: null, personalized: true, ...p });
const base: SummaryInput = {
    user: { name: '测试', plan: 'FREE', planExpireAt: null },
    projects: [], projectCount: 0, calculationCount: 0, savedPaperCount: 0, stations: [],
    usageToday: {}, limits: { '收益测算': 2, 'AI 对话': 3 }, now: NOW,
};
const project = { id: 'p1', name: '张家口风光储（规划）', type: 'WIND', capacity: 50000, reportStatus: 'LOCKED', updatedAt: NOW };
const pBase = { projectLocations: [], projectTypes: [], hasStationAlerts: false, policies: [], now: NOW };

/** 找一个 hashDay 落在指定星期几的 userId */
function userIdForWeekday(weekday: number, other = false): string {
    for (let i = 0; i < 1000; i++) {
        const id = `user-${i}`;
        let h = 0;
        for (let k = 0; k < id.length; k++) h = (h * 31 + id.charCodeAt(k)) >>> 0;
        if ((h % 7 === weekday) !== other) return id;
    }
    throw new Error('no id');
}

describe('政策区为空', () => {
    it('政府角色：没有已审核政策时，政策区降到最后，主卡改为看电价规则并说明原因', () => {
        const v = buildPersonalization({ ...pBase, prefs: prefs({ role: 'government', province: '浙江' }) });
        expect(v.moduleOrder[v.moduleOrder.length - 1]).toBe('policies');
        expect(v.moduleOrder[0]).not.toBe('policies');
        expect(v.focus!.title).toBe('浙江的电价规则');
        expect(v.focus!.reason).toContain('暂无该省已审核通过的政策');
        expect(v.reasons.join()).toContain('政策区排在最后');
    });
    it('有已审核政策时仍排第一', () => {
        const v = buildPersonalization({ ...pBase, policies: [{ id: 'z', region: '浙江', type: 'SUBSIDY_KWH', value: 0.1, unit: '元/kWh', sourceTitle: 'x', docNumber: null, sourceUrl: null, publishedAt: null, startDate: null, endDate: null }], prefs: prefs({ role: 'government', province: '浙江' }) });
        expect(v.moduleOrder[0]).toBe('policies');
    });
});

describe('同类提示只出现一次，有频率控制，可关闭', () => {
    it('研究人员主卡「检索与收藏相关文献」与「收藏与你项目相关的文献」去重', () => {
        const v = buildPersonalization({ ...pBase, prefs: prefs({ role: 'researcher', province: '山东' }) });
        const actions = [{ id: 'papers', href: '/papers' }, { id: 'report', href: '/projects/p1' }];
        expect(dedupeNextActions(actions, v.focus).map(a => a.id)).toEqual(['report']);
    });
    it('文献提示：没有项目时不出现；有项目时每人每周固定一天出现；关闭后不出现', () => {
        const weekday = 6; // 周六
        const onDay = userIdForWeekday(weekday);
        const offDay = userIdForWeekday(weekday, true);
        const ids = (input: Partial<SummaryInput>) => buildPersonalDashboard({ ...base, ...input }).nextActions.map(a => a.id);
        expect(ids({ userId: onDay })).not.toContain('papers');
        expect(ids({ userId: onDay, projectCount: 1, projects: [project] })).toContain('papers');
        expect(ids({ userId: offDay, projectCount: 1, projects: [project] })).not.toContain('papers');
        expect(ids({ userId: onDay, projectCount: 1, projects: [project], dismissedTips: ['papers', 'report'] })).toEqual([]);
    });
    it('告警、额度提醒不能被关闭', () => {
        const d = buildPersonalDashboard({ ...base, usageToday: { '收益测算': 2 }, stations: [{ id: 's', name: '1 号站', status: 'fault', lastUpdated: null }], dismissedTips: ['station-alert', 'upgrade'] });
        expect(d.nextActions.map(a => a.id)).toEqual(expect.arrayContaining(['station-alert', 'upgrade']));
    });
});

describe('免费额度用完时不再推荐测算', () => {
    it('「收益测算」2/2：不推荐「做第一次收益测算」，额度提示写明明天 0 点重置', () => {
        const d = buildPersonalDashboard({ ...base, calculationCount: 2, usageToday: { '收益测算': 2 } });
        expect(d.nextActions.map(a => a.id)).not.toContain('first-project');
        const upgrade = d.nextActions.find(a => a.id === 'upgrade')!;
        expect(upgrade.title).toBe('今日「收益测算」次数已用完');
        expect(upgrade.reason).toContain('明天 0 点重置');
    });
    it('工程师主卡原本指向测算页，额度用完后改为额度说明并指向电价卡', () => {
        const v = buildPersonalization({ ...pBase, calcQuotaExhausted: true, prefs: prefs({ role: 'engineer', province: '河北' }) });
        expect(v.focus).toMatchObject({ title: '今天的测算次数已用完', href: '#tariff' });
        const notExhausted = buildPersonalization({ ...pBase, prefs: prefs({ role: 'engineer', province: '河北' }) });
        expect(notExhausted.focus!.href).toBe('/calculator/solar');
        // 不指向测算页的主卡不受影响
        expect(buildPersonalization({ ...pBase, calcQuotaExhausted: true, prefs: prefs({ role: 'owner' }) }).focus!.href).toBe('/my/stations');
    });
});
