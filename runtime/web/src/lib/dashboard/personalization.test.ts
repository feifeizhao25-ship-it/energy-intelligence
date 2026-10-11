/**
 * 工作台个性化：原来 5 种角色的用户工作台完全相同。
 * 锁定：同一天 5 种角色的模块顺序与主卡片各不相同；按省份显示该省电价（带来源状态）；
 * 近期政策节点只来自库里已审核的政策；免费用户同样个性化；可以关闭。
 */
import { buildPersonalization, policyMilestones, inferProvince, parsePreferences, validatePreferences, ROLES, type PolicyRow, type Preferences } from './personalization';

const NOW = new Date('2026-10-08T01:00:00Z'); // 北京时间 10 月 8 日（寒露，节后第一个工作日）
const prefs = (p: Partial<Preferences>): Preferences => ({ role: null, province: null, interest: null, personalized: true, ...p });
const policy = (p: Partial<PolicyRow>): PolicyRow => ({
    id: 'p', region: '江苏', type: 'SUBSIDY_KWH', value: 0.1, unit: '元/kWh', sourceTitle: null, docNumber: null, sourceUrl: null,
    publishedAt: null, startDate: null, endDate: null, ...p,
});
const base = { projectLocations: [], projectTypes: [], hasStationAlerts: false, policies: [], now: NOW };

describe('5 种角色同一天的工作台各不相同', () => {
    it('模块顺序与主卡片两两不同', () => {
        // 库里有一条江苏已审核政策（政策区为空时会统一降到最后，见 recommendations.test.ts）
        const policies = [policy({ id: 'js', sourceTitle: '江苏某政策' })];
        const views = ROLES.map(role => buildPersonalization({ ...base, policies, prefs: prefs({ role, province: '江苏' }) }));
        const orders = views.map(v => v.moduleOrder.join(','));
        expect(new Set(orders).size).toBe(5);
        const focus = views.map(v => v.focus!.title);
        expect(new Set(focus).size).toBe(5);
        // 每两种角色之间，模块顺序至少有 3 处位置不同
        for (let i = 0; i < views.length; i++) for (let j = i + 1; j < views.length; j++) {
            const a = views[i].moduleOrder, b = views[j].moduleOrder;
            expect(a.filter((m, k) => b[k] !== m).length).toBeGreaterThanOrEqual(3);
        }
        expect(views[4].moduleOrder[0]).toBe('policies'); // 政府/园区：政策排第一
        expect(views[1].moduleOrder[0]).toBe('stationAlerts'); // 业主/运维：告警排第一
    });

    it('有电站告警时，任何角色都把告警置顶', () => {
        const v = buildPersonalization({ ...base, hasStationAlerts: true, prefs: prefs({ role: 'investor' }) });
        expect(v.moduleOrder[0]).toBe('stationAlerts');
    });

    it('关注领域决定快捷入口顺序：风电用户先看到风电测算', () => {
        const v = buildPersonalization({ ...base, prefs: prefs({ role: 'investor', interest: 'wind' }) });
        expect(v.quickActionOrder[0]).toBe('wind');
        expect(v.focus!.href).toBe('/calculator/wind');
    });
});

describe('按省份显示电价', () => {
    it('江苏：分时电价与燃煤发电基准价，原样显示「来源待核实」', () => {
        const v = buildPersonalization({ ...base, prefs: prefs({ role: 'investor', province: '江苏' }) });
        expect(v.tariff).toMatchObject({ status: 'ok', peak: 1.08, valley: 0.31, sourceStatus: '来源待核实' });
        expect(v.reasons.join()).toContain('按江苏显示（你的设置）');
    });

    it('河北：已取消固定分时，投资者主卡改为提示用合同电价', () => {
        const v = buildPersonalization({ ...base, prefs: prefs({ role: 'investor', province: '河北' }) });
        expect(v.tariff!.status).toBe('market');
        expect(v.focus!.title).toContain('已取消固定分时');
    });

    it('没设置省份时按最近项目的所在地推断，并写明是推断', () => {
        expect(inferProvince([null, '宁夏中卫', '江苏南京'])).toBe('宁夏');
        const v = buildPersonalization({ ...base, projectLocations: ['广东东莞'], projectTypes: ['SOLAR'], prefs: prefs({ role: 'owner' }) });
        expect(v.province).toBe('广东');
        expect(v.provinceSource).toBe('项目所在地');
        expect(v.reasons.join()).toContain('推断');
    });
});

describe('近期政策节点只用库里已审核的政策', () => {
    it('取过去 30 天到未来 90 天的发布/生效/到期日期，未来的排前面', () => {
        const rows = [
            policy({ id: 'a', sourceTitle: '江苏分布式光伏补贴通知', docNumber: '苏发改〔2026〕1号', startDate: new Date('2026-10-18T00:00:00+08:00'), endDate: new Date('2027-06-30T00:00:00+08:00') }),
            policy({ id: 'b', sourceTitle: '江苏储能示范项目', publishedAt: new Date('2026-09-20T00:00:00+08:00') }),
            policy({ id: 'c', sourceTitle: '很久以前', publishedAt: new Date('2025-01-01T00:00:00+08:00') }),
        ];
        const m = policyMilestones(rows, NOW);
        expect(m.map(x => [x.policyId, x.kind, x.daysFromNow])).toEqual([['a', '生效', 10], ['b', '发布', -18]]);
        expect(m[0].date).toBe('2026-10-18');
    });

    it('只取本省与全国的政策', () => {
        const rows = [policy({ id: 'js', region: '江苏省', startDate: new Date('2026-10-20T00:00:00+08:00') }),
            policy({ id: 'gd', region: '广东', startDate: new Date('2026-10-20T00:00:00+08:00') }),
            policy({ id: 'cn', region: '全国', startDate: new Date('2026-10-25T00:00:00+08:00') })];
        const v = buildPersonalization({ ...base, policies: rows, prefs: prefs({ role: 'government', province: '江苏' }) });
        expect(v.policies.map(p => p.id)).toEqual(['js', 'cn']);
        expect(v.milestones.map(x => x.policyId)).toEqual(['js', 'cn']);
        expect(v.focus!.title).toContain('2 个政策节点');
    });
});

describe('偏好读取、校验与关闭', () => {
    it('引导页保存的偏好（含目标等其他字段）可直接读取', () => {
        expect(parsePreferences({ preferences: { interest: 'solar', role: 'engineer', goal: 'calculate', province: '山东省' } }))
            .toEqual({ role: 'engineer', province: '山东', interest: 'solar', personalized: true });
        expect(parsePreferences(null)).toEqual({ role: null, province: null, interest: null, personalized: true });
    });

    it('非法角色、省份报中文错误', () => {
        expect(() => validatePreferences({ role: 'admin' })).toThrow('角色无效');
        expect(() => validatePreferences({ province: '火星' })).toThrow('省份无效');
        expect(validatePreferences({ role: 'government', province: '河北', personalized: false }).personalized).toBe(false);
    });

    it('关闭个性化后回到通用版，并说明原因', () => {
        const v = buildPersonalization({ ...base, prefs: prefs({ role: 'investor', province: '江苏', personalized: false }) });
        expect(v.personalized).toBe(false);
        expect(v.tariff).toBeNull();
        expect(v.focus).toBeNull();
        expect(v.reasons[0]).toContain('已关闭个性化');
    });
});
