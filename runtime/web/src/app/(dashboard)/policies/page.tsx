'use client';

import { PolicyTools } from '@/components/policy/PolicyTools';
import { PageHeader } from '@/components/ui/design-system';

export default function PoliciesPage() {
    return (
        <main className="mx-auto min-w-0 max-w-5xl space-y-4">
            <PageHeader
                kicker="政策"
                title="政策检索"
                crumbs={[{ href: '/dashboard', label: '总览' }, { href: '/policies', label: '政策' }]}
                summary="可以按日期回看当时生效的版本，也可以看同省同角色的示例浏览。人数不足的分组不展示。"
            />
            <PolicyTools title="政策原文" docNumber={null} supersededBy={null} />
        </main>
    );
}
