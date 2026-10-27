export interface ReportSpec {
    meta: {
        title: string;
        user: string;
        date: string;
        version: string;
        plan: string;
        watermark: string;
    };
    sections: { heading: string; level: number; blocks: { type: string; text?: string }[] }[];
    references: { title: string; source?: string; year?: string }[];
    disclaimers: string[];
    aigc: { label: string };
}

const disclaimer = '本文件为测算或资料汇编，非正式文件。数字是测算值，不构成收益承诺。';

function spec(title: string, blocks: string[]): ReportSpec {
    return {
        meta: { title, user: '示例用户', date: '2026-10-27', version: 'v1', plan: '示例', watermark: '示例' },
        sections: [{ heading: title, level: 1, blocks: blocks.map((text) => ({ type: 'paragraph', text })) }],
        references: [{ title: '发改价格〔2025〕136号', source: '国家发展改革委', year: '2025' }],
        disclaimers: [disclaimer],
        aigc: { label: '人工智能生成合成' },
    };
}

export function calculationReport(): ReportSpec {
    return spec('测算报告', ['首年发电量为测算值，单位千瓦时。', '截至日期见电价来源。']);
}
export function policyBrief(): ReportSpec {
    return spec('政策速读', ['只复述已审核原文中的条款。']);
}
export function dossier(): ReportSpec {
    return spec('资料汇编', ['封面写明资料汇编，非正式文件。']);
}
export function teamWeekly(): ReportSpec {
    return spec('团队周报', ['只统计操作次数，不做排名。']);
}
export function researchAppendix(): ReportSpec {
    return spec('研究附录', ['公式、表和图按出现顺序编号。']);
}
export function studyNote(): ReportSpec {
    return spec('学习作业', ['理解部分由用户自己填写。']);
}

export const REPORT_BUILDERS = [
    calculationReport, policyBrief, dossier, teamWeekly, researchAppendix, studyNote,
];
