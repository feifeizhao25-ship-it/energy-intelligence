/**
 * 工作台个性化（免费用户同样适用，不按会员档区分）。
 *
 * 原来 5 种角色的用户打开工作台，模块顺序、卡片完全一样。现在只用已有的资料：
 * - 角色、关注领域、所在省份、是否开启个性化：引导页（ONBOARDING_COMPLETE）或设置页（PROFILE_PREFERENCES）
 *   保存在 usage_logs.metadata 里的偏好，取最新一条（不改数据库结构）；
 * - 没设置省份时，按最近项目的所在地（projects.location，如「江苏南京」）推断，并说明推断来源；
 * - 省级电价：站内电价表（lib/pricing/tariffs.ts，带「来源待核实」等状态）；
 * - 政策与近期节点：只用库里人工审核通过（APPROVED）的政策，按发布/生效/到期日期挑出近期节点，不编造任何政策。
 * 每一处个性化都给出原因说明；用户关闭个性化后回到通用版（《互联网信息服务算法推荐管理规定》要求可关闭）。
 */
import { tariffDefaults, type TariffDefaults } from '@/lib/pricing/tariff-defaults';
import { normalizeProvince } from '@/lib/pricing/tariffs';

export const ROLES = ['investor', 'owner', 'engineer', 'researcher', 'government'] as const;
/** 现行 7 类角色。旧的 5 个标识仍可读取，避免已保存的偏好失效。 */
export const PRODUCT_ROLES = ['ci_owner', 'residential_owner', 'developer', 'epc', 'om', 'researcher', 'government'] as const;
export type ProductRole = typeof PRODUCT_ROLES[number];
export type Role = typeof ROLES[number] | ProductRole;
export const ROLE_LABELS: Record<Role, string> = {
    investor: '投资者/开发商',
    owner: '电站业主/运维',
    engineer: '工程师/设计院',
    researcher: '研究员/学生',
    government: '政府/园区',
    ci_owner: '工商业业主',
    residential_owner: '户用业主',
    developer: '项目开发',
    epc: 'EPC/设计院',
    om: '运维',
};

export const INTERESTS = ['solar', 'wind', 'storage', 'all'] as const;
export type Interest = typeof INTERESTS[number];
export const INTEREST_LABELS: Record<Interest, string> = { solar: '光伏', wind: '风电', storage: '储能', all: '综合' };

/** 省级行政区简称（与电价表键一致的写法） */
export const PROVINCES = [
    '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江', '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东',
    '河南', '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆',
    '香港', '澳门', '台湾',
] as const;

export const PREFERENCE_LOG_TYPES = ['PROFILE_PREFERENCES', 'ONBOARDING_COMPLETE'] as const;

export interface PreferenceTag {
    id: string;
    label: string;
    source: string;
}

export interface Preferences {
    role: Role | null;
    province: string | null;
    interest: Interest | null;
    /** false = 用户关闭了个性化 */
    personalized: boolean;
    /** 可删除的兴趣标签。没有标签时为空数组。 */
    tags: PreferenceTag[];
}

function cleanTags(value: unknown): PreferenceTag[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const row = item as Record<string, unknown>;
        if (typeof row.id !== 'string' || typeof row.label !== 'string' || typeof row.source !== 'string') return [];
        const label = row.label.trim();
        if (!label) return [];
        return [{ id: row.id, label, source: row.source }];
    });
}

const isRole = (v: unknown): v is Role => typeof v === 'string' && (
    (ROLES as readonly string[]).includes(v) || (PRODUCT_ROLES as readonly string[]).includes(v)
);
const isInterest = (v: unknown): v is Interest => typeof v === 'string' && (INTERESTS as readonly string[]).includes(v);

export function cleanProvince(v: unknown): string | null {
    if (typeof v !== 'string') return null;
    const p = normalizeProvince(v);
    return (PROVINCES as readonly string[]).includes(p) ? p : null;
}

/** 从 usage_logs.metadata 读偏好：设置页存 { preferences: {...} }，引导页存 { preferences: { interest, role, goal, province } } */
export function parsePreferences(metadata: unknown): Preferences {
    const prefs = (metadata as { preferences?: Record<string, unknown> } | null)?.preferences ?? {};
    return {
        role: isRole(prefs.role) ? prefs.role : null,
        province: cleanProvince(prefs.province),
        interest: isInterest(prefs.interest) ? prefs.interest : null,
        personalized: prefs.personalized !== false,
        tags: cleanTags(prefs.tags),
    };
}

/** 校验设置页提交的偏好；非法值报中文错误 */
export function validatePreferences(input: unknown): Preferences {
    const body = (input ?? {}) as Record<string, unknown>;
    const empty = (v: unknown) => v === undefined || v === null || v === '';
    if (!empty(body.role) && !isRole(body.role)) throw new Error('角色无效');
    if (!empty(body.interest) && !isInterest(body.interest)) throw new Error('关注领域无效');
    const province = empty(body.province) ? null : cleanProvince(body.province);
    if (!empty(body.province) && !province) throw new Error('省份无效');
    if (body.personalized !== undefined && typeof body.personalized !== 'boolean') throw new Error('个性化开关无效');
    return {
        role: isRole(body.role) ? body.role : null,
        province,
        interest: isInterest(body.interest) ? body.interest : null,
        personalized: body.personalized !== false,
        tags: cleanTags(body.tags),
    };
}

/** 从项目所在地（如「江苏南京」「宁夏中卫」）推断省份 */
export function inferProvince(locations: (string | null | undefined)[]): string | null {
    for (const loc of locations) {
        const text = String(loc ?? '').trim();
        const hit = PROVINCES.find(p => text.startsWith(p));
        if (hit) return hit;
    }
    return null;
}

export interface PolicyRow {
    id: string;
    region: string;
    type: string;
    value: number;
    unit: string;
    sourceTitle: string | null;
    docNumber: string | null;
    sourceUrl: string | null;
    publishedAt: Date | null;
    startDate: Date | null;
    endDate: Date | null;
}

const POLICY_TYPE_LABEL: Record<string, string> = { SUBSIDY_KWH: '度电补贴', SUBSIDY_ONE_TIME: '一次性补贴', ELECTRICITY_PRICE: '电价政策' };

export function policyTitle(p: PolicyRow): string {
    return p.sourceTitle || `${p.region}${POLICY_TYPE_LABEL[p.type] ?? '政策'}（${p.value} ${p.unit}）`;
}

export interface PolicyMilestone {
    policyId: string;
    date: string; // YYYY-MM-DD（北京时间）
    kind: '发布' | '生效' | '到期';
    title: string;
    docNumber: string | null;
    sourceUrl: string | null;
    /** 距今天数，负数为已过去 */
    daysFromNow: number;
}

const DAY = 86_400_000;
const shanghaiDay = (d: Date) => Math.floor((d.getTime() + 8 * 3600_000) / DAY);
const ymd = (d: Date) => new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 10);

/** 近期政策节点：过去 pastDays 天到未来 futureDays 天内的发布、生效、到期日期，按离今天远近排序 */
export function policyMilestones(policies: PolicyRow[], now: Date, pastDays = 30, futureDays = 90): PolicyMilestone[] {
    const today = shanghaiDay(now);
    const out: PolicyMilestone[] = [];
    for (const p of policies) {
        const events: [Date | null, PolicyMilestone['kind']][] = [[p.publishedAt, '发布'], [p.startDate, '生效'], [p.endDate, '到期']];
        for (const [date, kind] of events) {
            if (!date) continue;
            const diff = shanghaiDay(date) - today;
            if (diff < -pastDays || diff > futureDays) continue;
            out.push({ policyId: p.id, date: ymd(date), kind, title: policyTitle(p), docNumber: p.docNumber, sourceUrl: p.sourceUrl, daysFromNow: diff });
        }
    }
    // 未来的在前（近的优先），再列最近已过去的
    return out.sort((a, b) => (a.daysFromNow >= 0) !== (b.daysFromNow >= 0) ? (a.daysFromNow >= 0 ? -1 : 1) : Math.abs(a.daysFromNow) - Math.abs(b.daysFromNow)).slice(0, 5);
}

export type ModuleId = 'focus' | 'stationAlerts' | 'nextActions' | 'tariff' | 'policies' | 'projects' | 'usage';

/** 各角色的模块顺序（告警有内容时始终置顶，见 buildPersonalization） */
export const ROLE_MODULE_ORDER: Record<Role | 'default', ModuleId[]> = {
    default: ['nextActions', 'stationAlerts', 'projects', 'tariff', 'policies', 'usage'],
    investor: ['focus', 'nextActions', 'projects', 'tariff', 'policies', 'usage', 'stationAlerts'],
    owner: ['stationAlerts', 'focus', 'nextActions', 'tariff', 'projects', 'usage', 'policies'],
    engineer: ['focus', 'nextActions', 'tariff', 'projects', 'usage', 'policies', 'stationAlerts'],
    researcher: ['focus', 'policies', 'nextActions', 'usage', 'projects', 'tariff', 'stationAlerts'],
    government: ['policies', 'focus', 'tariff', 'projects', 'nextActions', 'usage', 'stationAlerts'],
    ci_owner: ['tariff', 'focus', 'projects', 'nextActions', 'policies', 'usage', 'stationAlerts'],
    residential_owner: ['focus', 'tariff', 'nextActions', 'projects', 'usage', 'policies', 'stationAlerts'],
    developer: ['tariff', 'policies', 'projects', 'focus', 'nextActions', 'usage', 'stationAlerts'],
    epc: ['focus', 'nextActions', 'projects', 'tariff', 'usage', 'policies', 'stationAlerts'],
    om: ['stationAlerts', 'focus', 'projects', 'nextActions', 'tariff', 'usage', 'policies'],
};

export interface FocusCard { title: string; reason: string; href: string }

function focusCard(role: Role, province: string | null, interest: Interest | null, tariff: TariffDefaults | null, milestoneCount: number, noPolicies = false): FocusCard {
    const where = province ? `${province}` : '你的项目所在省份';
    const calc = interest === 'wind' ? '/calculator/wind' : interest === 'storage' ? '/calculator/storage' : '/calculator/solar';
    const calcName = interest === 'wind' ? '风电' : interest === 'storage' ? '储能' : '光伏';
    switch (role) {
        case 'investor':
            return tariff?.status === 'market'
                ? { title: `${where}已取消固定分时，测算需用合同电价`, reason: '你是投资者/开发商：收益对电价最敏感，按合同价或市场价重算一次', href: calc }
                : { title: `按${where}电价测一次${calcName}收益`, reason: '你是投资者/开发商：先看内部收益率与回收期', href: calc };
        case 'owner':
            return { title: '查看电站运行与告警', reason: '你是电站业主/运维：优先处理告警，再看发电情况', href: '/my/stations' };
        case 'engineer':
            return { title: '核对系统损耗与衰减假设', reason: '你是工程师/设计院：测算页逐项列出遮挡、线损、温度等损耗，可与设计值对照', href: '/calculator/solar' };
        case 'researcher':
            return { title: '检索与收藏相关文献', reason: '你是研究人员/学生：文献检索与引用工具在这里', href: '/papers' };
        case 'government':
            return milestoneCount > 0
                ? { title: `${where}近期有 ${milestoneCount} 个政策节点`, reason: '你是政府/园区用户：政策与电价规则变化排在最前', href: '#policies' }
                : noPolicies
                    ? { title: `${where}的电价规则`, reason: '你是政府/园区用户：政策库暂无该省已审核通过的政策，先看电价与分时规则', href: '#tariff' }
                    : { title: `${where}的电价规则与已审核政策`, reason: '你是政府/园区用户：政策与电价规则变化排在最前', href: '#tariff' };
        case 'ci_owner':
            return { title: `${where}分时电价与用电曲线`, reason: '你是工商业业主：先看已公布电价和本厂用电', href: '#tariff' };
        case 'residential_owner':
            return { title: '先看三个输入的家用测算', reason: '你是户用业主：默认新手展示', href: '/calculator/solar' };
        case 'developer':
            return { title: `${where}已公布电价与测算输入`, reason: '项目开发只列事实、数据与计算方法', href: calc };
        case 'epc':
            return { title: '核对系统损耗与衰减假设', reason: '你是 EPC/设计院：逐项对照假设', href: '/calculator/solar' };
        case 'om':
            return { title: '查看电站运行与告警', reason: '你是运维：先看告警，再看发电记录', href: '/my/stations' };
    }
}

export function defaultReadingMode(role: Role | null): 'beginner' | 'professional' {
    if (role === 'researcher' || role === 'residential_owner') return 'beginner';
    return 'professional';
}

/** 今日测算次数已用完时，原本指向测算页的主卡改为提示额度与可做的事 */
function adjustFocusForQuota(focus: FocusCard, exhausted: boolean, province: string | null, reasons: string[]): FocusCard {
    if (!exhausted || !focus.href.startsWith('/calculator')) return focus;
    reasons.push('今日测算次数已用完，推荐改为不消耗测算次数的内容');
    return {
        title: '今天的测算次数已用完',
        reason: `北京时间明天 0 点重置；今天可以先看${province ? `${province}的` : ''}电价与政策，或整理已有的测算结果`,
        href: province ? '#tariff' : '/projects',
    };
}

/**
 * 合并工作台：同一件事只出现一次——「接下来可以做」里与主卡指向同一页面的条目去掉（例如研究人员主卡「检索与收藏相关文献」
 * 与「收藏与你项目相关的文献」）。
 */
export function dedupeNextActions<T extends { href: string }>(actions: T[], focus: FocusCard | null): T[] {
    if (!focus) return actions;
    return actions.filter(a => a.href !== focus.href);
}

const QUICK_ACTION_IDS = ['calc', 'wind', 'storage', 'report'] as const;
export type QuickActionId = typeof QUICK_ACTION_IDS[number];

export interface Personalization {
    personalized: boolean;
    role: Role | null;
    roleLabel: string | null;
    province: string | null;
    /** 省份从哪来：'设置' | '项目所在地' | null */
    provinceSource: '设置' | '项目所在地' | null;
    interest: Interest | null;
    moduleOrder: ModuleId[];
    focus: FocusCard | null;
    quickActionOrder: QuickActionId[];
    tariff: TariffDefaults | null;
    policies: { id: string; title: string; docNumber: string | null; sourceUrl: string | null; value: number; unit: string; region: string }[];
    milestones: PolicyMilestone[];
    tags: PreferenceTag[];
    /** 为什么这样展示（逐条说明） */
    reasons: string[];
}

export function buildPersonalization(input: {
    prefs: Preferences | null;
    projectLocations: (string | null | undefined)[];
    projectTypes: string[];
    hasStationAlerts: boolean;
    policies: PolicyRow[];
    now: Date;
    /** 今日测算次数已用完：不再把用户往测算页推 */
    calcQuotaExhausted?: boolean;
}): Personalization {
    const prefs = input.prefs ?? { role: null, province: null, interest: null, personalized: true, tags: [] };
    if (!prefs.personalized) {
        return {
            personalized: false, role: null, roleLabel: null, province: null, provinceSource: null, interest: null,
            moduleOrder: ROLE_MODULE_ORDER.default, focus: null, quickActionOrder: [...QUICK_ACTION_IDS],
            tariff: null, policies: [], milestones: [], tags: [], reasons: ['你已关闭个性化，工作台显示通用版（可在「设置」重新开启）'],
        };
    }
    const reasons: string[] = [];
    const inferred = prefs.province ? null : inferProvince(input.projectLocations);
    const province = prefs.province ?? inferred;
    const provinceSource = prefs.province ? '设置' : inferred ? '项目所在地' : null;

    // 关注领域：设置优先，否则按项目类型最多的一类
    let interest = prefs.interest;
    if (!interest && input.projectTypes.length) {
        const counts = new Map<string, number>();
        for (const t of input.projectTypes) counts.set(t, (counts.get(t) ?? 0) + 1);
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
        interest = top === 'WIND' ? 'wind' : top === 'STORAGE' ? 'storage' : 'solar';
        reasons.push(`关注领域按你的项目类型（${INTEREST_LABELS[interest]}）推断`);
    } else if (interest) {
        reasons.push(`关注领域：${INTEREST_LABELS[interest]}（你的设置）`);
    }

    const tariff = province ? tariffDefaults(province, input.now) : null;
    if (province) reasons.push(`电价与政策按${province}显示（${provinceSource === '设置' ? '你的设置' : '根据你最近项目的所在地推断'}）`);

    // 只取本省与全国的已审核政策
    const related = province
        ? input.policies.filter(p => normalizeProvince(p.region).startsWith(province) || p.region === '全国')
        : input.policies.filter(p => p.region === '全国');
    const milestones = policyMilestones(related, input.now);

    const role = prefs.role;
    let moduleOrder = [...ROLE_MODULE_ORDER[role ?? 'default']];
    if (role) reasons.push(`模块顺序按你的角色「${ROLE_LABELS[role]}」调整`);
    else reasons.push('还没有设置角色：在「设置」选择角色后，工作台会按角色调整模块顺序');
    if (!role) moduleOrder = moduleOrder.filter(m => m !== 'focus');
    // 政策库里没有本省已审核政策时，不把空卡排在前面（政府角色也一样），降到最后并给出说明
    const noPolicies = related.length === 0;
    if (noPolicies) {
        moduleOrder = [...moduleOrder.filter(m => m !== 'policies'), 'policies'];
        if (province) reasons.push(`政策库暂无${province}已审核通过的政策，政策区排在最后`);
    }
    // 告警有内容时始终置顶（安全优先）
    if (input.hasStationAlerts) moduleOrder = ['stationAlerts', ...moduleOrder.filter(m => m !== 'stationAlerts')];

    const order: Record<Interest, QuickActionId[]> = {
        solar: ['calc', 'storage', 'wind', 'report'],
        wind: ['wind', 'storage', 'calc', 'report'],
        storage: ['storage', 'calc', 'wind', 'report'],
        all: ['calc', 'wind', 'storage', 'report'],
    };

    return {
        personalized: true,
        role,
        roleLabel: role ? ROLE_LABELS[role] : null,
        province,
        provinceSource,
        interest,
        moduleOrder,
        focus: role ? adjustFocusForQuota(focusCard(role, province, interest, tariff, milestones.length, noPolicies), Boolean(input.calcQuotaExhausted), province, reasons) : null,
        quickActionOrder: interest ? order[interest] : [...QUICK_ACTION_IDS],
        tariff,
        policies: related.slice(0, 3).map(p => ({ id: p.id, title: policyTitle(p), docNumber: p.docNumber, sourceUrl: p.sourceUrl, value: p.value, unit: p.unit, region: p.region })),
        milestones,
        tags: prefs.personalized ? (prefs.tags ?? []) : [],
        reasons,
    };
}
