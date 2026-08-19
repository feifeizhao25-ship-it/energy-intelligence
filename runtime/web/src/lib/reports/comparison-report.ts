import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, PageBreak } from 'docx';
import { formatCurrency, formatNumber, formatPercent } from './templates';
import { SiteComparisonOutput, EnergyResult } from '@/types/comparison';

const TYPE_LABELS: Record<string, string> = {
    SOLAR: '分布式光伏',
    WIND: '分散式风电',
    STORAGE: '工商业储能',
    HYBRID: '光储一体化',
};

export async function generateComparisonReport(data: {
    result: SiteComparisonOutput;
    projectName: string;
    author?: string;
    aiExplanation?: {
        summary: string;
        reasons: string[];
        keyRisks: string[];
        improvementSuggestions: string[];
    } | string;
}): Promise<Blob> {
    const { result, projectName, author, aiExplanation } = data;
    const date = new Date().toLocaleDateString('zh-CN');

    // Parse simplified explanation if string
    const explanation = typeof aiExplanation === 'string'
        ? { summary: aiExplanation, reasons: [], keyRisks: [], improvementSuggestions: [] }
        : (aiExplanation || { summary: result.recommendation ? result.recommendation.reasonSummary.join(' ') : '暂无推荐理由', reasons: [], keyRisks: [], improvementSuggestions: [] });

    const metadata = (result as any).metadata || {
        dataSources: ['NASA POWER', 'Local Utility Rates'],
        calculationVersion: '1.0.0-legacy',
        timestamp: new Date().toISOString()
    };

    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                // 1. Cover Page
                new Paragraph({
                    children: [new TextRun({ text: '新能源项目多能种选点决策报告', bold: true, size: 48, color: '1F6F3D' })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 2000, after: 400 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: projectName, bold: true, size: 36 })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 1000 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: `报告日期：${date}`, size: 24 })],
                    alignment: AlignmentType.CENTER,
                }),
                author ? new Paragraph({
                    children: [new TextRun({ text: `准备人：${author}`, size: 24 })],
                    alignment: AlignmentType.CENTER,
                }) : new Paragraph({ children: [] }),

                new Paragraph({ children: [new PageBreak()] }),

                // 2. Executive Summary / AI Insights
                new Paragraph({
                    children: [new TextRun({ text: '1. 执行摘要与项目背景', bold: true, size: 32 })],
                    spacing: { before: 400, after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '本项目旨在通过多能种（光、风、储）的综合比选，确定指定站点的最佳能源投资方案。系统已结合 NASA 气象数据及当地电价政策进行了多轮模拟测算。', size: 22 })],
                    spacing: { after: 200 },
                }),

                createTable([
                    ['项目地点', result.address || '指定经纬度地址'],
                    ['地理坐标', `${result.lat.toFixed(4)} N, ${result.lng.toFixed(4)} E`],
                    ['推荐方案', TYPE_LABELS[result.recommendation.type] || result.recommendation.type],
                ]),

                new Paragraph({
                    children: [new TextRun({ text: '1.1 专家评估结论', bold: true, size: 24 })],
                    spacing: { before: 300, after: 150 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: explanation.summary, size: 22 })],
                }),

                // Improvements & Risks
                explanation.improvementSuggestions.length > 0 ? new Paragraph({
                    children: [
                        new TextRun({ text: '💡 收益提升建议：', bold: true, size: 22 }),
                        new TextRun({ text: explanation.improvementSuggestions.join('；'), size: 22 })
                    ],
                    spacing: { before: 200 }
                }) : new Paragraph({ children: [] }),

                explanation.keyRisks.length > 0 ? new Paragraph({
                    children: [
                        new TextRun({ text: '⚠️ 关键风险提示：', bold: true, size: 22, color: 'DC2626' }),
                        new TextRun({ text: explanation.keyRisks.join('；'), size: 22 })
                    ],
                    spacing: { before: 100 }
                }) : new Paragraph({ children: [] }),

                // 3. Resource Assessment
                new Paragraph({
                    children: [new TextRun({ text: '2. 资源条件评估', bold: true, size: 32 })],
                    spacing: { before: 400, after: 200 },
                }),
                createTable([
                    ['气象数据源', 'NASA POWER / SSE (过去 20 年均值)'],
                    ['年平均辐照度 (GHI)', `${formatNumber(result.resourceData.solarGHI)} kWh/m²`],
                    ['年平均风速 (10m 高度)', `${formatNumber(result.resourceData.avgWindSpeed)} m/s`],
                ]),

                // 4. Comparison Table
                new Paragraph({
                    children: [new TextRun({ text: '3. 多方案投资效益对比', bold: true, size: 32 })],
                    spacing: { before: 400, after: 200 },
                }),
                createComparisonTable([result.solar, result.wind, result.storage, result.hybrid].filter(s => s && s.irr !== null)),

                // 5. Detailed Analysis of Recommended Solution
                new Paragraph({
                    children: [new TextRun({ text: `4. 推荐方案详情：${TYPE_LABELS[result.recommendation.type] || result.recommendation.type}`, bold: true, size: 32 })],
                    spacing: { before: 400, after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '该方案基于当前市场成本及当地补贴政策下的最优配置。', size: 22 })],
                }),

                // Final Footer
                new Paragraph({
                    children: [new TextRun({ text: '--- 报告结束 ---', color: '666666', size: 18 })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 1000 },
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: `数据来源: ${metadata.dataSources.join(', ')}`, size: 14, color: '999999' }),
                        new TextRun({ text: ` | 算法版本: ${metadata.calculationVersion}`, size: 14, color: '999999' })
                    ],
                    alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                    children: [new TextRun({ text: '生成的报告仅供参考，实际项目开工请以专业可研为准。', italics: true, size: 16, color: '999999' })],
                    alignment: AlignmentType.CENTER,
                }),
            ],
        }],
    });

    return Packer.toBlob(doc);
}

function createTable(data: (string | number)[][]): Table {
    const rows = data.map((row) =>
        new TableRow({
            children: row.map((cell) =>
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: String(cell), size: 22 })] })],
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                })
            ),
        })
    );

    return new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        },
    });
}

function createComparisonTable(solutions: EnergyResult[]): Table {
    const headers = ['能源类型', '预期 IRR', '回收期(年)', '总投资', '风险等级'];
    const headerRow = new TableRow({
        children: headers.map(h => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 22, color: 'FFFFFF' })] })],
            shading: { fill: '1F6F3D' },
            verticalAlign: AlignmentType.CENTER,
        })),
    });

    const rows = solutions.map(sol => {
        const investment = sol.capex || 0;
        const irr = (sol.irr || 0) / 100;
        const payback = sol.paybackYears || 0;

        return new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: TYPE_LABELS[sol.type] || sol.type, size: 22 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatPercent(irr), size: 22 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNumber(payback), size: 22 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `¥${formatNumber(investment / 10000)}万`, size: 22 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: sol.riskLevel === 'low' ? '低' : sol.riskLevel === 'medium' ? '中' : '高', size: 22 })] })] }),
            ],
        });
    });

    return new Table({
        rows: [headerRow, ...rows],
        width: { size: 100, type: WidthType.PERCENTAGE },
    });
}
