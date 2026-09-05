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
        content: `今天${weatherText}。尚无经验证的电站发电预测及电价数据，暂不提供发电量和收益预测。`,
        summary: {
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
    if (stations.length === 0 || stations.some(station =>
        !Number.isFinite(station.todayGeneration) || station.todayGeneration < 0
        || !Number.isFinite(station.todayRevenue))) {
        return {
            type: 'evening',
            title: '📊 今日发电报告',
            content: '暂无完整有效的电站数据，暂不生成发电量、收益和环比汇总。',
            summary: {},
            actions: [{ label: '核对电站数据', url: '/my/stations' }],
        };
    }
    const totalGeneration = stations.reduce((sum, s) => sum + s.todayGeneration, 0);
    const totalRevenue = stations.reduce((sum, s) => sum + s.todayRevenue, 0);
    const hasYesterday = typeof yesterdayGeneration === 'number'
        && Number.isFinite(yesterdayGeneration)
        && yesterdayGeneration >= 0;
    let comparisonText = '暂无昨日可比数据';
    if (hasYesterday && yesterdayGeneration === 0) {
        comparisonText = totalGeneration === 0 ? '与昨日持平' : '昨日发电量为 0，暂不计算环比';
    } else if (hasYesterday && totalGeneration === yesterdayGeneration) {
        comparisonText = '与昨日持平';
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
            content: `${station.name} 今日记录发电量 ${station.todayGeneration} kWh。请核对告警来源、同期基线和采集完整性，尚不能确定异常幅度或原因。`,
            actions: [
                { label: '查看电站', url: `/my/stations/${station.id}` },
                { label: '申请诊断', url: '/maintenance/diagnosis' },
            ],
        },
        cleaning: {
            title: '🧹 建议清洗',
            content: `${station.name} 记录效率 ${station.efficiency}%。请先核对指标定义和现场巡检记录，再决定是否需要清洗。`,
            actions: [
                { label: '查看详情', url: `/my/stations/${station.id}` },
                { label: '预约清洗', url: '/maintenance/cleaning' },
            ],
        },
        fault: {
            title: '🚨 设备告警',
            content: `${station.name} 收到设备告警核查请求。请以原始设备事件和运维确认结果为准，当前报告未验证具体故障。`,
            actions: [
                { label: '查看详情', url: `/my/stations/${station.id}` },
                { label: '联系运维', url: '/support' },
            ],
        },
        efficiency: {
            title: '📉 效率下降',
            content: `${station.name} 收到效率核查请求。缺少已验证的历史基线，暂不能判断下降幅度和故障原因。`,
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
    // Station totals alone contain no verified alarm event or comparable
    // forecast baseline. Do not infer equipment faults from fixed thresholds.
    return [];
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
    enabled: false,
    morningReport: true,
    eveningReport: true,
    alerts: true,
    weeklyDigest: true,
    channels: ['app'],
};
