import { PageShell } from '@/components/layout/PageShell';
import { Term } from '@/components/glossary/Term';
import { CalloutView } from '@/components/ai/CalloutView';
import { ChartSpecView } from '@/components/charts/ChartSpecView';
import AiMarkdown from '@/components/ai/AiMarkdown';
import { FreshnessBoard } from '@/components/ops/FreshnessBoard';
import { ReadingModePanel } from '@/components/calculator/ReadingModePanel';
import { BuildStamp } from '@/components/layout/BuildStamp';

const chart = {
    type: 'bar' as const,
    title: '分月发电量',
    unit: '千瓦时',
    series: [{ name: '示例', data: [120, 140, 160, 150] }],
};

const markdown = `下面用框标出定义和注意。
:::定义
机制电量是文件里写明、按机制结算的上网电量。
:::
:::注意
测算值不是承诺。数字要带来源和截至日期。
:::
`;

export default function P1PreviewPage() {
    return (
        <PageShell
            sample
            summary="这是国内版新界面的预览：事实、数据和可复核的计算方法。"
            facts={[
                { label: '装机', value: '10 千瓦' },
                { label: '省份', value: '山东' },
                { label: '截至', value: '2026-10-27' },
            ]}
            aside={<FreshnessBoard rows={[
                { name: '电价', status: '未达标', asOf: '2026-10-20' },
                { name: '政策', status: '达标', asOf: '2026-10-27' },
                { name: '因子', status: '未达标', asOf: '2025-12-31' },
            ]} escalated={['电价']} />}
        >
            <div className="space-y-4">
                <ReadingModePanel />
                <p className="text-sm leading-6 text-[var(--ink)]">第一次出现的<Term name="机制电量" open />可以展开解释。</p>
                <CalloutView markdown={markdown} />
                <AiMarkdown content="年发电量 $E = H × P × K$。" />
                <ChartSpecView source={chart} />
                <BuildStamp />
            </div>
        </PageShell>
    );
}
