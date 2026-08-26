/**
 * Formatters for FutureX Agents
 * Supports numbers, currency, tables, and AI-driven care messages.
 */

export const formatCurrency = (amount: number, currency: string = 'CNY') => {
    return new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency,
    }).format(amount);
};

export const formatNumber = (num: number) => {
    return new Intl.NumberFormat('zh-CN').format(num);
};

export const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

/**
 * Formats data into a Markdown table
 */
export const toMarkdownTable = (data: any[], headers: string[]) => {
    if (!data.length) return "暂无数据";

    const headerRow = `| ${headers.join(" | ")} |`;
    const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`;
    const dataRows = data.map(item => {
        return `| ${headers.map(h => item[h] || '').join(" | ")} |`;
    });

    return [headerRow, separatorRow, ...dataRows].join("\n");
};

/**
 * Proactive message generator for "Shunshi" (Wellness)
 */
export const getWellnessCare = (hour: number, solarTerm: string) => {
    if (hour >= 6 && hour < 9) return `早安！当前正是${solarTerm}时节，建议晨起饮温水，助肝气升发。`;
    if (hour >= 21 || hour < 5) return `夜深了，早点休息。中医有云：“静能生阴”，良好睡眠是养生之本。`;
    return `顺时而动，记得适度伸展身体，保持心情舒畅。`;
};

/**
 * Energy saving tip for "New Energy"
 */
export const getEnergyTip = (powerOutput: number) => {
    if (powerOutput > 10) return `检测到当前光伏发电量充足（${powerOutput}kW），建议开启大功率电器执行负载平衡。`;
    return `当前光电输出较低，建议开启节能模式。`;
};
