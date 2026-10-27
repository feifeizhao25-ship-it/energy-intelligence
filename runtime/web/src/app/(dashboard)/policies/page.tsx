'use client';

import { PolicyTools } from '@/components/policy/PolicyTools';

export default function PoliciesPage() {
    return (
        <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
            <h1 className="text-2xl font-bold">政策检索</h1>
            <p className="text-sm text-slate-600">可以按日期回看当时生效的版本，也可以看同省同角色的示例浏览。人数不足的分组不展示。</p>
            <PolicyTools title="政策原文" docNumber={null} supersededBy={null} />
        </main>
    );
}
