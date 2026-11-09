/**
 * E35：国际版（runtime/web-int）的光伏筛查内核是国内内核的复制件（web-int 用自己的 Docker
 * 构建上下文，不能直接 import runtime/web）。复制件曾经漂移过：国内改成逐月 SAPM 组件温度后，
 * 国际版仍按「环境温度 + 20°C、0.4%/°C」计算，文件头却写着「同一套公式」。
 *
 * 这里把两边放在同一组输入上比：
 * 1. 平面辐照换算（transposition.ts）逐点完全一致；
 * 2. 损耗常数与地面安装系数一致；
 * 3. 整个筛查结果（逐月发电量、年发电量、平面辐照、PR）与国内 simulateSolar 地面安装一致。
 */
jest.mock('@/lib/services/policy-service', () => ({
    PolicyService: { getActivePolicies: jest.fn(async () => []) },
}));

import * as cnT from './transposition';
import * as intlT from '../../../../web-int/src/lib/transposition';
import { LOSS_ASSUMPTIONS as CN_LOSS, MODULE_GAMMA_PER_C as CN_GAMMA, monthTemperatureFactor as cnMonthTemp, simulateSolar } from './solar';
import {
    INSTALLATION as INTL_INSTALLATION,
    LOSS_ASSUMPTIONS as INTL_LOSS,
    MODULE_GAMMA_PER_C as INTL_GAMMA,
    monthTemperatureFactor as intlMonthTemp,
    monthlyGhiDaily,
    solarScreening,
} from '../../../../web-int/src/lib/solar-kernel';

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const LATS = [-33.9, 0, 18.5, 32.06, 40.7, 51.5, 60.2];

describe('international solar kernel copy matches the CN kernel', () => {
    test('transposition gives identical numbers on a grid', () => {
        for (const lat of LATS) {
            expect(intlT.empiricalOptimalTilt(lat)).toBe(cnT.empiricalOptimalTilt(lat));
            for (let month = 1; month <= 12; month++) {
                for (const tilt of [0, 15, 30, 45]) {
                    for (const azimuth of [90, 180, 270]) {
                        expect(intlT.monthGeometry(lat, month, tilt, azimuth)).toEqual(cnT.monthGeometry(lat, month, tilt, azimuth));
                        for (const ghi of [1.2, 4, 6.8]) {
                            expect(intlT.poaDaily({ lat, month, ghi, tilt, azimuth })).toBe(cnT.poaDaily({ lat, month, ghi, tilt, azimuth }));
                        }
                    }
                }
            }
        }
    });

    test('loss constants and temperature model are the same', () => {
        expect(INTL_LOSS).toEqual(CN_LOSS);
        expect(INTL_GAMMA).toBe(CN_GAMMA);
        // CN INSTALLATION_FACTORS.ground (not exported); the end-to-end test below would catch a drift too.
        expect(INTL_INSTALLATION).toEqual({ shadingLoss: 0.01, mismatchLoss: 0.02, dcLoss: 0.015, inverterEfficiency: 0.97 });
        for (const lat of LATS) {
            for (let month = 1; month <= 12; month++) {
                for (const [air, poa] of [[-5, 1.5], [20, 4.5], [35, 7]]) {
                    expect(intlMonthTemp(air, poa, lat, month)).toBe(
                        cnMonthTemp({ airC: air, dailyPoaKwhM2: poa, lat, month, installationType: 'ground' }),
                    );
                }
            }
        }
    });

    test.each([
        { capacityKw: 100, annualGhiKwhPerM2: 1500, latitude: 32.06 },
        { capacityKw: 2000, annualGhiKwhPerM2: 1900, latitude: 18.5, ambientTempC: 28 },
        { capacityKw: 50, annualGhiKwhPerM2: 1000, latitude: 51.5, ambientTempC: 10, tiltDeg: 35 },
        { capacityKw: 500, annualGhiKwhPerM2: 2100, latitude: -33.9, ambientTempC: 18 },
    ])('screening equals CN simulateSolar (ground) for %o', (input) => {
        const intl = solarScreening(input);
        const ghi = monthlyGhiDaily(input.annualGhiKwhPerM2, input.latitude);
        const air = input.ambientTempC ?? 20;
        const cn = simulateSolar(
            {
                lat: input.latitude,
                monthly: ghi.map((g, i) => ({ month: i + 1, ghi: g, temperature: air, days: DAYS[i] })),
                annual: { ghi: input.annualGhiKwhPerM2, peakSunHours: input.annualGhiKwhPerM2 / 365, optimalTilt: intl.tiltDeg, resourceClass: 'II' },
            },
            {
                lat: input.latitude, capacity: input.capacityKw, installationType: 'ground', moduleType: 'standard',
                tilt: intl.tiltDeg, azimuth: 180, selfUsePrice: 0.5, feedInPrice: 0.3, selfUseRatio: 0.5,
            },
        );
        expect(intl.monthlyGenerationKwh).toEqual(cn.energy.monthly);
        expect(intl.annualGenerationKwh).toBe(cn.energy.year1);
        expect(intl.planeIrradiationKwhPerM2).toBe(Math.round(cn.energy.planeIrradiation));
        expect(intl.performanceRatio).toBe(Math.round(cn.energy.pr * 1000) / 1000);
        expect(intl.specificYieldKwhPerKw).toBe(Math.round(cn.energy.specificYield));
    });
});
