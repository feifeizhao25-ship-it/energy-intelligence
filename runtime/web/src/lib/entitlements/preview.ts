/**
 * 首页「价格方案」预览：直接取权益注册表（entitlements.json，与定价页同一来源），不再在首页另写一份。
 * 原来首页手写「每日2次测算 / 最多1个项目 / 数据保留7天」「PDF与Word导出」等，与各档实际权益容易对不上。
 */
import registry from './entitlements.json';

interface Tier { name: string; price: { monthly_cny: number; yearly_cny: number }; features_zh: string[] }

export function homePricingPreview(keys: string[] = ['free', 'pro', 'enterprise']) {
    const tiers = (registry as unknown as { tiers: Record<string, Tier> }).tiers;
    return keys.filter(k => tiers[k]).map(k => {
        const t = tiers[k];
        const price = t.price.monthly_cny > 0 ? `¥${t.price.monthly_cny}/月` : t.price.yearly_cny > 0 ? `¥${t.price.yearly_cny.toLocaleString('en-US')}/年` : '¥0';
        return { key: k, name: t.name, price, features: t.features_zh.slice(0, 4), popular: k === 'pro' };
    });
}
