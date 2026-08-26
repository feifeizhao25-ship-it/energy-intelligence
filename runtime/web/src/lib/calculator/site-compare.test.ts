import { compareSiteEnergies } from './site-compare';
import { getPriceConfig } from '@/lib/policy/electricity-price';

// Mock dependencies
jest.mock('@/lib/policy/electricity-price', () => ({
    getPriceConfig: jest.fn(() => ({
        retailPrice: 1.0,
        feedInTariff: 0.4,
        peakPrice: 1.5,
        valleyPrice: 0.4
    }))
}));

jest.mock('@/lib/api/nasa-power', () => ({
    getSolarResource: jest.fn(async () => ({ annual: { ghi: 1500, resourceClass: 'B' } })),
    getWindResource: jest.fn(async () => ({ annual: { avgSpeed: 6.0, powerDensity: 300 } }))
}));

// Mock calculations to control IRR
jest.mock('./solar', () => ({
    calculateSolar: jest.fn(async () => ({
        financial: { irr: 10, paybackYears: 6, year1Revenue: 10000, investment: 50000 }
    }))
}));
jest.mock('./wind', () => ({
    calculateWind: jest.fn(async () => ({
        financial: { irr: 7, paybackYears: 9, year1Revenue: 8000, investment: 60000 }
    }))
}));
jest.mock('./storage', () => ({
    calculateStorage: jest.fn(async () => ({
        financial: { metrics: { irr: 5, paybackYears: 11, annualRevenue: 2000 }, investment: { total: 20000 } }
    }))
}));

describe('site-compare aggregator', () => {
    it('prioritizes high IRR solutions', async () => {
        const result = await compareSiteEnergies({ lat: 30, lng: 120, province: 'Zhejiang' });

        expect(result.solar.irr).toBe(10);
        expect(result.wind.irr).toBe(7);
        expect(result.recommendation.type).toBe('SOLAR');
        expect(result.recommendation.reasonSummary.length).toBeGreaterThan(0);
    });

    it('identifies risk correctly', async () => {
        const result = await compareSiteEnergies({ lat: 30, lng: 120, province: 'Zhejiang' });
        expect(result.solar.riskLevel).toBe('low');
    });
});
