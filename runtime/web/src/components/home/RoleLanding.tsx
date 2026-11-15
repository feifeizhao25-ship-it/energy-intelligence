'use client';

import Link from 'next/link';
import {
    Bell,
    FolderKanban,
    Gauge,
    Landmark,
    ListChecks,
    Plug,
    Target,
    type LucideIcon,
} from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { AppChrome } from '@/components/layout/AppChrome';
import { DataTable } from '@/components/ui/DataTable';
import { HomeAside } from '@/components/home/HomeAside';
import roleTemplates from '@/lib/dashboard/role_templates.json';
import { PRODUCT_ROLES, ROLE_LABELS, ROLE_MODULE_ORDER } from '@/lib/dashboard/personalization';
import { isKnownRole, landingTemplateRole } from '@/lib/dashboard/visible-role';
import { useRolePreference } from '@/components/layout/RolePreference';

const MODULES: Record<string, { label: string; description: string; href: string; icon: LucideIcon }> = {
    tariff: { label: '电价', description: '已收录省份的分时参考价和截至日期。', href: '/pricing', icon: Plug },
    focus: { label: '当前关注', description: '按当前角色整理的事实入口。', href: '/dashboard', icon: Target },
    projects: { label: '项目', description: '已保存的项目和测算记录。', href: '/projects', icon: FolderKanban },
    nextActions: { label: '接下来', description: '还缺哪些输入才能继续核对。', href: '/dashboard', icon: ListChecks },
    policies: { label: '政策', description: '已审核政策，可按日期回看。', href: '/policies', icon: Landmark },
    usage: { label: '额度', description: '当前档位的查询和导出次数。', href: '/membership', icon: Gauge },
    stationAlerts: { label: '电站告警', description: '只显示已接入电站的状态。', href: '/alerts', icon: Bell },
};

const EXPORT_LABEL: Record<string, string> = {
    excel: '表格',
    pdf: '便携文档',
    word: '文档',
    gazette: '公文',
};

type RoleKey = (typeof PRODUCT_ROLES)[number];

function RoleLandingBody({
    coveredProvinces,
    plans = [],
}: {
    coveredProvinces: number;
    plans?: { name: string; price: string; features: string[] }[];
}) {
    const templates = roleTemplates.roles as Record<RoleKey, {
        label: string;
        modules: string[];
        term_depth: string;
        export: string;
        forbidden_modules?: string[];
    }>;
    const { role, ready } = useRolePreference();
    const templateKey = landingTemplateRole(isKnownRole(role) ? role : null);
    const current = templateKey ? templates[templateKey] : null;
    const moduleIds = current?.modules ?? ROLE_MODULE_ORDER.default;
    const rows = PRODUCT_ROLES.map((key) => ({
        role: templates[key].label,
        order: templates[key].modules.map((id) => MODULES[id]?.label || id).join('、'),
        depth: templates[key].term_depth,
    }));
    return (
        <PageShell
            title="新能源智库"
            crumbs={[{ href: '/', label: '首页' }]}
            summary="按角色查看已收录的事实、数据和可复核的计算方法。"
            facts={[
                { label: '角色', value: !ready && !role ? '读取中' : (role ? (isKnownRole(role) ? ROLE_LABELS[role] : role) : '未选择') },
                { label: '已收录电价省份', value: String(coveredProvinces) },
                { label: '术语深度', value: current?.term_depth ?? '未设置' },
            ]}
            aside={<HomeAside />}
        >
            <div className="space-y-4" data-testid="role-landing">
                <p className="text-xs text-[var(--ink-soft)]">
                    {current
                        ? `默认导出：${EXPORT_LABEL[current.export] || '文档'}${current.forbidden_modules?.length ? '。项目开发不展示排序模块。' : ''}`
                        : '还没有读取到已保存的角色。'}
                </p>
                <div className="ei-role-modules">
                    {moduleIds.map((id) => {
                        const item = MODULES[id] || { label: id, description: '入口说明待补充。', href: '/dashboard', icon: Target };
                        const Icon = item.icon;
                        return (
                            <Link key={id} href={item.href} data-module={id} className="ei-tile">
                                <span className="ei-tile-icon" aria-hidden="true"><Icon className="h-4 w-4" /></span>
                                <span>
                                    <span className="block text-sm font-semibold">{item.label}</span>
                                    <span className="mt-1 block text-xs leading-5 text-[var(--ink-soft)]">{item.description}</span>
                                </span>
                            </Link>
                        );
                    })}
                </div>
                <div className="grid gap-3 sm:grid-cols-3" data-testid="home-pricing">
                    {plans.map((plan) => (
                        <section key={plan.name} className="ei-panel">
                            <h2 className="font-semibold">{plan.name}</h2>
                            <p className="mt-1 text-sm tabular-nums">{plan.price}</p>
                            <ul className="mt-2 space-y-1 text-xs text-[var(--ink-soft)]">
                                {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                            </ul>
                        </section>
                    ))}
                </div>
                <DataTable
                    columns={[
                        { key: 'role', label: '角色' },
                        { key: 'order', label: '模块顺序' },
                        { key: 'depth', label: '术语深度' },
                    ]}
                    rows={rows}
                />
                <p className="text-xs text-[var(--ink-soft)]">
                    <Link href="/login" className="underline-offset-2 hover:underline">登录</Link>
                    {' · '}
                    <Link href="/pricing" className="underline-offset-2 hover:underline">档位说明</Link>
                </p>
            </div>
        </PageShell>
    );
}

export function RoleLanding(props: {
    coveredProvinces: number;
    plans?: { name: string; price: string; features: string[] }[];
}) {
    return (
        <AppChrome>
            <RoleLandingBody {...props} />
        </AppChrome>
    );
}
