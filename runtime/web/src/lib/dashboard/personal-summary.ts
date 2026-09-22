/**
 * 个人工作台：只由当前用户自己的数据生成（免费档同样有）。
 *
 * 原来 /dashboard 对每个登录用户都显示内置演示人设（「你好，陈欣」「第 1 天」），
 * 下面的卡片也是那位虚构用户的内容；/api/dashboard 则一律 503。
 * 真实用户打开工作台，看到的是别人的名字和数据。
 */

export interface SummaryInput {
  user: { name: string | null; plan: string; planExpireAt: Date | null };
  projects: { id: string; name: string; type: string; capacity: number | null; reportStatus: string; updatedAt: Date }[];
  projectCount: number;
  calculationCount: number;
  savedPaperCount: number;
  stations: { id: string; name: string; status: string; lastUpdated: Date | null }[];
  usageToday: Record<string, number>;
  limits: Record<string, number>;
  now?: Date;
}

export interface NextAction {
  id: string;
  title: string;
  reason: string;
  href: string;
}

export interface PersonalDashboard {
  greeting: string;
  plan: { code: string; expiresAt: string | null; expiringSoon: boolean };
  counts: { projects: number; calculations: number; savedPapers: number; stations: number };
  recentProjects: { id: string; name: string; type: string; capacity: number | null; reportStatus: string; updatedAt: string }[];
  stationAlerts: { id: string; name: string; status: string; lastUpdated: string | null }[];
  usage: { type: string; used: number; limit: number }[];
  nextActions: NextAction[];
}

const TYPE_LABEL: Record<string, string> = { SOLAR: '光伏', WIND: '风电', STORAGE: '储能' };

export function projectTypeLabel(type: string): string {
  return TYPE_LABEL[type?.toUpperCase?.()] ?? type;
}

export function buildPersonalDashboard(input: SummaryInput): PersonalDashboard {
  const now = input.now ?? new Date();
  const expires = input.user.planExpireAt;
  const paid = input.user.plan !== 'FREE' && (!expires || expires > now);
  const plan = paid ? input.user.plan : 'FREE';
  const expiringSoon = Boolean(paid && expires && expires.getTime() - now.getTime() < 7 * 86400e3);

  const usage = Object.entries(input.limits)
    .filter(([, limit]) => Number.isFinite(limit) && limit > 0)
    .map(([type, limit]) => ({ type, used: input.usageToday[type] ?? 0, limit }));

  const stationAlerts = input.stations
    .filter((s) => ['warning', 'fault'].includes(s.status))
    .map((s) => ({ id: s.id, name: s.name, status: s.status, lastUpdated: s.lastUpdated ? s.lastUpdated.toISOString() : null }));

  const actions: NextAction[] = [];
  if (stationAlerts.length) {
    actions.push({ id: 'station-alert', title: `处理 ${stationAlerts.length} 个电站的告警`, reason: '你的电站有告警或故障状态', href: '/my/stations' });
  }
  if (input.projectCount === 0) {
    actions.push({
      id: 'first-project',
      title: input.calculationCount ? '把测算结果保存为项目' : '做第一次收益测算',
      reason: input.calculationCount ? `你已完成 ${input.calculationCount} 次测算，还没有保存项目` : '还没有任何项目',
      href: '/calculator/solar',
    });
  } else {
    const locked = input.projects.find((p) => p.reportStatus !== 'UNLOCKED' && p.reportStatus !== 'GENERATED');
    if (locked) actions.push({ id: 'report', title: `为「${locked.name}」生成评估报告`, reason: '该项目还没有报告', href: `/projects/${locked.id}` });
  }
  if (input.savedPaperCount === 0) {
    actions.push({ id: 'papers', title: '收藏与你项目相关的文献', reason: '文献库还是空的', href: '/papers' });
  }
  const nearLimit = usage.find((u) => u.used >= u.limit);
  if (!paid && nearLimit) {
    actions.push({ id: 'upgrade', title: '今日免费额度已用完', reason: `「${nearLimit.type}」已用 ${nearLimit.used}/${nearLimit.limit}`, href: '/pricing' });
  }
  if (expiringSoon) {
    actions.push({ id: 'renew', title: '会员即将到期', reason: `到期时间 ${expires!.toISOString().slice(0, 10)}`, href: '/membership' });
  }

  return {
    greeting: input.user.name ? `你好，${input.user.name}` : '你好',
    plan: { code: plan, expiresAt: paid && expires ? expires.toISOString() : null, expiringSoon },
    counts: {
      projects: input.projectCount,
      calculations: input.calculationCount,
      savedPapers: input.savedPaperCount,
      stations: input.stations.length,
    },
    recentProjects: input.projects.slice(0, 3).map((p) => ({ ...p, updatedAt: p.updatedAt.toISOString() })),
    stationAlerts,
    usage,
    nextActions: actions.slice(0, 4),
  };
}
