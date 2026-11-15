'use client';

import { PageHeader } from '@/components/ui/design-system';
import { resolveDomesticStation } from '@/lib/api/domestic-station';

const LAT = 38.97;
const LNG = 115.46;

export default function SolarSamplePage() {
    const station = resolveDomesticStation(LAT, LNG);
    return (
        <main className="mx-auto min-w-0 max-w-3xl space-y-4">
            <PageHeader
                kicker="运维"
                title="非省会坐标辐照样本"
                crumbs={[{ href: '/dashboard', label: '总览' }, { href: '/ops/solar-sample', label: '辐照样本' }]}
                summary={`请求坐标 ${LAT}, ${LNG}。不访问境外气象，也不新造测站。`}
            />
            {station ? (
                <section className="ei-panel space-y-2 text-sm">
                    <p>匹配：{station.province}{station.city}</p>
                    <p>说明：{station.provenance}</p>
                    <p className="text-[var(--ink-soft)]">{station.station_note}</p>
                    <p className="text-[var(--ink-soft)]">{station.license_note}</p>
                    <p className="tabular-nums">1 月日均水平面辐照样本：{station.monthly_daily_ghi[0].toFixed(3)} kWh/m²</p>
                </section>
            ) : <p className="ei-empty">该坐标的辐照数据尚未加载。</p>}
        </main>
    );
}
