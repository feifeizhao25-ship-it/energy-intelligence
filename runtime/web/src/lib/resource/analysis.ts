import { SolarResource, WindResource } from '@/types';

// 资源评分权重
const WEIGHTS = {
    SOLAR: { ghi: 0.6, stability: 0.2, environment: 0.2 },
    WIND: { speed: 0.7, consistency: 0.2, environment: 0.1 }
};

/**
 * 评价太阳能资源等级
 */
export function classifySolarResource(annualGhi: number): string {
    if (annualGhi >= 1750) return '一类 (极佳)';
    if (annualGhi >= 1400) return '二类 (良好)';
    if (annualGhi >= 1050) return '三类 (一般)';
    return '四类 (较差)';
}

/**
 * 评价风能资源等级 (100m)
 */
export function classifyWindResource(speed100m: number): string {
    if (speed100m >= 8.0) return '一类 (极佳)';
    if (speed100m >= 7.0) return '二类 (良好)';
    if (speed100m >= 6.0) return '三类 (可开发)';
    if (speed100m >= 5.0) return '四类 (低风速)';
    return '五类 (较差)';
}

/**
 * 计算光伏开发适宜度评分 (0-100)
 */
export function calculateSolarScore(solar: SolarResource, climate: any): number {
    const ghiScore = Math.min(100, (solar.annual.ghi / 1800) * 100);
    const tempScore = Math.max(0, 100 - Math.max(0, climate.annual.temperature - 25) * 5); // 25度以上每度扣5分
    const precipScore = Math.max(0, 100 - (climate.annual.precipitation / 2000) * 50); // 降水太多扣分

    return Math.round(ghiScore * 0.6 + tempScore * 0.2 + precipScore * 0.2);
}

/**
 * 计算风电开发适宜度评分 (0-100)
 */
export function calculateWindScore(wind: WindResource, climate: any, elevation: number): number {
    const speedScore = Math.min(100, Math.max(0, (wind.annual.avgSpeed - 3) / (10 - 3) * 100));
    const altitudeScore = elevation > 3000 ? 50 : 100; // 高海拔降效

    return Math.round(speedScore * 0.8 + altitudeScore * 0.2);
}

/**
 * 分析光风互补性
 */
export function analyzeComplementarity(solar: SolarResource, wind: WindResource) {
    // 简单的皮尔逊相关系数计算
    const n = 12;
    const x = solar.monthly.map(m => m.ghi);
    const y = wind.monthly.map(m => m.speed100m);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);
    const sumY2 = y.reduce((a, b) => a + b * b, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    const correlation = numerator / denominator;

    // 负相关性越强，互补性越好
    const score = (1 - correlation) / 2 * 100; // -1 -> 100, 1 -> 0

    let description = '弱';
    if (score > 70) description = '极佳';
    else if (score > 50) description = '良好';

    return {
        correlation,
        score,
        description
    };
}
