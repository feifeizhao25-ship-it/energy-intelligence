import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildPersonalDashboard, projectCountFact, recentWorkDetail, recentWorkTitle, RECENT_WORK_EMPTY, type SummaryInput } from './personal-summary';
import { accountLabel, greetingFor, readNickname } from './greeting';

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
    expect(greetingFor({ name: '用户_1003' })).toBe('你好');
    expect(greetingFor({ name: '用户_1003', nickname: '小王' })).toBe('你好，小王');
    expect(greetingFor({ name: null })).toBe('你好');
    expect(accountLabel('用户_1008')).toBe('用户');
    expect(accountLabel('张三')).toBe('张三');
    expect(readNickname({ profile: { nickname: ' 小王 ' } })).toBe('小王');
    expect(readNickname({ preferences: { nickname: '用户_1001' } })).toBeNull();
    const auto = buildPersonalDashboard({ ...base, user: { name: '用户_1002', nickname: null, plan: 'FREE', planExpireAt: null } });
    expect(auto.greeting).toBe('你好');
    expect(auto.greeting).not.toContain('用户_');
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

describe('已保存的光伏估算', () => {
  it('测算次数把 calculation_snapshots 算进去，最近列表出现未挂项目的快照', () => {
    const created = new Date('2026-11-12T10:00:00Z');
    const d = buildPersonalDashboard({
      ...base,
      calculationCount: 0,
      snapshotCount: 1,
      savedCalculations: [{
        id: 'snap-1', name: '张北光伏', type: 'SOLAR', capacity: 100, projectId: null, createdAt: created,
      }],
    });
    expect(d.counts.calculations).toBe(1);
    expect(d.counts.projects).toBe(0);
    expect(d.counts.savedEstimates).toBe(1);
    expect(projectCountFact(d.counts)).toEqual({ label: '已保存测算', value: '1' });
    expect(recentWorkTitle(d.recentProjects)).toBe('最近的测算');
    expect(recentWorkDetail(d.recentProjects[0])).toBe('光伏 · 已保存测算 · 100 kW');
    expect(d.recentProjects).toEqual([expect.objectContaining({
      id: 'snap-1', name: '张北光伏', href: '/audit/snap-1', type: 'SOLAR', capacity: 100,
    })]);
    expect(d.nextActions[0]).toMatchObject({ id: 'first-project', title: '把测算结果保存为项目' });
    expect(d.nextActions[0].reason).toBe('已保存 1 条测算，还没有建立项目');
    expect(d.nextActions[0].reason).not.toContain('还没有保存项目');
  });

  it('已经出现在项目里的快照不重复列出，别人的项目编号也不会被当成自己的项目', () => {
    const d = buildPersonalDashboard({
      ...base,
      projectCount: 1,
      calculationCount: 2,
      snapshotCount: 1,
      projects: [{ id: 'p1', name: '保定项目', type: 'SOLAR', capacity: 50, reportStatus: 'LOCKED', updatedAt: new Date('2026-11-11T00:00:00Z') }],
      savedCalculations: [
        { id: 'snap-owned', name: '保定光伏', type: 'SOLAR', capacity: 50, projectId: 'p1', createdAt: new Date('2026-11-12T00:00:00Z') },
        { id: 'snap/new', name: '另一处估算', type: 'SOLAR', capacity: 80, projectId: 'someone-else', createdAt: new Date('2026-11-10T00:00:00Z') },
      ],
    });
    expect(d.counts.calculations).toBe(3);
    expect(d.counts.savedEstimates).toBe(1);
    expect(projectCountFact(d.counts)).toEqual({ label: '项目', value: '1' });
    expect(recentWorkTitle(d.recentProjects)).toBe('最近的项目与测算');
    expect(d.recentProjects.map((item) => item.id)).toEqual(['p1', 'snap/new']);
    expect(d.recentProjects[1].href).toBe('/audit/snap%2Fnew');
  });

  it('项目和测算都没有时才是空状态，计数仍写项目 0', () => {
    const d = buildPersonalDashboard(base);
    expect(projectCountFact(d.counts)).toEqual({ label: '项目', value: '0' });
    expect(recentWorkTitle(d.recentProjects)).toBe('最近的项目');
    expect(d.recentProjects).toEqual([]);
    expect(RECENT_WORK_EMPTY).toContain('也没有已保存的测算');
    expect(d.nextActions[0].reason).toBe('还没有任何项目');
    const page = readFileSync(join(ROOT, 'src/app/(dashboard)/dashboard/page.tsx'), 'utf8');
    expect(page).toContain('projectCountFact');
    expect(page).toContain('recentWorkTitle');
    expect(page).toContain('RECENT_WORK_EMPTY');
    expect(page).not.toContain('还没有保存项目');
    expect(page).not.toContain('还没有项目。做一次测算并保存');
  });
});

describe('部署拓扑', () => {
  it('只把后端的权益注册表暴露给浏览器', () => {
    const cfg = readFileSync(join(ROOT, 'next.config.js'), 'utf8');
    expect(cfg).toMatch(/source: '\/api\/backend\/entitlements'/);
    expect(cfg).not.toMatch(/\/api\/backend\/:path\*/);
    expect(cfg).toMatch(/serverExternalPackages:\s*\[[^\]]*['"]ali-oss['"]/);
  });

});

describe('会员到期日', () => {
  it('工作台返回北京时间的到期日 expiresOn，页面用它显示，不再截 UTC 时间', () => {
    const d = buildPersonalDashboard({ ...base, user: { name: null, plan: 'TEAM', planExpireAt: new Date('2027-06-30T00:00:00+08:00') } });
    expect(d.plan.expiresOn).toBe('2027-06-30');
    const page = readFileSync(join(ROOT, 'src/app/(dashboard)/dashboard/page.tsx'), 'utf8');
    expect(page).toContain('data.plan.expiresOn');
    expect(page).not.toContain('expiresAt.slice(0, 10)');
    const soon = buildPersonalDashboard({ ...base, now: new Date('2026-10-10T01:00:00Z'), user: { name: null, plan: 'PRO', planExpireAt: new Date('2026-10-13T00:00:00+08:00') } });
    expect(soon.nextActions.find(a => a.id === 'renew')!.reason).toContain('2026-10-13');
  });
});
