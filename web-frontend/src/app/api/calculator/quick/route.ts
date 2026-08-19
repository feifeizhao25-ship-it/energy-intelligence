// API: 快速计算（无需登录）- 用于首页快速估算
// 使用本地太阳辐照数据，无需调用外部API，确保即时响应
import { NextRequest, NextResponse } from 'next/server';

// 中国主要城市太阳辐照数据 (年均GHI kWh/m²/day, 等效峰值日照小时数)
// 数据来源：NASA POWER API 历史平均值
const CITY_SOLAR_DATA: Record<string, {
    lat: number;
    lng: number;
    province: string;
    ghi: number;        // 年均日辐照量 kWh/m²/day
    peakHours: number;  // 年等效峰值日照小时数
}> = {
    '北京': { lat: 39.9042, lng: 116.4074, province: '北京市', ghi: 4.35, peakHours: 1450 },
    '上海': { lat: 31.2304, lng: 121.4737, province: '上海市', ghi: 3.89, peakHours: 1200 },
    '广州': { lat: 23.1291, lng: 113.2644, province: '广东省', ghi: 4.12, peakHours: 1150 },
    '深圳': { lat: 22.5431, lng: 114.0579, province: '广东省', ghi: 4.08, peakHours: 1130 },
    '杭州': { lat: 30.2741, lng: 120.1551, province: '浙江省', ghi: 3.92, peakHours: 1180 },
    '成都': { lat: 30.5728, lng: 104.0668, province: '四川省', ghi: 3.45, peakHours: 950 },
    '武汉': { lat: 30.5928, lng: 114.3055, province: '湖北省', ghi: 3.85, peakHours: 1120 },
    '西安': { lat: 34.3416, lng: 108.9398, province: '陕西省', ghi: 4.12, peakHours: 1280 },
    '南京': { lat: 32.0603, lng: 118.7969, province: '江苏省', ghi: 3.95, peakHours: 1200 },
    '天津': { lat: 39.1422, lng: 117.1767, province: '天津市', ghi: 4.28, peakHours: 1420 },
    '苏州': { lat: 31.2989, lng: 120.5853, province: '江苏省', ghi: 3.88, peakHours: 1180 },
    '重庆': { lat: 29.4316, lng: 106.9123, province: '重庆市', ghi: 3.25, peakHours: 900 },
    '郑州': { lat: 34.7466, lng: 113.6254, province: '河南省', ghi: 4.05, peakHours: 1280 },
    '长沙': { lat: 28.2282, lng: 112.9388, province: '湖南省', ghi: 3.68, peakHours: 1050 },
    '青岛': { lat: 36.0671, lng: 120.3826, province: '山东省', ghi: 4.22, peakHours: 1380 },
    '大连': { lat: 38.9140, lng: 121.6147, province: '辽宁省', ghi: 4.35, peakHours: 1420 },
    '厦门': { lat: 24.4798, lng: 118.0894, province: '福建省', ghi: 4.05, peakHours: 1180 },
    '合肥': { lat: 31.8206, lng: 117.2272, province: '安徽省', ghi: 3.92, peakHours: 1200 },
    '济南': { lat: 36.6512, lng: 117.1201, province: '山东省', ghi: 4.18, peakHours: 1350 },
    '福州': { lat: 26.0745, lng: 119.2965, province: '福建省', ghi: 3.95, peakHours: 1150 },
    '海口': { lat: 20.0442, lng: 110.1999, province: '海南省', ghi: 4.55, peakHours: 1450 },
    '昆明': { lat: 25.0389, lng: 102.7183, province: '云南省', ghi: 5.02, peakHours: 1650 },
    '呼和浩特': { lat: 40.8414, lng: 111.7519, province: '内蒙古', ghi: 4.85, peakHours: 1580 },
    '乌鲁木齐': { lat: 43.8256, lng: 87.6168, province: '新疆', ghi: 4.95, peakHours: 1620 },
    '拉萨': { lat: 29.6500, lng: 91.1000, province: '西藏', ghi: 6.25, peakHours: 2100 },
    '银川': { lat: 38.4872, lng: 106.2309, province: '宁夏', ghi: 5.15, peakHours: 1680 },
    '西宁': { lat: 36.6171, lng: 101.7782, province: '青海省', ghi: 5.35, peakHours: 1750 },
    '兰州': { lat: 36.0611, lng: 103.8343, province: '甘肃省', ghi: 4.85, peakHours: 1580 },
    '太原': { lat: 37.8706, lng: 112.5489, province: '山西省', ghi: 4.38, peakHours: 1420 },
    '石家庄': { lat: 38.0428, lng: 114.5149, province: '河北省', ghi: 4.25, peakHours: 1380 },
    '沈阳': { lat: 41.8057, lng: 123.4315, province: '辽宁省', ghi: 4.15, peakHours: 1350 },
    '长春': { lat: 43.8171, lng: 125.3235, province: '吉林省', ghi: 4.05, peakHours: 1320 },
    '哈尔滨': { lat: 45.8038, lng: 126.5350, province: '黑龙江', ghi: 3.95, peakHours: 1280 },
    '南昌': { lat: 28.6820, lng: 115.8579, province: '江西省', ghi: 3.85, peakHours: 1120 },
    '贵阳': { lat: 26.6470, lng: 106.6302, province: '贵州省', ghi: 3.45, peakHours: 950 },
    '南宁': { lat: 22.8170, lng: 108.3665, province: '广西', ghi: 4.02, peakHours: 1150 },
};

// 默认值（中国平均）
const DEFAULT_SOLAR = { ghi: 4.2, peakHours: 1300, lat: 35.0, lng: 105.0, province: '中国' };

/**
 * 快速光伏发电量估算 - 无需登录
 * 使用本地预设数据，确保即时响应
 */
export async function POST(req: NextRequest) {
    try {
        const { location, capacity } = await req.json();

        if (!location || !capacity) {
            return NextResponse.json(
                { error: 'INVALID_INPUT', message: '缺少地址或容量参数' },
                { status: 400 }
            );
        }

        // 1. 查找匹配的城市
        const matchedCity = Object.keys(CITY_SOLAR_DATA).find(city =>
            location.includes(city)
        );

        let solarData;
        if (matchedCity) {
            solarData = CITY_SOLAR_DATA[matchedCity];
        } else {
            // 使用默认中国平均值
            solarData = { ...DEFAULT_SOLAR };
        }

        const { lat, lng, province, ghi, peakHours } = solarData;

        // 2. 快速计算
        // 年发电量 = 等效峰值日照小时数 × 容量 × 系统效率(~0.82)
        const systemEfficiency = 0.82;
        const annualGeneration = Math.round(peakHours * capacity * systemEfficiency);

        // 日均和月均发电量
        const dailyGeneration = Math.round(annualGeneration / 365);
        const monthlyGeneration = Math.round(annualGeneration / 12);

        // 收益估算 - 假设自用价格0.6元/kWh
        const electricityPrice = 0.6;
        const annualRevenue = Math.round(annualGeneration * electricityPrice);
        const monthlyRevenue = Math.round(annualRevenue / 12);

        // 碳减排计算
        const co2Factor = 0.785; // kgCO2/kWh
        const co2Reduction = Math.round(annualGeneration * co2Factor);
        const treesEquivalent = Math.round(co2Reduction / 22);

        // 投资估算
        const unitCost = 3500; // 元/kW 当前市场价格
        const totalInvestment = capacity * unitCost;
        const simplePayback = totalInvestment / annualRevenue;

        // IRR 估算 (简化版)
        const estimatedIRR = calculateSimpleIRR(totalInvestment, annualRevenue);

        return NextResponse.json({
            success: true,
            data: {
                location: {
                    address: location,
                    city: matchedCity || '未知城市',
                    province,
                    lat,
                    lng
                },
                resource: {
                    ghi: ghi,
                    peakHours: peakHours,
                    equivalentHours: Math.round(peakHours * systemEfficiency)
                },
                energy: {
                    annualGeneration,
                    dailyGeneration,
                    monthlyGeneration
                },
                financial: {
                    annualRevenue,
                    monthlyRevenue,
                    totalInvestment,
                    paybackYears: Math.round(simplePayback * 10) / 10,
                    irr: Math.round(estimatedIRR * 10) / 10
                },
                environmental: {
                    co2Reduction,
                    treesEquivalent
                }
            },
            metadata: {
                type: 'quick_estimate',
                dataSource: matchedCity ? 'city_database' : 'china_average',
                disclaimer: '此为快速估算结果，详细分析请登录使用完整计算器',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error: unknown) {
        console.error('Quick calculation error:', error);
        return NextResponse.json(
            { error: 'CALCULATION_ERROR', message: '计算失败，请稍后重试' },
            { status: 500 }
        );
    }
}

/**
 * 简化IRR计算
 */
function calculateSimpleIRR(investment: number, annualRevenue: number): number {
    // 使用简化公式估算25年项目IRR
    // 考虑0.5%年衰减和1%运维成本
    const years = 25;
    const degradation = 0.005;
    const omRate = 0.01;

    let totalRevenue = 0;
    for (let y = 0; y < years; y++) {
        const yearRevenue = annualRevenue * Math.pow(1 - degradation, y);
        const omCost = investment * omRate * Math.pow(1.02, y);
        totalRevenue += yearRevenue - omCost;
    }

    // 简化IRR估算
    const roi = (totalRevenue - investment) / investment;
    const annualizedROI = Math.pow(1 + roi, 1 / years) - 1;

    return annualizedROI * 100;
}
