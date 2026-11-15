
interface ReportData {
    location: string;
    solar: any;
    wind: any;
    climate: any;
    history: any;
    analysis: any;
}

export function generateResourceReport(data: ReportData, type: 'basic' | 'standard' | 'detailed') {
    // In a real app, this would generate a PDF buffer using pdfkit or react-pdf.
    // Here we construct a Markdown report string.

    const date = new Date().toLocaleDateString();

    return `
# 新能源资源评估报告

**项目地点**: ${data.location}
**报告类型**: ${type.toUpperCase()}
**生成日期**: ${date}

---

## 1. 资源概况

| 指标 | 数值 | 等级 |
|------|------|------|
| 年总辐照量 | ${data.solar.annual.ghi.toFixed(0)} kWh/m² | ${data.solar.annual.resourceClass} |
| 峰值日照时数 | ${data.solar.annual.peakSunHours.toFixed(2)} h | - |
| 100m年均风速 | ${data.wind.annual.avgSpeed.toFixed(2)} m/s | ${data.wind.annual.resourceClass} |
| 综合评分 | 光伏: ${data.analysis.solarScore} / 风电: ${data.analysis.windScore} | - |

## 2. 月度分布

(此处应有月度图表，请参考在线详情)

## 3. 结论与建议

${data.analysis.solarScore > data.analysis.windScore ?
            '按本次评分，太阳能资源分高于风能资源分。这是资源量对比，不是开发建议。' :
            '按本次评分，风能资源分不低于太阳能资源分。这是资源量对比，不是开发建议。'}

互补性评价：${data.analysis.complementarity.description} (评分: ${data.analysis.complementarity.score.toFixed(0)})

${data.history?.note || ''}

---
*数据来源: ${data.climate?.provenance || '国内省级离线样本'}。${data.climate?.licenseNote || ''}*
    `;
}
