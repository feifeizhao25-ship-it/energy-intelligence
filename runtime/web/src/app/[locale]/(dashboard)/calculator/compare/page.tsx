'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** 旧对比页写死了未核实电价，并把年利润除以投资当成内部收益率。不再展示那些数字。 */
export default function RetiredComparePage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/quick-calc/compare');
    }, [router]);
    return (
        <main className="mx-auto max-w-xl p-6">
            <h1 className="text-xl font-bold">区域对比已换到新页面</h1>
            <p className="mt-2 text-sm text-slate-600">旧页面里的分省电价和内部收益率没有出处，已经停用。正在打开现行的区域对比。</p>
        </main>
    );
}
