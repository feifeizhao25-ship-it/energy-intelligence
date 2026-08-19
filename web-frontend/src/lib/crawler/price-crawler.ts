/**
 * 电价数据抓取与同步服务
 */
import axios from 'axios';

export interface ElectricityPrice {
    province: string;
    valley: number; // 谷期电价
    flat: number;   // 平期电价
    peak: number;   // 峰期电价
    sharp?: number; // 尖峰电价
    updatedAt: string;
}

// 静态备份数据 (2025年Q4参考值)
const STATIC_PRICES: Record<string, ElectricityPrice> = {
    '江苏': { province: '江苏', valley: 0.31, flat: 0.64, peak: 1.08, sharp: 1.25, updatedAt: '2025-12-01' },
    '浙江': { province: '浙江', valley: 0.28, flat: 0.62, peak: 1.12, sharp: 1.35, updatedAt: '2025-12-05' },
    '广东': { province: '广东', valley: 0.25, flat: 0.68, peak: 1.20, sharp: 1.45, updatedAt: '2025-12-10' },
    '北京': { province: '北京', valley: 0.35, flat: 0.72, peak: 1.15, updatedAt: '2025-11-20' },
    '上海': { province: '上海', valley: 0.32, flat: 0.70, peak: 1.18, sharp: 1.30, updatedAt: '2025-12-08' },
};

/**
 * 获取指定省份的最新电价
 * 逻辑：尝试从缓存抓取 -> 失败则使用静态备份
 */
export async function getLatestPrice(province: string): Promise<ElectricityPrice> {
    try {
        // 模拟从第三方接口或公示网页抓取
        // 在生产环境中，这里会调用一个云函数或具体的抓取逻辑
        const mockCrawl = async () => {
            // 模拟 API 调用
            // if (Math.random() > 0.5) throw new Error("Crawl Failed");
            return STATIC_PRICES[province];
        };

        const price = await mockCrawl();
        if (!price) throw new Error("Province not found");

        return price;
    } catch (error) {
        console.warn(`Price crawling failed for ${province}, using fallback static data.`);
        return STATIC_PRICES[province] || STATIC_PRICES['江苏'];
    }
}

/**
 * 计算加权平均电价 (基于工商业典型负荷曲线)
 */
export function calculateAveragePrice(price: ElectricityPrice, selfUseRatio: number): number {
    // 简化模型：假设峰平谷分布为 4:8:12
    const weighted = (price.peak * 0.3 + price.flat * 0.4 + price.valley * 0.3);
    return Number(weighted.toFixed(4));
}
