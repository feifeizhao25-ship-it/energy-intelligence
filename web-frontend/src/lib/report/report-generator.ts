// 报告模板系统
// 护城河：一键生成可交付的专业报告

import type { ConclusionCard, DiagnosticSummary } from './audit/conclusion-card';
import type { CalibrationStandard } from './audit/types';
import { getCalibrations } from './audit/calibrations';

/**
 * 报告类型
 */
export type ReportType =
    | 'FEASIBILITY_SUMMARY'    // 可研摘要
    | 'INVESTMENT_ANALYSIS'    // 投资分析报告
    | 'SITE_COMPARISON'        // 站址比选报告
    | 'MONTHLY_OPERATION'      // 月度运维报告
    | 'ANNUAL_REVIEW'          // 年度复盘报告
    | 'DIAGNOSIS_REPORT'       // 诊断分析报告
    | 'ABNORMAL_REVIEW'        // 异常复盘报告
    | 'EXECUTIVE_SUMMARY'      // 执行摘要（一页纸）
    ;

/**
 * 报告元数据
 */
export interface ReportMeta {
    id: string;
    type: ReportType;
    title: string;
    subtitle?: string;
    projectName: string;
    projectId: string;
    generatedAt: string;
    generatedBy: string;
    version: string;
    confidentiality: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET';
    watermark?: string;
    expiresAt?: string;
    auditIds: string[]; // 关联的审计记录
}

/**
 * 报告结构
 */
export interface Report {
    meta: ReportMeta;
    sections: ReportSection[];
    appendices?: ReportAppendix[];
    glossary?: CalibrationStandard[];
    signature?: {
        preparedBy: string;
        reviewedBy?: string;
        approvedBy?: string;
        date: string;
    };
}

/**
 * 报告章节
 */
export interface ReportSection {
    id: string;
    title: string;
    order: number;
    content: string; // Markdown 或 HTML
    charts?: ReportChart[];
    tables?: ReportTable[];
    highlights?: string[];
    riskWarnings?: string[];
    dataRefs?: string[]; // 数据来源引用
}

/**
 * 报告图表
 */
export interface ReportChart {
    id: string;
    type: 'LINE' | 'BAR' | 'PIE' | 'AREA' | 'GAUGE' | 'TABLE';
    title: string;
    data: unknown;
    config?: Record<string, unknown>;
}

/**
 * 报告表格
 */
export interface ReportTable {
    id: string;
    title: string;
    headers: string[];
    rows: Array<Array<string | number>>;
    footer?: Array<string | number>;
    notes?: string;
}

/**
 * 报告附件
 */
export interface ReportAppendix {
    id: string;
    title: string;
    type: 'PARAMETER_TABLE' | 'CASHFLOW' | 'RAW_DATA' | 'REFERENCE';
    content: unknown;
}

/**
 * 报告模板定义
 */
const REPORT_TEMPLATES: Record<ReportType, {
    title: string;
    sections: Array<{ id: string; title: string }>;
}> = {
    FEASIBILITY_SUMMARY: {
        title: '项目可行性摘要',
        sections: [
            { id: 'overview', title: '项目概况' },
            { id: 'resource', title: '资源评估' },
            { id: 'technical', title: '技术方案' },
            { id: 'financial', title: '财务分析' },
            { id: 'risk', title: '风险分析' },
            { id: 'conclusion', title: '结论与建议' },
        ],
    },
    INVESTMENT_ANALYSIS: {
        title: '投资分析报告',
        sections: [
            { id: 'executive', title: '执行摘要' },
            { id: 'market', title: '市场分析' },
            { id: 'technical', title: '技术方案' },
            { id: 'financial', title: '财务预测' },
            { id: 'sensitivity', title: '敏感性分析' },
            { id: 'risk', title: '风险评估' },
            { id: 'recommendation', title: '投资建议' },
        ],
    },
    SITE_COMPARISON: {
        title: '站址比选报告',
        sections: [
            { id: 'overview', title: '比选概述' },
            { id: 'sites', title: '备选站址' },
            { id: 'resource_compare', title: '资源对比' },
            { id: 'economics_compare', title: '收益对比' },
            { id: 'risk_compare', title: '风险对比' },
            { id: 'recommendation', title: '推荐方案' },
        ],
    },
    MONTHLY_OPERATION: {
        title: '月度运维报告',
        sections: [
            { id: 'summary', title: '本月概况' },
            { id: 'generation', title: '发电分析' },
            { id: 'performance', title: '性能分析' },
            { id: 'events', title: '事件记录' },
            { id: 'maintenance', title: '维护工作' },
            { id: 'next_month', title: '下月计划' },
        ],
    },
    ANNUAL_REVIEW: {
        title: '年度复盘报告',
        sections: [
            { id: 'highlights', title: '年度亮点' },
            { id: 'generation', title: '发电完成情况' },
            { id: 'revenue', title: '收益完成情况' },
            { id: 'performance', title: '性能趋势分析' },
            { id: 'comparison', title: '同比环比分析' },
            { id: 'issues', title: '问题与改进' },
            { id: 'outlook', title: '明年展望' },
        ],
    },
    DIAGNOSIS_REPORT: {
        title: '诊断分析报告',
        sections: [
            { id: 'summary', title: '诊断摘要' },
            { id: 'findings', title: '问题发现' },
            { id: 'evidence', title: '证据链' },
            { id: 'analysis', title: '原因分析' },
            { id: 'actions', title: '建议措施' },
            { id: 'economics', title: '经济影响' },
        ],
    },
    ABNORMAL_REVIEW: {
        title: '异常复盘报告',
        sections: [
            { id: 'event', title: '事件描述' },
            { id: 'timeline', title: '时间线' },
            { id: 'impact', title: '影响评估' },
            { id: 'rootcause', title: '根因分析' },
            { id: 'resolution', title: '处置措施' },
            { id: 'prevention', title: '预防建议' },
        ],
    },
    EXECUTIVE_SUMMARY: {
        title: '执行摘要',
        sections: [
            { id: 'key_metrics', title: '关键指标' },
            { id: 'conclusion', title: '核心结论' },
            { id: 'recommendation', title: '决策建议' },
        ],
    },
};

/**
 * 生成报告
 */
export async function generateReport(params: {
    type: ReportType;
    projectId: string;
    projectName: string;
    userId: string;
    userName: string;
    conclusionCard?: ConclusionCard;
    diagnosticSummary?: DiagnosticSummary;
    data: Record<string, unknown>;
    confidentiality?: Report['meta']['confidentiality'];
    watermark?: string;
}): Promise<Report> {
    const template = REPORT_TEMPLATES[params.type];
    const now = new Date();

    const meta: ReportMeta = {
        id: `RPT-${now.getTime().toString(36)}`,
        type: params.type,
        title: template.title,
        subtitle: params.projectName,
        projectName: params.projectName,
        projectId: params.projectId,
        generatedAt: now.toISOString(),
        generatedBy: params.userName,
        version: '1.0',
        confidentiality: params.confidentiality || 'INTERNAL',
        watermark: params.watermark,
        auditIds: params.conclusionCard ? [params.conclusionCard.audit.auditId] : [],
    };

    // 根据模板生成章节
    const sections: ReportSection[] = template.sections.map((sec, index) => ({
        id: sec.id,
        title: sec.title,
        order: index + 1,
        content: generateSectionContent(sec.id, params),
        charts: generateSectionCharts(sec.id, params.data),
        tables: generateSectionTables(sec.id, params.data),
    }));

    // 收集使用的口径
    const calibrationIds = params.conclusionCard?.calibrations || ['IRR', 'PR', 'LCOE'];
    const glossary = getCalibrations(calibrationIds);

    return {
        meta,
        sections,
        glossary,
        signature: {
            preparedBy: params.userName,
            date: now.toISOString().split('T')[0],
        },
    };
}

/**
 * 生成章节内容
 */
function generateSectionContent(
    sectionId: string,
    params: { conclusionCard?: ConclusionCard; diagnosticSummary?: DiagnosticSummary; data: Record<string, unknown> }
): string {
    const { conclusionCard, diagnosticSummary, data } = params;

    switch (sectionId) {
        case 'executive':
        case 'summary':
        case 'overview':
            if (conclusionCard) {
                return `## 核心结论\n\n${conclusionCard.headline}\n\n${conclusionCard.summary}`;
            }
            if (diagnosticSummary) {
                return `## 诊断结论\n\n**状态**: ${diagnosticSummary.status}\n\n${diagnosticSummary.headline}\n\n${diagnosticSummary.analysis}`;
            }
            return '待填写项目概况...';

        case 'key_metrics':
            if (conclusionCard) {
                const metricsText = conclusionCard.keyMetrics
                    .map(m => `- **${m.name}**: ${m.value} ${m.unit || ''}`)
                    .join('\n');
                return `## 关键指标\n\n${metricsText}`;
            }
            return '待填写关键指标...';

        case 'conclusion':
        case 'recommendation':
            if (conclusionCard) {
                const stepsText = conclusionCard.nextSteps
                    .map((s, i) => `${i + 1}. ${s.action}: ${s.description}`)
                    .join('\n');
                return `## 结论与建议\n\n**投资评级**: ${conclusionCard.recommendation.level}\n\n**理由**: ${conclusionCard.recommendation.reason}\n\n### 下一步建议\n\n${stepsText}`;
            }
            return '待填写结论与建议...';

        case 'risk':
            if (conclusionCard?.risks.length) {
                const risksText = conclusionCard.risks
                    .map(r => `- **[${r.level}]** ${r.message}`)
                    .join('\n');
                return `## 风险分析\n\n${risksText}`;
            }
            return '暂无重大风险提示。';

        case 'findings':
            if (diagnosticSummary) {
                const findingsText = diagnosticSummary.findings
                    .map(f => `- **[${f.severity}]** ${f.issue}\n  - 证据: ${f.evidence.join(', ')}`)
                    .join('\n');
                return `## 问题发现\n\n${findingsText}`;
            }
            return '未发现异常。';

        case 'actions':
            if (diagnosticSummary) {
                const actionsText = diagnosticSummary.prioritizedActions
                    .map(a => `${a.priority}. **${a.action}** (${a.urgency})\n   ${a.description}`)
                    .join('\n\n');
                return `## 建议措施\n\n${actionsText}`;
            }
            return '无需采取措施。';

        default:
            return `待填写 ${sectionId} 内容...`;
    }
}

/**
 * 生成章节图表
 */
function generateSectionCharts(sectionId: string, data: Record<string, unknown>): ReportChart[] {
    // 根据章节类型生成对应图表
    if (sectionId === 'financial' && data.cashflow) {
        return [{
            id: 'cashflow_chart',
            type: 'BAR',
            title: '25年现金流预测',
            data: data.cashflow,
        }];
    }

    if (sectionId === 'generation' && data.monthlyGeneration) {
        return [{
            id: 'generation_chart',
            type: 'LINE',
            title: '月度发电量',
            data: data.monthlyGeneration,
        }];
    }

    if (sectionId === 'performance' && data.prTrend) {
        return [{
            id: 'pr_trend_chart',
            type: 'LINE',
            title: 'PR趋势',
            data: data.prTrend,
        }];
    }

    return [];
}

/**
 * 生成章节表格
 */
function generateSectionTables(sectionId: string, data: Record<string, unknown>): ReportTable[] {
    if (sectionId === 'key_metrics' && data.metrics) {
        const metrics = data.metrics as Array<{ name: string; value: unknown; unit: string }>;
        return [{
            id: 'metrics_table',
            title: '核心指标汇总',
            headers: ['指标', '数值', '单位', '基准'],
            rows: metrics.map(m => [m.name, String(m.value), m.unit, '-']),
        }];
    }

    return [];
}

/**
 * 导出报告为不同格式
 */
export async function exportReport(
    report: Report,
    format: 'PDF' | 'WORD' | 'EXCEL' | 'HTML' | 'MARKDOWN'
): Promise<{ url: string; filename: string }> {
    const filename = `${report.meta.title}_${report.meta.projectName}_${new Date().toISOString().split('T')[0]}`;

    switch (format) {
        case 'MARKDOWN':
            // 直接生成 Markdown
            const md = reportToMarkdown(report);
            // TODO: 保存并返回 URL
            return { url: `/reports/${report.meta.id}.md`, filename: `${filename}.md` };

        case 'PDF':
            // TODO: 调用 PDF 生成服务
            return { url: `/reports/${report.meta.id}.pdf`, filename: `${filename}.pdf` };

        case 'WORD':
            // TODO: 调用 Word 生成服务
            return { url: `/reports/${report.meta.id}.docx`, filename: `${filename}.docx` };

        case 'EXCEL':
            // TODO: 调用 Excel 生成服务
            return { url: `/reports/${report.meta.id}.xlsx`, filename: `${filename}.xlsx` };

        case 'HTML':
            // TODO: 调用 HTML 生成服务
            return { url: `/reports/${report.meta.id}.html`, filename: `${filename}.html` };

        default:
            throw new Error(`Unsupported format: ${format}`);
    }
}

/**
 * 报告转 Markdown
 */
function reportToMarkdown(report: Report): string {
    const lines: string[] = [];

    // 标题
    lines.push(`# ${report.meta.title}`);
    if (report.meta.subtitle) {
        lines.push(`## ${report.meta.subtitle}`);
    }
    lines.push('');

    // 元信息
    lines.push(`> 生成时间: ${report.meta.generatedAt}`);
    lines.push(`> 编制人: ${report.meta.generatedBy}`);
    lines.push(`> 报告版本: ${report.meta.version}`);
    lines.push('');

    // 章节
    for (const section of report.sections) {
        lines.push(`## ${section.order}. ${section.title}`);
        lines.push('');
        lines.push(section.content);
        lines.push('');

        // 亮点
        if (section.highlights?.length) {
            lines.push('### 亮点');
            section.highlights.forEach(h => lines.push(`- ${h}`));
            lines.push('');
        }

        // 风险
        if (section.riskWarnings?.length) {
            lines.push('### ⚠️ 风险提示');
            section.riskWarnings.forEach(r => lines.push(`- ${r}`));
            lines.push('');
        }
    }

    // 术语表
    if (report.glossary?.length) {
        lines.push('## 附录: 术语说明');
        lines.push('');
        for (const term of report.glossary) {
            lines.push(`**${term.name} (${term.abbr})**`);
            lines.push(`- 定义: ${term.definition}`);
            lines.push(`- 公式: \`${term.formula}\``);
            lines.push(`- 参考: ${term.reference}`);
            lines.push('');
        }
    }

    // 签名
    if (report.signature) {
        lines.push('---');
        lines.push(`编制: ${report.signature.preparedBy}`);
        if (report.signature.reviewedBy) {
            lines.push(`审核: ${report.signature.reviewedBy}`);
        }
        if (report.signature.approvedBy) {
            lines.push(`批准: ${report.signature.approvedBy}`);
        }
        lines.push(`日期: ${report.signature.date}`);
    }

    return lines.join('\n');
}
