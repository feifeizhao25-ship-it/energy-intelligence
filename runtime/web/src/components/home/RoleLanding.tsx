'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';
import { BuildStamp } from '@/components/layout/BuildStamp';
import { DataTable } from '@/components/ui/DataTable';
import roleTemplates from '@/lib/dashboard/role_templates.json';
import { PRODUCT_ROLES } from '@/lib/dashboard/personalization';

const MODULE_LABEL: Record<string, string> = {
    tariff: '电价',
    focus: '当前关注',
    projects: '项目',
    nextActions: '接下来',
    policies: '政策',
    usage: '额度',
    stationAlerts: '电站告警',
};

const EXPORT_LABEL: Record<string, string> = {
    excel: '表格',
    pdf: '便携文档',
    word: '文档',
    gazette: '公文',
};

type RoleKey = (typeof PRODUCT_ROLES)[number];

export function RoleLanding({
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
    const [role, setRole] = useState<RoleKey>('ci_owner');
    useEffect(() => {
        const value = new URLSearchParams(window.location.search).get('role');
        if (value && value in templates) setRole(value as RoleKey);
    }, [templates]);
    const current = templates[role];
    const rows = PRODUCT_ROLES.map((key) => ({
        role: templates[key].label,
        order: templates[key].modules.map((id) => MODULE_LABEL[id] || id).join('、'),
        depth: templates[key].term_depth,
    }));
    return (
        <PageShell
            title="新能源智库"
            crumbs={[{ href: '/', label: '首页' }]}
            summary="按角色查看已收录的事实、数据和可复核的计算方法。"
            facts={[
                { label: '角色', value: current.label },
                { label: '已收录电价省份', value: String(coveredProvinces) },
                { label: '术语深度', value: current.term_depth },
            ]}
            aside={(
                <div className="space-y-3 text-sm">
                    <p>默认导出：{EXPORT_LABEL[current.export] || '文档'}</p>
                    {current.forbidden_modules?.length ? <p>项目开发不展示排序模块。</p> : null}
                    <Link href="/login" className="block rounded-xl bg-[var(--accent-solid)] px-3 py-2 text-center font-semibold text-white">登录</Link>
                    <Link href="/calculator/solar" className="block rounded-xl border border-[var(--line)] px-3 py-2 text-center">光伏测算</Link>
                    <Link href="/pricing" className="block rounded-xl border border-[var(--line)] px-3 py-2 text-center">档位说明</Link>
                    <BuildStamp />
                </div>
            )}
        >
            <div className="space-y-4" data-testid="role-landing">
                <div className="flex flex-wrap gap-2">
                    {PRODUCT_ROLES.map((key) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setRole(key)}
                            className={key === role ? 'ei-tab is-on' : 'ei-tab'}
                            aria-pressed={key === role}
                        >
                            {templates[key].label}
                        </button>
                    ))}
                </div>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                    {current.modules.map((id) => <li key={id}>{MODULE_LABEL[id] || id}</li>)}
                </ol>
                <div className="grid gap-3 sm:grid-cols-3" data-testid="home-pricing">
                    {plans.map((plan) => (
                        <section key={plan.name} className="ei-panel">
                            <h2 className="font-semibold">{plan.name}</h2>
                            <p className="mt-1 text-sm">{plan.price}</p>
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
            </div>
        </PageShell>
    );
}
