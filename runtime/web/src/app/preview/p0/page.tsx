import { ExplainLayer } from '@/components/explain/ExplainLayer';
import { FreshnessBadge } from '@/components/freshness/FreshnessBadge';
import { EntitlementQuotaPanel } from '@/components/membership/EntitlementQuotaPanel';
import { ProvinceBlockChart } from '@/components/map/ProvinceBlockChart';

/** 截图用的公开页。数字都标成示例数据，组件与正式页相同。 */
export default function PreviewPage() {
    return (
        <main className="min-h-screen space-y-6 bg-slate-950 p-6 text-slate-100">
            <h1 className="text-2xl font-bold">国内版核对页</h1>
            <p className="text-sm text-amber-300">示例数据。正式电价、政策原文和审图号尚未连接。</p>
            <ExplainLayer
                sample
                fact="年发电量 120000 kWh，按示例输入算出。"
                method="年发电量等于倾斜面年辐照乘装机容量乘综合效率系数。"
                sources={[
                    { title: '光伏发电站设计标准（2024 年版）', locator: '6.6', status: '待核验' },
                    { title: '未绑定原文', status: '不支持' },
                ]}
            />
            <FreshnessBadge asOf={null} intervalDays={90} />
            <EntitlementQuotaPanel
                sample
                rows={[
                    { label: '测算', used: 1, total: 3, resetLabel: '明天 00:00 重置' },
                    { label: '文献检索', used: 0, total: null, resetLabel: '总量尚未连接' },
                ]}
            />
            <section data-testid="calc-citations" className="rounded-2xl border border-slate-700 p-4">
                <h2 className="font-bold">测算与出处</h2>
                <p className="mt-2 text-sm">装机 100 kW。来源：本页假设。状态：待核验。</p>
                <p className="mt-2 text-sm">未在已收录原文中找到出处</p>
            </section>
            <ProvinceBlockChart />
        </main>
    );
}
