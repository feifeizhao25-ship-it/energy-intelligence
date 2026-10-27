import { FreshnessBoard } from '@/components/ops/FreshnessBoard';
import { PageShell } from '@/components/layout/PageShell';

export default function FreshnessPage() {
    return (
        <PageShell
            sample
            summary="这里汇总电价、政策和排放因子是否还在有效期内。"
            facts={[
                { label: '电价', value: '未达标' },
                { label: '政策', value: '达标' },
                { label: '升级', value: '连续两天' },
            ]}
            aside={<p className="rounded-xl border border-[var(--line)] p-3 text-sm leading-6">告警只在企业微信密钥齐全时发出。没有密钥就只写本地记录。</p>}
        >
            <FreshnessBoard rows={[
                { name: '电价', status: '未达标', asOf: '2026-10-20' },
                { name: '政策', status: '达标', asOf: '2026-10-27' },
                { name: '因子', status: '未达标', asOf: '2025-12-31' },
            ]} escalated={['电价']} />
        </PageShell>
    );
}
