import { SafetySearchInput, SafetySearchResult } from './types-advanced';

/**
 * 安全规程查询（核9，2026-11-23）。
 * 本工具还没有接入标准库或全文检索，所以不假装「检索」：不再有 1.2 秒假延迟和 0.95 这类假相关度，
 * 只列常用标准编号和到全国标准信息公共服务平台核对现行版本的链接，并明确写出 searched: false。
 * GB/T 35694-2017 已被 GB/T 35694-2025 代替（2026-04-01 实施）；GB 26860-2011 现行；DL/T 796-2012 没有核实，标「版本待核实」。
 */
const STD_SEARCH = 'https://std.samr.gov.cn/search/std?q=';

const COMMON: Array<{ title: string; code: string; summary: string; category: 'general' | 'solar' | 'wind'; versionNote: string }> = [
    {
        title: '电力安全工作规程 发电厂和变电站电气部分',
        code: 'GB 26860-2011',
        summary: '发电厂和变电站电气工作人员作业中的安全要求。',
        category: 'general',
        versionNote: '已核对：现行（全国标准信息公共服务平台，2026-11-23）',
    },
    {
        title: '光伏发电站安全规程',
        code: 'GB/T 35694-2025',
        summary: '光伏发电站运行、维护和检修的安全要求；2026-04-01 起实施，代替 GB/T 35694-2017。',
        category: 'solar',
        versionNote: '已核对：2025 版代替 2017 版（全国标准信息公共服务平台，2026-11-23）',
    },
    {
        title: '风力发电场安全规程',
        code: 'DL/T 796-2012',
        summary: '风力发电场运行、检修和维护的安全技术要求。',
        category: 'wind',
        versionNote: '版本待核实，请在标准平台确认是否现行',
    },
];

export async function searchSafetyRegulations(input: SafetySearchInput): Promise<SafetySearchResult> {
    const keyword = input.query || '';
    const wanted = input.category === 'solar' || input.category === 'wind' ? input.category : null;
    return {
        query: keyword,
        searched: false,
        note: '暂无安全规程检索：本工具还没有接入标准库，下面只列常用标准编号，不按问题排序。请点链接到全国标准信息公共服务平台核对现行版本，作业以本单位安规和现行标准原文为准。',
        regulations: COMMON
            .filter((r) => !wanted || r.category === 'general' || r.category === wanted)
            .map((r) => ({
                title: r.title,
                code: r.code,
                summary: r.summary,
                relevance: null,
                link: STD_SEARCH + encodeURIComponent(r.code.replace(/-\d{4}$/, '')),
                versionNote: r.versionNote,
            })),
        procedures: [
            {
                name: '高压倒闸操作通用流程（摘要，以本单位安规为准）',
                steps: [
                    '接受调度指令，复诵无误',
                    '填写操作票，进行模拟预演',
                    '核对设备名称、编号和状态',
                    '监护人唱票，操作人复诵并确认',
                    '执行操作，每一项操作后打勾',
                    '操作结束，汇报调度'
                ]
            },
            {
                name: '有限空间作业通用流程（摘要，以本单位安规为准）',
                steps: [
                    '办理有限空间作业票',
                    '先通风，再检测（氧气、有毒有害气体）',
                    '配备个人防护用品和应急救援设备',
                    '设专人监护，保持联络',
                    '异常情况立即停止作业并撤离'
                ]
            }
        ]
    };
}
