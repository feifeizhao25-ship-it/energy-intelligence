'use client';

import { resolveDomesticStation } from '@/lib/api/domestic-station';

const LAT = 38.97;
const LNG = 115.46;

export default function SolarSamplePage() {
    const station = resolveDomesticStation(LAT, LNG);
    return <main className="mx-auto max-w-3xl space-y-3 p-6">
        <h1 className="text-2xl font-bold">非省会坐标辐照样本</h1>
        <p className="text-sm text-slate-600">请求坐标 {LAT}, {LNG}。不访问 NASA，也不新造测站。</p>
        {station ? <section className="rounded-xl border p-4 space-y-2">
            <p>匹配：{station.province}{station.city}</p>
            <p>说明：{station.provenance}</p>
            <p className="text-sm text-slate-600">{station.station_note}</p>
            <p className="text-sm text-slate-600">{station.license_note}</p>
            <p className="text-sm">1 月日均水平面辐照样本：{station.monthly_daily_ghi[0].toFixed(3)} kWh/m²</p>
        </section> : <p>该坐标的辐照数据尚未加载。</p>}
    </main>;
}
