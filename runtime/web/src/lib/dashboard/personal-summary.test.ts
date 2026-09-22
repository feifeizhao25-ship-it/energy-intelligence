import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildPersonalDashboard, type SummaryInput } from './personal-summary';

const ROOT = join(__dirname, '..', '..', '..');
const base: SummaryInput = {
  user: { name: '张三', plan: 'FREE', planExpireAt: null },
  projects: [], projectCount: 0, calculationCount: 0, savedPaperCount: 0, stations: [],
  usageToday: {}, limits: { 'AI 对话': 3, '收益测算': 2 }, now: new Date('2026-09-22T00:00:00Z'),
};

describe('个人工作台只用本人的数据', () => {
  it('新用户：问候本人，引导第一次测算', () => {
    const d = buildPersonalDashboard(base);
    expect(d.greeting).toBe('你好，张三');
    expect(d.nextActions[0]).toMatchObject({ id: 'first-project', href: '/calculator/solar' });
    expect(JSON.stringify(d)).not.toMatch(/陈欣|王强|李娜|john_smith/);
  });

  it('电站告警、免费额度用完、会员将到期都会出现在建议里', () => {
    const d = buildPersonalDashboard({
      ...base,
      projectCount: 1,
      projects: [{ id: 'p1', name: '保定 1MW', type: 'SOLAR', capacity: 1000, reportStatus: 'LOCKED', updatedAt: new Date() }],
      stations: [{ id: 's1', name: '1 号站', status: 'fault', lastUpdated: null }],
      usageToday: { 'AI 对话': 3 },
    });
    expect(d.nextActions.map((a) => a.id)).toEqual(expect.arrayContaining(['station-alert', 'report', 'upgrade']));
    const renew = buildPersonalDashboard({ ...base, user: { name: null, plan: 'PRO', planExpireAt: new Date('2026-09-25T00:00:00Z') } });
    expect(renew.plan).toMatchObject({ code: 'PRO', expiringSoon: true });
    expect(renew.nextActions.some((a) => a.id === 'renew')).toBe(true);
  });

  it('过期的付费档按免费档显示；无限额度不列入额度卡', () => {
    const d = buildPersonalDashboard({ ...base, user: { name: null, plan: 'FULL', planExpireAt: new Date('2026-01-01') }, limits: { a: Infinity, b: 5 } });
    expect(d.plan.code).toBe('FREE');
    expect(d.usage.map((u) => u.type)).toEqual(['b']);
  });

  it('工作台页不再请求演示人设接口', () => {
    const page = readFileSync(join(ROOT, 'src/app/(dashboard)/dashboard/page.tsx'), 'utf8');
    expect(page).toMatch(/fetch\('\/api\/dashboard'/);
    expect(page).not.toMatch(/personalization\/daily-layout|chen_xin/);
    const route = readFileSync(join(ROOT, 'src/app/api/dashboard/route.ts'), 'utf8');
    expect(route).not.toMatch(/status: 503/);
  });
});

describe('部署拓扑', () => {
  it('只把后端的权益注册表暴露给浏览器', () => {
    const cfg = readFileSync(join(ROOT, 'next.config.js'), 'utf8');
    expect(cfg).toMatch(/source: '\/api\/backend\/entitlements'/);
    expect(cfg).not.toMatch(/\/api\/backend\/:path\*/);
  });

});
