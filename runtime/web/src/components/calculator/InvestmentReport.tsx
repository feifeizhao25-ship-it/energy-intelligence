import React from 'react';
import {
    Page,
    Text,
    View,
    Document,
    StyleSheet,
    Font,
} from '@react-pdf/renderer';
import { co2AvoidedTonnes, EMISSION_FACTOR_NOTE, GRID_EMISSION_FACTOR } from '@/lib/standards/emission-factor';
import {
    PDF_FONT_FILES, REPORT_TITLE, REPORT_DISCLAIMER, NOT_FILLED,
    reportConclusion, reportNumber, degradationText, displayOrNotFilled, extractReportFigures,
} from '@/lib/reports/calculation-report';
import { priceAsOfText } from '@/lib/pricing/tariffs';

// 中文字体自托管在 public/fonts（Noto Sans SC，SIL OFL 1.1），不再请求境外字体 CDN。
// 浏览器里按当前站点地址取；在 Node 里（测试/服务端渲染）由调用方传入解析函数。
export function registerReportFonts(resolve: (publicPath: string) => string = defaultFontUrl) {
    Font.register({
        family: 'Noto Sans SC',
        fonts: [
            { src: resolve(PDF_FONT_FILES.regular), fontWeight: 'normal' },
            { src: resolve(PDF_FONT_FILES.bold), fontWeight: 'bold' },
        ],
    });
    // 中文不按空格断行：逐字可断，并在每个字后插入空片段，避免断行处被补上连字符「-」
    Font.registerHyphenationCallback(word => (/[\u4e00-\u9fff]/.test(word) ? Array.from(word).flatMap(ch => [ch, '']) : [word]));
}

function defaultFontUrl(publicPath: string): string {
    return new URL(publicPath, window.location.origin).href;
}

// 只在浏览器里自动注册（报告只在浏览器端生成）；Node 环境由调用方用本地文件路径注册。
if (typeof window !== 'undefined') registerReportFonts();

// 定义样式
const styles = StyleSheet.create({
    page: {
        padding: 40,
        paddingBottom: 70, // 给固定页脚留位置，正文不压页脚
        fontFamily: 'Noto Sans SC',
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottom: '2px solid #1e293b',
        paddingBottom: 10,
        marginBottom: 20,
    },
    logo: {
        fontSize: 18,
        color: '#2563eb',
        fontWeight: 'bold',
        fontFamily: 'Noto Sans SC',
    },
    reportTitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 5,
    },
    titleSection: {
        textAlign: 'center',
        marginVertical: 30,
    },
    mainTitle: {
        fontSize: 24,
        fontFamily: 'Noto Sans SC',
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 10,
        color: '#64748b',
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontFamily: 'Noto Sans SC',
        fontWeight: 'bold',
        color: '#1e293b',
        backgroundColor: '#f8fafc',
        padding: 6,
        borderLeft: '4px solid #2563eb',
        marginBottom: 10,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 15,
    },
    metricCard: {
        width: '23%',
        padding: 10,
        backgroundColor: '#f1f5f9',
        borderRadius: 4,
        textAlign: 'center',
    },
    metricLabel: {
        fontSize: 8,
        color: '#64748b',
        marginBottom: 4,
    },
    metricValue: {
        fontSize: 12,
        fontFamily: 'Noto Sans SC',
        fontWeight: 'bold',
        color: '#0f172a',
    },
    table: {
        width: 'auto',
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRightWidth: 0,
        borderBottomWidth: 0,
    },
    tableRow: {
        margin: 'auto',
        flexDirection: 'row',
    },
    tableColHeader: {
        width: '25%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        backgroundColor: '#f1f5f9',
        borderColor: '#e2e8f0',
        padding: 5,
    },
    tableCol: {
        width: '25%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderColor: '#e2e8f0',
        padding: 5,
    },
    tableCellHeader: {
        fontSize: 9,
        fontFamily: 'Noto Sans SC',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    tableCell: {
        fontSize: 8,
        textAlign: 'center',
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        borderTop: '1px solid #e2e8f0',
        paddingTop: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        color: '#64748b',
        fontSize: 8,
    },
    chartPlaceholder: {
        height: 150,
        backgroundColor: '#f8fafc',
        border: '1px dashed #cbd5e1',
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 10,
    }
});

interface InvestmentReportProps {
    data: any;
    type: string;
    /** AI 辅助生成的分析文字（可选）。有内容时报告会显式标注「AI 辅助生成」并写入文档元数据。 */
    aiAnalysis?: string | null;
    /** 测算日期，缺省为当前时间（编号与日期由它决定） */
    generatedAt?: Date;
}

const fmtMoney = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v).toLocaleString('zh-CN') : '—');

const InvestmentReport: React.FC<InvestmentReportProps> = ({ data, type, aiAnalysis, generatedAt }) => {
    const typeLabel = type === 'solar' ? '分布式光伏' : type === 'wind' ? '分散式风电' : '工商业储能';
    const now = generatedAt ?? new Date();
    const reportId = reportNumber(data, now);
    const dateStr = now.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
    // 数字统一由 extractReportFigures 取（与 Word 导出同一份）
    const figures = extractReportFigures(data);
    const energy = data?.energy ?? {};
    const { assumptions, irr, payback, lcoe, investment, lifetime, cashFlow, revenue, discountRate } = figures;
    const hasAi = typeof aiAnalysis === 'string' && aiAnalysis.trim().length > 0;
    const capacity = data?.metadata?.capacity;

    return (
        <Document
            title={`${typeLabel}${REPORT_TITLE} ${reportId}`}
            author="新能源智库"
            subject={REPORT_TITLE}
            creator="新能源智库"
            producer="新能源智库"
            keywords={hasAi ? `${REPORT_TITLE},AI辅助生成,编号 ${reportId}` : `${REPORT_TITLE},规则引擎测算,编号 ${reportId}`}
        >
            <Page size="A4" style={styles.page}>
                {/* 页眉 */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.logo}>新能源智库</Text>
                        <Text style={styles.subtitle}>新能源项目初步测算</Text>
                    </View>
                    <View style={{ textAlign: 'right' }}>
                        <Text style={styles.reportTitle}>{REPORT_TITLE} / {typeLabel}</Text>
                        <Text style={styles.subtitle}>编号: {reportId}</Text>
                    </View>
                </View>

                {/* 封面标题 */}
                <View style={styles.titleSection}>
                    <Text style={styles.mainTitle}>{data?.metadata?.projectName || `${typeLabel}项目${REPORT_TITLE}`}</Text>
                    <Text style={styles.subtitle}>项目所在地: {displayOrNotFilled(data?.metadata?.province)} | 测算日期: {dateStr}</Text>
                    <Text style={[styles.subtitle, { marginTop: 4 }]}>{REPORT_DISCLAIMER}</Text>
                </View>

                {/* 核心指标看板 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>核心测算指标</Text>
                    <View style={styles.grid}>
                        <View style={styles.metricCard}>
                            <Text style={styles.metricLabel}>内部收益率 IRR</Text>
                            <Text style={styles.metricValue}>{irr === null ? '无法确认' : `${irr.toFixed(2)}%`}</Text>
                        </View>
                        <View style={styles.metricCard}>
                            <Text style={styles.metricLabel}>静态回收期</Text>
                            <Text style={styles.metricValue}>{payback === null || payback >= lifetime ? '估算期内未回本' : `${payback.toFixed(1)}年`}</Text>
                        </View>
                        <View style={styles.metricCard}>
                            <Text style={styles.metricLabel}>度电成本 LCOE（折现）</Text>
                            <Text style={styles.metricValue}>{lcoe === null ? '—' : `¥${lcoe.toFixed(3)}`}</Text>
                        </View>
                        <View style={styles.metricCard}>
                            <Text style={styles.metricLabel}>总投资</Text>
                            <Text style={styles.metricValue}>{investment === null ? NOT_FILLED : `¥${(investment / 10000).toFixed(1)}万`}</Text>
                        </View>
                    </View>
                </View>

                {/* 资源分析 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>资源基础与发电分析</Text>
                    <Text style={{ fontSize: 9, marginBottom: 10, color: '#334155' }}>
                        装机规模：{capacity ? `${capacity} kWp` : NOT_FILLED} |
                        首年发电量：{Math.round(energy.year1 || 0).toLocaleString('zh-CN')} kWh |
                        等效利用小时数：{Math.round(energy.equivalentHours || energy.specificYield || 0).toLocaleString('zh-CN')} h
                        {typeof energy.pr === 'number' ? ` | 系统性能比 PR：${(energy.pr * 100).toFixed(1)}%` : ''}
                    </Text>

                    {/* 表格：月度发电分布 */}
                    <View style={styles.table}>
                        <View style={styles.tableRow}>
                            <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>月份</Text></View>
                            <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>发电量(kWh)</Text></View>
                            <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>月份</Text></View>
                            <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>发电量(kWh)</Text></View>
                        </View>
                        {[...Array(6)].map((_, i) => (
                            <View style={styles.tableRow} key={i}>
                                <View style={styles.tableCol}><Text style={styles.tableCell}>{i + 1}月</Text></View>
                                <View style={styles.tableCol}><Text style={styles.tableCell}>{fmtMoney(energy.monthly?.[i])}</Text></View>
                                <View style={styles.tableCol}><Text style={styles.tableCell}>{i + 7}月</Text></View>
                                <View style={styles.tableCol}><Text style={styles.tableCell}>{fmtMoney(energy.monthly?.[i + 6])}</Text></View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* 财务收益分析 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>全生命周期现金流</Text>
                    <View style={{ marginBottom: 15 }}>
                        <Text style={{ fontSize: 9, color: '#475569', marginBottom: 5 }}>主要假设（取自本次测算引擎）：</Text>
                        <Text style={{ fontSize: 8, color: '#64748b' }}>• {degradationText(assumptions)}</Text>
                        {typeof assumptions?.omCostRatio === 'number' && (
                            <Text style={{ fontSize: 8, color: '#64748b' }}>• 年度运维费：初始投资的 {(assumptions.omCostRatio * 100).toFixed(1)}%，每年增长 {((assumptions.omEscalation ?? 0) * 100).toFixed(1)}%</Text>
                        )}
                        <Text style={{ fontSize: 8, color: '#64748b' }}>• 折现率：{discountRate === null ? '未返回' : `${(discountRate * 100).toFixed(1)}%（NPV 与 LCOE 共用）`}</Text>
                    </View>

                    {cashFlow ? (
                        <View style={styles.table} wrap={false}>
                            <View style={styles.tableRow}>
                                <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>运营年份</Text></View>
                                <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>年度收入(元)</Text></View>
                                <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>净现金流(元)</Text></View>
                                <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>累计现金流(元)</Text></View>
                            </View>
                            {[1, 5, 10, 20, 25].filter(year => year <= cashFlow.length).map((year) => {
                                const accum = investment === null
                                    ? null
                                    : cashFlow.slice(0, year).reduce((sum, v) => sum + v, -investment);
                                return (
                                    <View style={styles.tableRow} key={year}>
                                        <View style={styles.tableCol}><Text style={styles.tableCell}>第 {year} 年</Text></View>
                                        <View style={styles.tableCol}><Text style={styles.tableCell}>{revenue ? fmtMoney(revenue[year - 1]) : '—'}</Text></View>
                                        <View style={styles.tableCol}><Text style={styles.tableCell}>{fmtMoney(cashFlow[year - 1])}</Text></View>
                                        <View style={styles.tableCol}><Text style={styles.tableCell}>{accum === null ? NOT_FILLED : fmtMoney(accum)}</Text></View>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <Text style={{ fontSize: 8, color: '#64748b' }}>本类型测算未返回逐年现金流。</Text>
                    )}
                    <Text style={{ fontSize: 7, color: '#94a3b8', marginTop: 4 }}>年度收入为售电与自用节省的电费合计；净现金流 = 年度收入 − 运维费用；累计现金流自第 0 年初始投资起算。</Text>
                </View>

                {/* 环境效益 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>环境效益与减排贡献</Text>
                    <View style={styles.grid}>
                        <View style={[styles.metricCard, { width: '48%', backgroundColor: '#ecfdf5' }]}>
                            <Text style={styles.metricLabel}>年减排二氧化碳 (CO2)</Text>
                            <Text style={[styles.metricValue, { color: '#059669' }]}>
                                {co2AvoidedTonnes(energy.year1 || 0).toFixed(1)} 吨
                            </Text>
                        </View>
                        <View style={[styles.metricCard, { width: '48%', backgroundColor: '#ecfdf5' }]}>
                            <Text style={styles.metricLabel}>生命周期等效植树</Text>
                            <Text style={[styles.metricValue, { color: '#059669' }]}>
                                {Math.round(co2AvoidedTonnes(energy.lifetime || (energy.year1 || 0) * 25) * 1000 / 22)} 棵
                            </Text>
                        </View>
                    </View>
                </View>
                <Text style={{ fontSize: 8, color: '#64748b', marginTop: -10, marginBottom: 4 }}>
                    {EMISSION_FACTOR_NOTE}（来源：{GRID_EMISSION_FACTOR.source}）
                </Text>
                <Text style={{ fontSize: 8, color: '#64748b', marginBottom: 10 }}>
                    {priceAsOfText(figures.pricing)}
                </Text>

                {hasAi && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>AI 辅助分析</Text>
                        <Text style={{ fontSize: 8, color: '#b45309', marginBottom: 4 }}>【AI 辅助生成】本节文字由人工智能生成，可能存在错误，请核实后使用。</Text>
                        <Text style={{ fontSize: 9, color: '#334155', lineHeight: 1.5 }}>{aiAnalysis}</Text>
                    </View>
                )}

                {/* 结论 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>测算结论</Text>
                    <View style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                        <Text style={{ fontSize: 9, color: '#334155', lineHeight: 1.5 }}>
                            {reportConclusion(irr, payback, lifetime)}
                        </Text>
                    </View>
                </View>

                {/* 页脚 */}
                <View style={styles.footer} fixed>
                    <Text>© {now.getFullYear()} 新能源智库 | {hasAi ? '含 AI 辅助生成内容（已标注）' : '规则引擎测算，未含 AI 生成文字'}</Text>
                    <Text>{REPORT_DISCLAIMER}</Text>
                    <Text render={({ pageNumber, totalPages }) => `第 ${pageNumber} / ${totalPages} 页`} />
                </View>
            </Page>
        </Document>
    );
};

export default InvestmentReport;
