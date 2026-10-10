// API: 首页快速估算（无需登录）
//
// 原来这里是第三套光伏口径：城市表里写死「年等效峰值小时数」（与同表的日均辐照对不上，北京 4.35×365=1588 却写 1450），
// 年发电 = 峰值小时 × 容量 × 0.82，电价写死 0.6 元/度，IRR 用「总收益年化」粗估；没匹配到城市就按「中国平均」编一个结果；
// 首页还另按 0.5 元/度算「预计年收益」。现在城市表只提供坐标，发电量与财务一律调用统一光伏模型 simulateSolar，
// 电价取省级电价表（工商业平均电价，标注来源状态与数据截至）；电价表没有的省份不给收益数字。
import { NextRequest, NextResponse } from 'next/server';
import { co2AvoidedKg } from '@/lib/standards/emission-factor';
import { loadSolarResource } from '@/lib/calculator/solar-resource';
import { simulateSolar } from '@/lib/calculator/solar';
import { paybackPeriodOf } from '@/lib/calculator/project-finance';
import { lookupTariff, sourceStatusLabel } from '@/lib/pricing/tariffs';
import { enforceRateLimit, PUBLIC_RULES } from '@/lib/security/rate-limit';

/** 首页估算用的单位造价（元/kW），只用于回收期与 IRR，页面上写明 */
const QUICK_UNIT_COST = 3500;

// 城市坐标（只用于定位取 NASA POWER 资源数据与省级电价）
const CITY_COORDINATES: Record<string, { lat: number; lng: number; province: string }> = {
    '北京': { lat: 39.9042, lng: 116.4074, province: '北京市' },
    '上海': { lat: 31.2304, lng: 121.4737, province: '上海市' },
    '广州': { lat: 23.1291, lng: 113.2644, province: '广东省' },
    '深圳': { lat: 22.5431, lng: 114.0579, province: '广东省' },
    '杭州': { lat: 30.2741, lng: 120.1551, province: '浙江省' },
    '成都': { lat: 30.5728, lng: 104.0668, province: '四川省' },
    '武汉': { lat: 30.5928, lng: 114.3055, province: '湖北省' },
    '西安': { lat: 34.3416, lng: 108.9398, province: '陕西省' },
    '南京': { lat: 32.0603, lng: 118.7969, province: '江苏省' },
    '天津': { lat: 39.1422, lng: 117.1767, province: '天津市' },
    '苏州': { lat: 31.2989, lng: 120.5853, province: '江苏省' },
    '重庆': { lat: 29.4316, lng: 106.9123, province: '重庆市' },
    '郑州': { lat: 34.7466, lng: 113.6254, province: '河南省' },
    '长沙': { lat: 28.2282, lng: 112.9388, province: '湖南省' },
    '青岛': { lat: 36.0671, lng: 120.3826, province: '山东省' },
    '大连': { lat: 38.9140, lng: 121.6147, province: '辽宁省' },
    '厦门': { lat: 24.4798, lng: 118.0894, province: '福建省' },
    '合肥': { lat: 31.8206, lng: 117.2272, province: '安徽省' },
    '济南': { lat: 36.6512, lng: 117.1201, province: '山东省' },
    '福州': { lat: 26.0745, lng: 119.2965, province: '福建省' },
    '海口': { lat: 20.0442, lng: 110.1999, province: '海南省' },
    '昆明': { lat: 25.0389, lng: 102.7183, province: '云南省' },
    '呼和浩特': { lat: 40.8414, lng: 111.7519, province: '内蒙古' },
    '乌鲁木齐': { lat: 43.8256, lng: 87.6168, province: '新疆' },
    '拉萨': { lat: 29.6500, lng: 91.1000, province: '西藏' },
    '银川': { lat: 38.4872, lng: 106.2309, province: '宁夏' },
    '西宁': { lat: 36.6171, lng: 101.7782, province: '青海省' },
    '兰州': { lat: 36.0611, lng: 103.8343, province: '甘肃省' },
    '太原': { lat: 37.8706, lng: 112.5489, province: '山西省' },
    '石家庄': { lat: 38.0428, lng: 114.5149, province: '河北省' },
    '沈阳': { lat: 41.8057, lng: 123.4315, province: '辽宁省' },
    '长春': { lat: 43.8171, lng: 125.3235, province: '吉林省' },
    '哈尔滨': { lat: 45.8038, lng: 126.5350, province: '黑龙江' },
    '南昌': { lat: 28.6820, lng: 115.8579, province: '江西省' },
    '贵阳': { lat: 26.6470, lng: 106.6302, province: '贵州省' },
    '南宁': { lat: 22.8170, lng: 108.3665, province: '广西' },
};

export async function POST(req: NextRequest) {
    const limited = await enforceRateLimit(req, PUBLIC_RULES.calculators);
    if (limited) return limited;
    try {
        const { location, capacity: rawCapacity } = await req.json();
        const capacity = Number(rawCapacity);
        if (!location || typeof location !== 'string' || !(capacity > 0) || capacity > 1_000_000) {
            return NextResponse.json({ error: 'INVALID_INPUT', message: '请输入城市和大于 0 的装机容量' }, { status: 400 });
        }

        const matchedCity = Object.keys(CITY_COORDINATES).find(city => location.includes(city));
        if (!matchedCity) {
            // 不再按「中国平均」编一个结果
            return NextResponse.json({
                error: 'CITY_NOT_SUPPORTED',
                message: `首页快速估算暂只支持 ${Object.keys(CITY_COORDINATES).length} 个主要城市（如南京、济南、广州），请输入城市名；其他地点请在光伏测算里填写经纬度`,
            }, { status: 422 });
        }
        const { lat, lng, province } = CITY_COORDINATES[matchedCity];

        // 电价：省级电价表的工商业平均电价；已取消固定分时或未收录的省份不估算收益
        const tariff = lookupTariff(province);
        const price = tariff.status === 'ok' ? tariff.retailPrice : null;

        const resource = await loadSolarResource(lat, lng);
        const model = simulateSolar(resource, {
            capacity,
            installationType: 'roof',
            moduleType: 'standard',
            unitCost: QUICK_UNIT_COST,
            selfUsePrice: price ?? 0,
            feedInPrice: price ?? 0,
            selfUseRatio: 1,
        });
        const annualGeneration = Math.round(model.energy.year1);
        const annualRevenue = price === null ? null : Math.round(model.financial.year1Revenue);
        const co2Reduction = Math.round(co2AvoidedKg(annualGeneration));
        const payback = price === null ? null : paybackPeriodOf(model.financial.investment, model.financial.cashFlow);

        return NextResponse.json({
            success: true,
            data: {
                location: { address: location, city: matchedCity, province, lat, lng },
                resource: { annualGhi: Math.round(resource.annual.ghi), pr: Number(model.energy.pr.toFixed(3)) },
                energy: {
                    annualGeneration,
                    dailyGeneration: Math.round(annualGeneration / 365),
                    monthly: model.energy.monthly,
                },
                financial: {
                    annualRevenue,
                    monthlyRevenue: annualRevenue === null ? null : Math.round(annualRevenue / 12),
                    totalInvestment: model.financial.investment,
                    paybackYears: payback === null ? null : Math.round(payback * 10) / 10,
                    irr: price === null ? null : Math.round(model.financial.irr * 10) / 10,
                },
                environmental: { co2Reduction, treesEquivalent: Math.round(co2Reduction / 22) },
                pricing: tariff.status === 'ok'
                    ? { price, label: `${province}工商业平均电价 ${price} 元/度（${sourceStatusLabel(tariff.tariff)}，${tariff.freshness.label}${tariff.freshness.staleNote ? `，${tariff.freshness.staleNote}` : ''}）` }
                    : { price: null, label: `${tariff.message}，未估算收益` },
                assumptions: `屋顶安装、标准组件、最佳倾角朝南；单位造价按 ${QUICK_UNIT_COST} 元/kW；全部电量按工商业平均电价计；统一光伏模型（与完整测算同一套）`,
            },
            metadata: {
                type: 'quick_estimate',
                dataSource: 'NASA POWER 上一完整年辐照与气温',
                disclaimer: '此为快速估算结果，仅供参考；详细分析请登录使用完整计算器',
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error: unknown) {
        console.error('Quick calculation error:', error);
        return NextResponse.json({ error: 'CALCULATION_ERROR', message: '计算失败，请稍后重试' }, { status: 500 });
    }
}
