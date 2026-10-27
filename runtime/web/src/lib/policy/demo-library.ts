import { visibleCohorts, type CohortGroup, type VersionedRecord } from '@/lib/policy/as-of';

/** 演示条目只复述已收录来源的文号和生效日，页面必须标明「示例」。 */
export const DEMO_POLICIES: Array<VersionedRecord & {
    title: string;
    doc_number: string;
    region: string;
    source_url: string;
}> = [
    {
        source_id: 'policy-cn-136',
        title: '关于深化新能源上网电价市场化改革 促进新能源高质量发展的通知',
        doc_number: '发改价格〔2025〕136号',
        region: '全国',
        source_url: 'https://www.ndrc.gov.cn/xxgk/zcfb/tz/202502/t20250209_1396066.html',
        effective_date: '2025-02-09',
        expiry_date: null,
        superseded_by: null,
    },
    {
        source_id: 'policy-cn-688',
        title: '关于有序推动多用户绿电直连的通知',
        doc_number: '发改能源〔2026〕688号',
        region: '全国',
        source_url: 'https://www.nea.gov.cn/20260520/9e1c4277ce324c8ab82a84da98da7980/c.html',
        effective_date: '2026-05-20',
        expiry_date: null,
        superseded_by: null,
    },
];

export const DEMO_COHORTS: CohortGroup[] = [
    { province: '江苏', role: '项目开发', count: 20, items: ['政策原文'] },
    { province: '山东', role: '工商业业主', count: 19, items: ['电价'] },
];

export function demoCohorts() {
    return {
        sample: true,
        note: '示例分组，不是线上统计。人数少于 20 的分组不展示。',
        groups: visibleCohorts(DEMO_COHORTS),
    };
}
