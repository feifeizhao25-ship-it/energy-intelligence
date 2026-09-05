// 每日推送内容生成

export interface DailyReport {
    type: 'morning' | 'evening' | 'alert';
    title: string;
    content: string;
    summary: {
        generation?: number;
        revenue?: number;
        weather?: string;
        forecast?: number;
    };
    actions: { label: string; url: string }[];
}

export interface StationData {
    id: string;
    name: string;
    type: 'solar' | 'wind' | 'storage';
    capacity: number;      // kW
    todayGeneration: number;
    todayRevenue: number;
    monthGeneration: number;
    yearGeneration: number;
    efficiency: number;
}

export interface WeatherForecast {
    date: string;
    condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy';
    temperature: { min: number; max: number };
    irradiance?: number;   // 辐照量 kWh/m2
    windSpeed?: number;    // m/s
}

// 生成早间预报
export function generateMorningReport(
    stations: StationData[],
    weather: WeatherForecast
): DailyReport {
    const totalCapacity = stations.reduce((sum, s) => sum + s.capacity, 0);

    // 基于天气预测发电量
    const weatherFactor = {
        sunny: 1.0,
        cloudy: 0.6,
        rainy: 0.2,
        snowy: 0.1,
    }[weather.condition];

    // 预测发电量 = 装机容量 × 日照小时 × 天气系数
    const avgSunHours = 4.5;
    const forecastGeneration = totalCapacity * avgSunHours * weatherFactor;

    const weatherEmoji = {
        sunny: '☀️',
        cloudy: '⛅',
        rainy: '🌧️',
        snowy: '❄️',
    }[weather.condition];

    const weatherText = {
        sunny: '晴天',
        cloudy: '多云',
        rainy: '雨天',
        snowy: '雪天',
    }[weather.condition];

    return {
        type: 'morning',
        title: `${weatherEmoji} 今日发电预报`,
        content: `今天${weatherText}，预计发电量 ${Math.round(forecastGeneration)} kWh，预估收益 ¥${Math.round(forecastGeneration * 0.85)}`,
        summary: {
            forecast: Math.round(forecastGeneration),
            weather: weather.condition,
        },
        actions: [
            { label: '查看电站', url: '/my/stations' },
            { label: '详细天气', url: '/weather' },
        ],
    };
}

// 生成晚间报告
export function generateEveningReport(
    stations: StationData[],
    date: string = new Date().toISOString().split('T')[0],
    yesterdayGeneration?: number,
): DailyReport {
    const totalGeneration = stations.reduce((sum, s) => sum + s.todayGeneration, 0);
    const totalRevenue = stations.reduce((sum, s) => sum + s.todayRevenue, 0);
    const hasYesterday = typeof yesterdayGeneration === 'number'
        && Number.isFinite(yesterdayGeneration)
        && yesterdayGeneration >= 0;
    let comparisonText = '暂无昨日可比数据';
    if (hasYesterday && yesterdayGeneration === 0) {
        comparisonText = totalGeneration === 0 ? '与昨日持平' : '昨日发电量为 0，暂不计算环比';
    } else if (hasYesterday) {
        const trend = ((totalGeneration - yesterdayGeneration) / yesterdayGeneration) * 100;
        comparisonText = trend >= 0
            ? `📈 比昨日高 ${trend.toFixed(1)}%`
            : `📉 比昨日低 ${Math.abs(trend).toFixed(1)}%`;
    }

    return {
        type: 'evening',
        title: '📊 今日发电报告',
        content: `今日发电 ${totalGeneration.toFixed(1)} kWh，收益 ¥${totalRevenue.toFixed(0)}。${comparisonText}`,
        summary: {
            generation: totalGeneration,
            revenue: totalRevenue,
        },
        actions: [
            { label: '查看详情', url: '/my/stations' },
            { label: '录入数据', url: '/my/stations?action=record' },
        ],
    };
}

// 生成异常告警
export function generateAlertReport(
    station: StationData,
    alertType: 'low_generation' | 'cleaning' | 'fault' | 'efficiency'
): DailyReport {
    const alertConfig = {
        low_generation: {
            title: '⚠️ 发电量异常',
            content: `${station.name} 今日发电量 ${station.todayGeneration} kWh，低于预期30%以上，请检查是否有遮挡或设备故障。`,
            actions: [
                { label: '查看电站', url: `/my/stations/${station.id}` },
                { label: '申请诊断', url: '/maintenance/diagnosis' },
            ],
        },
        cleaning: {
            title: '🧹 建议清洗',
            content: `${station.name} 运行效率 ${station.efficiency}%，低于最佳状态，建议进行组件清洗以提升发电效率。`,
            actions: [
                { label: '查看详情', url: `/my/stations/${station.id}` },
                { label: '预约清洗', url: '/maintenance/cleaning' },
            ],
        },
        fault: {
            title: '🚨 设备告警',
            content: `${station.name} 检测到逆变器异常，请尽快检查或联系运维。`,
            actions: [
                { label: '查看详情', url: `/my/stations/${station.id}` },
                { label: '联系运维', url: '/support' },
            ],
        },
        efficiency: {
            title: '📉 效率下降',
            content: `${station.name} 近7天平均效率下降5%，可能存在组件衰减或热斑问题。`,
            actions: [
                { label: 'AI诊断', url: '/maintenance/ai-diagnosis' },
                { label: '查看详情', url: `/my/stations/${station.id}` },
            ],
        },
    };

    const config = alertConfig[alertType];

    return {
        type: 'alert',
        title: config.title,
        content: config.content,
        summary: {},
        actions: config.actions,
    };
}

// 检查是否需要发送告警
export function checkAlerts(station: StationData): { type: string; level: 'warning' | 'critical' }[] {
    const alerts: { type: string; level: 'warning' | 'critical' }[] = [];

    // 发电量低于预期30%
    const expectedGeneration = station.capacity * 4; // 预期日均4小时等效
    if (station.todayGeneration < expectedGeneration * 0.7) {
        alerts.push({ type: 'low_generation', level: 'warning' });
    }

    // 效率低于90%
    if (station.efficiency < 90) {
        alerts.push({ type: 'cleaning', level: 'warning' });
    }

    // 效率低于80%
    if (station.efficiency < 80) {
        alerts.push({ type: 'efficiency', level: 'critical' });
    }

    return alerts;
}

// 格式化推送时间
export function getScheduledTime(type: 'morning' | 'evening'): string {
    return type === 'morning' ? '08:00' : '18:00';
}

// 用户推送配置
export interface PushConfig {
    enabled: boolean;
    morningReport: boolean;
    eveningReport: boolean;
    alerts: boolean;
    weeklyDigest: boolean;
    channels: ('app' | 'sms' | 'wechat')[];
}

export const defaultPushConfig: PushConfig = {
    enabled: true,
    morningReport: true,
    eveningReport: true,
    alerts: true,
    weeklyDigest: true,
    channels: ['app'],
};
