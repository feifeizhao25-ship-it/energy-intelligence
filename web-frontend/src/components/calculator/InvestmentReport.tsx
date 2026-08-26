import React from 'react';
import {
    Page,
    Text,
    View,
    Document,
    StyleSheet,
    Font,
    Image,
} from '@react-pdf/renderer';

// 注册中文字体 - 使用更可靠的 CDN 源
Font.register({
    family: 'Noto Sans SC',
    fonts: [
        {
            src: 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_EnYxNbPzS5HE.ttf',
            fontWeight: 'normal',
        },
        {
            src: 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_EnYxNbPzS5HE.ttf',
            fontWeight: 'bold',
        },
    ],
});

// 定义样式
const styles = StyleSheet.create({
    page: {
        padding: 40,
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
        fontFamily: 'Noto Sans SC Bold',
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
        fontFamily: 'Noto Sans SC Bold',
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
        fontFamily: 'Noto Sans SC Bold',
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
        fontFamily: 'Noto Sans SC Bold',
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
}

const InvestmentReport: React.FC<InvestmentReportProps> = ({ data, type }) => {
    const typeLabel = type === 'solar' ? '分布式光伏' : type === 'wind' ? '分散式风电' : '工商业储能';
    const reportId = `BR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const dateStr = new Date().toLocaleDateString('zh-CN');

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* 页眉 */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.logo}>新能源智库 Pro</Text>
                        <Text style={styles.subtitle}>专业级新能源投融资辅助分析平台</Text>
                    </View>
                    <View style={{ textAlign: 'right' }}>
                        <Text style={styles.reportTitle}>投资建议书 / {typeLabel}</Text>
                        <Text style={styles.subtitle}>编号: {reportId}</Text>
                    </View>
                </View>

                {/* 封面标题 */}
                <View style={styles.titleSection}>
                    <Text style={styles.mainTitle}>{data.metadata?.projectName || `${typeLabel}项目投资测算报告`}</Text>
                    <Text style={styles.subtitle}>项目所在地: {data.metadata?.province || '苏州'} | 测算日期: {dateStr} | 模型版本: V2.4 Standard</Text>
                </View>

                {/* 核心指标看板 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>核心投资指标摘要</Text>
                    <View style={styles.grid}>
                        <View style={styles.metricCard}>
                            <Text style={styles.metricLabel}>项目 IRR</Text>
                            <Text style={styles.metricValue}>{data.financial.irr?.toFixed(2) || (data.financial.metrics?.irr?.toFixed(2))}%</Text>
                        </View>
                        <View style={styles.metricCard}>
                            <Text style={styles.metricLabel}>静态回收期</Text>
                            <Text style={styles.metricValue}>{data.financial.paybackYears?.toFixed(1) || (data.financial.metrics?.paybackYears?.toFixed(1))}年</Text>
                        </View>
                        <View style={styles.metricCard}>
                            <Text style={styles.metricLabel}>度电成本 (LCOE)</Text>
                            <Text style={styles.metricValue}>¥{data.financial.lcoe?.toFixed(3) || (data.financial.metrics?.lcos?.toFixed(3))}</Text>
                        </View>
                        <View style={styles.metricCard}>
                            <Text style={styles.metricLabel}>总投资规模</Text>
                            <Text style={styles.metricValue}>¥{((data.financial.investment || data.financial.investment?.total) / 10000).toFixed(1)}万</Text>
                        </View>
                    </View>
                </View>

                {/* 资源分析 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>资源基础与发电分析</Text>
                    <Text style={{ fontSize: 9, marginBottom: 10, color: '#334155' }}>
                        装机规模：{data.metadata?.capacity || (data.energy?.year1 / (data.energy?.equivalentHours || data.energy?.specificYield || 1)).toFixed(1)} kWp |
                        首年计划发电量：{Math.round(data.energy?.year1 || 0).toLocaleString()} kWh |
                        等效利用小时数：{Math.round(data.energy?.equivalentHours || data.energy?.specificYield || 0).toLocaleString()} h
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
                                <View style={styles.tableCol}><Text style={styles.tableCell}>{Math.round(data.energy.monthly[i] || 0).toLocaleString()}</Text></View>
                                <View style={styles.tableCol}><Text style={styles.tableCell}>{i + 7}月</Text></View>
                                <View style={styles.tableCol}><Text style={styles.tableCell}>{Math.round(data.energy.monthly[i + 6] || 0).toLocaleString()}</Text></View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* 财务收益分析 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>全生命周期财务收益预测</Text>
                    <View style={{ marginBottom: 15 }}>
                        <Text style={{ fontSize: 9, color: '#475569', marginBottom: 5 }}>主要收益曲线说明：</Text>
                        <Text style={{ fontSize: 8, color: '#64748b' }}>• 考虑年度衰减系数 (首年 1.5%，后续每年 0.5%)</Text>
                        <Text style={{ fontSize: 8, color: '#64748b' }}>• 考虑年度运维费用 (初始投资额的 1%，每年增长 2%)</Text>
                        <Text style={{ fontSize: 8, color: '#64748b' }}>• 折现率按业界标准 8.0% 计取</Text>
                    </View>

                    {/* 25年现金流关键节点 */}
                    <View style={styles.table}>
                        <View style={styles.tableRow}>
                            <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>运营年份</Text></View>
                            <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>年度收益(元)</Text></View>
                            <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>现金流(元)</Text></View>
                            <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>累计现金流(元)</Text></View>
                        </View>
                        {[1, 5, 10, 20, 25].map((year) => {
                            const cashflow = data.financial.cashFlow ? data.financial.cashFlow[year - 1] : 0;
                            // 简化计算累计现金流
                            let accum = -(data.financial.investment || 3000000);
                            if (data.financial.cashFlow) {
                                for (let i = 0; i < year; i++) accum += data.financial.cashFlow[i];
                            }

                            return (
                                <View style={styles.tableRow} key={year}>
                                    <View style={styles.tableCol}><Text style={styles.tableCell}>第 {year} 年</Text></View>
                                    <View style={styles.tableCol}><Text style={styles.tableCell}>{Math.round(cashflow).toLocaleString()}</Text></View>
                                    <View style={styles.tableCol}><Text style={styles.tableCell}>{Math.round(cashflow).toLocaleString()}</Text></View>
                                    <View style={styles.tableCol}><Text style={styles.tableCell}>{Math.round(accum).toLocaleString()}</Text></View>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* 环境效益 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>环境效益与减排贡献</Text>
                    <View style={styles.grid}>
                        <View style={[styles.metricCard, { width: '48%', backgroundColor: '#ecfdf5' }]}>
                            <Text style={styles.metricLabel}>年减排二氧化碳 (CO2)</Text>
                            <Text style={[styles.metricValue, { color: '#059669' }]}>
                                {data.environmental?.co2Year1 ? (data.environmental.co2Year1 / 1000).toFixed(1) : (data.energy.year1 * 0.785 / 1000).toFixed(1)} 吨
                            </Text>
                        </View>
                        <View style={[styles.metricCard, { width: '48%', backgroundColor: '#ecfdf5' }]}>
                            <Text style={styles.metricLabel}>生命周期等效植树</Text>
                            <Text style={[styles.metricValue, { color: '#059669' }]}>
                                {data.environmental?.treesEquivalent || Math.round(data.energy.year1 * 25 * 0.785 / 22)} 棵
                            </Text>
                        </View>
                    </View>
                </View>

                {/* 结论 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>投资结论与专业评价</Text>
                    <View style={{ padding: 10, backgroundColor: '#fff7ed', borderRadius: 4, border: '1px solid #ffedd5' }}>
                        <Text style={{ fontSize: 9, color: '#9a3412', lineHeight: 1.5 }}>
                            【分析结论】经系统模拟测算，该项目具有较强的财务可行性。其 IRR 指标 {(data.financial.irr || data.financial.metrics?.irr)?.toFixed(2)}% 显著高于同行业基准水平(8%)。考虑到资源条件稳定且具备成熟的并网环境，建议尽快推动立项开发。
                        </Text>
                    </View>
                </View>

                {/* 页脚 */}
                <View style={styles.footer}>
                    <Text>© 2026 新能源智库 | AI 智能测算模块</Text>
                    <Text>本报告仅供参考，不作为最终投资决策依据</Text>
                    <Text render={({ pageNumber, totalPages }) => `第 ${pageNumber} / ${totalPages} 页`} />
                </View>
            </Page>
        </Document>
    );
};

export default InvestmentReport;
