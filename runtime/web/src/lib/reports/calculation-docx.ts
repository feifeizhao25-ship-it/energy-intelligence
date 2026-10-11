/**
 * Word（.docx）测算报告。内容与 PDF 报告（components/calculator/InvestmentReport.tsx）同一来源：
 * 数字取 extractReportFigures，结论取 reportConclusion，编号取 reportNumber。
 *
 * 标识：报告本身由规则引擎计算，不含 AI 生成文字时注明「规则引擎测算，未含 AI 生成文字」；
 * 传入 aiAnalysis 时，正文显式标注【AI 辅助生成】，文档属性（关键词、描述、自定义属性）同时写入 AI 生成标识与报告编号。
 * 浏览器与 Node 都能生成（docx 库），浏览器用 Packer.toBlob，测试用 Packer.toBuffer。
 */
import {
    AlignmentType, BorderStyle, Document, Footer, HeadingLevel, Packer, PageNumber, Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';
import {
    REPORT_TITLE, REPORT_DISCLAIMER, NOT_FILLED,
    reportConclusion, reportNumber, degradationText, displayOrNotFilled, extractReportFigures, typeLabelOf, capacityUnitOf,
} from './calculation-report';
import { co2AvoidedTonnes, EMISSION_FACTOR_NOTE, GRID_EMISSION_FACTOR } from '@/lib/standards/emission-factor';
import { priceAsOfText } from '@/lib/pricing/tariffs';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const AI_LABEL_TEXT = '【AI 辅助生成】本节文字由人工智能生成，可能存在错误，请核实后使用。';

const FONT = '微软雅黑';
const money = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v).toLocaleString('zh-CN') : '—');

function text(value: string, opts: { bold?: boolean; size?: number; color?: string } = {}) {
    return new TextRun({ text: value, font: FONT, bold: opts.bold, size: opts.size ?? 21, color: opts.color });
}
function para(value: string, opts: { bold?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
    return new Paragraph({ children: [text(value, opts)], alignment: opts.align, spacing: { after: 120 } });
}
function heading(value: string) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [text(value, { bold: true, size: 26 })], spacing: { before: 240, after: 120 } });
}
const border = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
function table(rows: string[][]) {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
        rows: rows.map((cells, r) => new TableRow({
            children: cells.map(c => new TableCell({ children: [new Paragraph({ children: [text(c, { bold: r === 0, size: 19 })] })] })),
        })),
    });
}

export interface DocxReportOptions {
    aiAnalysis?: string | null;
    generatedAt?: Date;
}

export function buildCalculationDocx(data: any, type: string, options: DocxReportOptions = {}): Document {
    const f = extractReportFigures(data);
    const typeLabel = typeLabelOf(type);
    const now = options.generatedAt ?? new Date();
    const reportId = reportNumber(data, now);
    const dateStr = now.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const hasAi = typeof options.aiAnalysis === 'string' && options.aiAnalysis.trim().length > 0;
    const aiStatus = hasAi ? '含 AI 辅助生成内容（已标注）' : '规则引擎测算，未含 AI 生成文字';

    const children: (Paragraph | Table)[] = [
        para(`新能源智库 · ${REPORT_TITLE} / ${typeLabel}`, { color: '64748B', size: 18 }),
        new Paragraph({ heading: HeadingLevel.TITLE, children: [text(f.projectName || `${typeLabel}项目${REPORT_TITLE}`, { bold: true, size: 36 })], spacing: { after: 120 } }),
        para(`编号：${reportId}　项目所在地：${displayOrNotFilled(f.province)}　测算日期：${dateStr}`, { size: 19, color: '475569' }),
        para(`${REPORT_DISCLAIMER}${aiStatus}。`, { size: 19, color: '475569' }),

        heading('核心测算指标'),
        table([
            ['指标', '数值'],
            ['内部收益率（IRR）', f.irr === null ? '无法确认' : `${f.irr.toFixed(2)}%`],
            ['静态回收期', f.payback === null || f.payback >= f.lifetime ? '估算期内未回本' : `${f.payback.toFixed(1)} 年`],
            [type === 'storage' ? '平准化储能成本（LCOS）' : '平准化度电成本（LCOE，折现）', f.lcoe === null ? '—' : `${f.lcoe.toFixed(3)} 元/度`],
            ['总投资', f.investment === null ? NOT_FILLED : `${money(f.investment)} 元`],
        ]),
    ];

    if (type !== 'storage') {
        children.push(
            heading('资源基础与发电分析'),
            para(`装机规模：${f.capacity ? `${f.capacity} ${capacityUnitOf(type)}` : NOT_FILLED}；首年发电量：${money(f.energy.year1)} kWh；等效利用小时数：${money(f.energy.equivalentHours)} h${f.energy.pr !== null ? `；系统性能比（PR）：${(f.energy.pr * 100).toFixed(1)}%` : ''}`),
        );
        if (f.energy.monthly) {
            children.push(table([
                ['月份', '发电量（kWh）', '月份', '发电量（kWh）'],
                ...Array.from({ length: 6 }, (_, i) => [`${i + 1}月`, money(f.energy.monthly![i]), `${i + 7}月`, money(f.energy.monthly![i + 6])]),
            ]));
        }
    }

    children.push(heading('全生命周期现金流'), para(`主要假设（取自本次测算引擎）：${degradationText(f.assumptions)}`, { size: 19 }));
    if (typeof f.assumptions?.omCostRatio === 'number') {
        children.push(para(`年度运维费：初始投资的 ${(f.assumptions.omCostRatio * 100).toFixed(1)}%，每年增长 ${((f.assumptions.omEscalation ?? 0) * 100).toFixed(1)}%`, { size: 19 }));
    }
    children.push(para(`折现率：${f.discountRate === null ? '未返回' : `${(f.discountRate * 100).toFixed(1)}%（净现值与平准化度电成本共用）`}`, { size: 19 }));
    if (f.cashFlow) {
        const cashFlow = f.cashFlow;
        children.push(table([
            ['运营年份', '年度收入（元）', '净现金流（元）', '累计现金流（元）'],
            ...[1, 5, 10, 20, 25].filter(y => y <= cashFlow.length).map(y => [
                `第 ${y} 年`,
                f.revenue ? money(f.revenue[y - 1]) : '—',
                money(cashFlow[y - 1]),
                f.investment === null ? NOT_FILLED : money(cashFlow.slice(0, y).reduce((s, v) => s + v, -f.investment)),
            ]),
        ]));
        children.push(para('年度收入为售电与自用节省的电费合计；净现金流 = 年度收入 − 运维费用；累计现金流自第 0 年初始投资起算。', { size: 17, color: '64748B' }));
    } else {
        children.push(para('本类型测算未返回逐年现金流。', { size: 19, color: '64748B' }));
    }

    if (type !== 'storage' && f.energy.year1 !== null) {
        children.push(
            heading('环境效益与减排贡献'),
            para(`年减排二氧化碳约 ${co2AvoidedTonnes(f.energy.year1).toFixed(1)} 吨；${EMISSION_FACTOR_NOTE}（来源：${GRID_EMISSION_FACTOR.source}）`, { size: 19 }),
        );
    }

    children.push(heading('数据来源与截至日期'), para(priceAsOfText(f.pricing), { size: 19 }));
    if (f.pricing?.feedInBasis) children.push(para(f.pricing.feedInBasis, { size: 19 }));

    if (hasAi) {
        children.push(heading('AI 辅助分析'), para(AI_LABEL_TEXT, { color: 'B45309', size: 19 }), para(options.aiAnalysis!.trim()));
    }

    children.push(heading('测算结论'), para(reportConclusion(f.irr, f.payback, f.lifetime)));

    return new Document({
        title: `${typeLabel}${REPORT_TITLE} ${reportId}`,
        subject: REPORT_TITLE,
        creator: '新能源智库',
        lastModifiedBy: '新能源智库',
        description: `${REPORT_TITLE}，编号 ${reportId}。${aiStatus}。${REPORT_DISCLAIMER}`,
        keywords: hasAi ? `${REPORT_TITLE},AI辅助生成,编号 ${reportId}` : `${REPORT_TITLE},规则引擎测算,编号 ${reportId}`,
        // 隐式标识：生成属性、服务提供者、内容编号
        customProperties: [
            { name: 'AIGC', value: hasAi ? '含AI辅助生成内容' : '未含AI生成内容' },
            { name: 'ServiceProvider', value: '新能源智库' },
            { name: 'ContentID', value: reportId },
        ],
        styles: { default: { document: { run: { font: FONT } } } },
        sections: [{
            footers: {
                default: new Footer({
                    children: [new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            text(`新能源智库 | ${aiStatus} | ${REPORT_DISCLAIMER} | 第 `, { size: 16, color: '64748B' }),
                            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '64748B' }),
                            text(' 页', { size: 16, color: '64748B' }),
                        ],
                    })],
                }),
            },
            children,
        }],
    });
}

/** 浏览器端：生成 Blob 供下载 */
export async function calculationDocxBlob(data: any, type: string, options?: DocxReportOptions): Promise<Blob> {
    return Packer.toBlob(buildCalculationDocx(data, type, options));
}

/** Node 端（测试/服务端）：生成 Buffer */
export async function calculationDocxBuffer(data: any, type: string, options?: DocxReportOptions): Promise<Buffer> {
    return Packer.toBuffer(buildCalculationDocx(data, type, options));
}
