import React from 'react';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';

const object = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const display = (value: unknown, unit: string, empty = '暂无可确认数值') => typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('zh-CN', { maximumFractionDigits: 3 })}${unit}` : empty;
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('zh-CN', { timeZone: 'UTC' }) : '未记录';

export default async function SnapshotPage({ params }: { params: Promise<{ snapshotId: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) redirect('/login');
    const { snapshotId } = await params;
    let snapshot;
    try {
        snapshot = await prisma.calculationSnapshot.findFirst({ where: { id: snapshotId, userId: session.user.id } });
    } catch {
        return <p role="alert" className="p-8 text-center">计算记录暂时无法读取，请稍后重试。</p>;
    }
    if (!snapshot) return <p className="p-8 text-center">计算记录不存在或无法访问。</p>;
    const output = object(snapshot.outputSnapshot);
    const trace = object(snapshot.calculationTrace);
    const assumptions = object(trace.assumptions);
    const evidence = object(snapshot.dataEvidence);
    const solar = object(object(evidence.dataProvenance).solarResource);
    const coverage = object(solar.temporalCoverage);
    const risks = Array.isArray(snapshot.risks) ? snapshot.risks.filter((v): v is string => typeof v === 'string') : [];
    return <main className="mx-auto max-w-4xl space-y-6 px-5 py-10 text-slate-800">
        <Link href="/audit" className="text-sm text-blue-600">返回我的计算记录</Link>
        <header className="rounded-2xl bg-slate-900 p-6 text-white">
            <p className="text-sm text-amber-200">已保存的计算快照</p>
            <h1 className="mt-2 text-2xl font-bold">{snapshot.calcType === 'SOLAR_REVENUE' ? '光伏初步估算记录' : '计算记录'}</h1>
            <p className="mt-3 text-sm leading-7 text-slate-300">这里展示当时保存的结果和依据，不重新计算，也不计入新的测算次数。保存记录不代表通过工程审计或金融评审。</p>
        </header>
        <div className="space-y-2 break-all rounded-2xl border p-5 text-sm">
            <p>记录编号：{snapshot.id}</p>
            <p>保存时间：{snapshot.createdAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}（北京时间）</p>
            <p>计算版本：{snapshot.calcVersion}；假设版本：{snapshot.assumptionVersion}</p>
        </div>
        {snapshot.calcType === 'SOLAR_REVENUE' ? <section aria-label="已保存的光伏结果" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
                ['初始投资', display(output.initialInvestment, ' 元')],
                ['首年估算发电量', display(output.annualGeneration, ' 度')],
                ['静态回收期', display(output.paybackPeriod, ' 年', output.paybackPeriod === null ? '估算期内未回本' : undefined)],
                ['内部收益率', display(output.irr, '%', output.irr === null ? '无法确认唯一值' : undefined)],
                ['净现值', display(output.npv, ' 元')],
                ['平准化度电成本', display(output.lcoe, ' 元／度')],
            ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 break-words font-semibold">{value}</p></div>)}
        </section> : <p>该类型记录暂未提供专用结果排版。</p>}
        <section className="space-y-3 rounded-2xl border p-5 text-sm leading-7">
            <h2 className="font-bold">保存时的数据依据</h2>
            <p>历史辐照覆盖期：{date(coverage.start)} 至 {date(coverage.end)}；获取日期：{date(solar.timestamp)}（日期按协调世界时显示）。</p>
            <p>估算期：{display(assumptions.lifetime, ' 年')}。输入电价为用户填写，未作为已核验政策展示。</p>
            <p>本页读取已存数据，不代表数据已更新到今天；新决策前请重新核对实际价格、设备和现场条件。</p>
            {risks.length > 0 && <ul className="list-disc space-y-2 pl-5">{risks.map((risk, index) => <li key={index}>{risk}</li>)}</ul>}
        </section>
    </main>;
}
