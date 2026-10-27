import { PageShell } from '@/components/layout/PageShell';
import { BuildStamp } from '@/components/layout/BuildStamp';
import { MermaidBlock } from '@/components/ai/MermaidBlock';
import { MediaFrame } from '@/components/media/MediaFrame';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataTable } from '@/components/ui/DataTable';

const flow = [
    'flowchart TD',
    '准备[准备材料] --> 提交[提交审批]',
    '提交 --> 待审[待企业微信审批]',
].join('\n');

const rows = [
    { name: '电价', state: '有效' },
    { name: '政策', state: '有效' },
    { name: '标准', state: '临近复核' },
    { name: '辐照', state: '示例' },
    { name: '文献', state: '元数据' },
    { name: '因子', state: '有效' },
    { name: '地图', state: '索引' },
    { name: '节假日', state: '已收录' },
];

export default function P2PreviewPage() {
    return (
        <PageShell
            sample
            summary="这一页集中看流程图、表格、图片标识和没有数据时的下一步。"
            facts={[
                { label: '表格', value: '默认六行' },
                { label: '流程图', value: '严格模式' },
                { label: '生成标识', value: '已标明' },
            ]}
            aside={<BuildStamp />}
        >
            <div className="space-y-4">
                <MermaidBlock source={flow} />
                <DataTable
                    columns={[{ key: 'name', label: '名称' }, { key: 'state', label: '状态' }]}
                    rows={rows}
                />
                <MediaFrame alt="示例电站屋顶" src="/icons/icon-192x192.png" generated />
                <EmptyState title="这里还没有项目" />
            </div>
        </PageShell>
    );
}
