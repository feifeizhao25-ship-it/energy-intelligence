// 电价政策测试
import { getPriceConfig, PROVINCE_PRICES, ElectricityPriceConfig } from './electricity-price';

describe('Electricity Price Policy', () => {
    describe('getPriceConfig', () => {
        it('should return correct config for known provinces', () => {
            const beijingConfig = getPriceConfig('北京');

            expect(beijingConfig.province).toBe('北京');
            expect(beijingConfig.retailPrice).toBe(0.85);
            expect(beijingConfig.feedInTariff).toBe(0.3533);
            expect(beijingConfig.peakValleySupport).toBe(true);
            expect(beijingConfig.peakPrice).toBe(1.25);
            expect(beijingConfig.valleyPrice).toBe(0.28);
        });

        it('should return config for Shanghai', () => {
            const config = getPriceConfig('上海');

            expect(config.province).toBe('上海');
            expect(config.retailPrice).toBe(0.92);
            expect(config.peakPrice).toBe(1.35);
        });

        it('should return config for Jiangsu', () => {
            const config = getPriceConfig('江苏');

            expect(config.province).toBe('江苏');
            expect(config.retailPrice).toBe(0.78);
            expect(config.peakValleySupport).toBe(true);
        });

        it('should return config for Zhejiang', () => {
            const config = getPriceConfig('浙江');

            expect(config.province).toBe('浙江');
            expect(config.retailPrice).toBe(0.82);
        });

        it('should return config for Guangdong', () => {
            const config = getPriceConfig('广东');

            expect(config.province).toBe('广东');
            expect(config.retailPrice).toBe(0.88);
        });

        it('should return config for Shandong', () => {
            const config = getPriceConfig('山东');

            expect(config.province).toBe('山东');
            expect(config.retailPrice).toBe(0.72);
            // 山东中午深谷特点
            expect(config.valleys).toEqual([{ start: 11, end: 14 }]);
        });

        it('should return config for Hebei', () => {
            const config = getPriceConfig('河北');

            expect(config.province).toBe('河北');
            expect(config.retailPrice).toBe(0.68);
        });

        it('should return default config for unknown province', () => {
            const config = getPriceConfig('未知省份');

            expect(config.province).toBe('通用');
            expect(config.retailPrice).toBe(0.75);
            expect(config.feedInTariff).toBe(0.4);
            expect(config.peakValleySupport).toBe(false);
            expect(config.peaks).toEqual([]);
            expect(config.valleys).toEqual([]);
        });
    });

    describe('PROVINCE_PRICES data integrity', () => {
        it('should have valid price data for all provinces', () => {
            Object.entries(PROVINCE_PRICES).forEach(([province, config]) => {
                expect(config.province).toBe(province);
                expect(config.retailPrice).toBeGreaterThan(0);
                expect(config.retailPrice).toBeLessThan(2);
                expect(config.feedInTariff).toBeGreaterThan(0);
                expect(config.feedInTariff).toBeLessThan(1);
            });
        });

        it('should have peak price higher than valley price when peak-valley supported', () => {
            Object.values(PROVINCE_PRICES).forEach(config => {
                if (config.peakValleySupport && config.peakPrice && config.valleyPrice) {
                    expect(config.peakPrice).toBeGreaterThan(config.valleyPrice);
                }
            });
        });

        it('should have valid time periods for peaks and valleys', () => {
            Object.values(PROVINCE_PRICES).forEach(config => {
                config.peaks.forEach(peak => {
                    expect(peak.start).toBeGreaterThanOrEqual(0);
                    expect(peak.start).toBeLessThanOrEqual(24);
                    expect(peak.end).toBeGreaterThanOrEqual(0);
                    expect(peak.end).toBeLessThanOrEqual(24);
                });

                config.valleys.forEach(valley => {
                    expect(valley.start).toBeGreaterThanOrEqual(0);
                    expect(valley.start).toBeLessThanOrEqual(24);
                    expect(valley.end).toBeGreaterThanOrEqual(0);
                    expect(valley.end).toBeLessThanOrEqual(24);
                });
            });
        });
    });

    describe('Peak-Valley Price Spread', () => {
        it('should have reasonable peak-valley spread for arbitrage', () => {
            const minSpread = 0.5; // 最小价差应该大于0.5元才有套利空间

            Object.values(PROVINCE_PRICES).forEach(config => {
                if (config.peakValleySupport && config.peakPrice && config.valleyPrice) {
                    const spread = config.peakPrice - config.valleyPrice;
                    expect(spread).toBeGreaterThan(minSpread);
                }
            });
        });
    });
});
