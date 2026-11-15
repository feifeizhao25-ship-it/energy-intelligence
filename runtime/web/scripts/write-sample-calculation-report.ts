/**
 * 用统一光伏模型 simulateSolar 生成一份标明「示例」的测算报告。
 * 辐照、气温和电价都是本脚本写明的假设，不是某座电站的实测，也不读取省级电价表。
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulateSolar } from '../src/lib/calculator/solar';
import { calculationDocxBuffer } from '../src/lib/reports/calculation-docx';
import type { SolarResource } from '../src/types';

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const ANNUAL_GHI = 1500;
const DAILY_GHI = ANNUAL_GHI / DAYS.reduce((sum, days) => sum + days, 0);
const CAPACITY_KW = 100;
const SELF_USE_PRICE = 0.6;
const FEED_IN_PRICE = 0.35;
const SELF_USE_RATIO = 0.7;

const resource: SolarResource = {
    lat: 32,
    monthly: DAYS.map((days, index) => ({
        month: index + 1,
        ghi: DAILY_GHI,
        temperature: 15,
        days,
    })),
    annual: { ghi: ANNUAL_GHI, peakSunHours: ANNUAL_GHI, optimalTilt: 0, resourceClass: 'III' },
};

const inputs = {
    label: '示例',
    note: '下列输入是脚本里的假设，用来演示计算器。不是实测电站，不读取省级电价表，不构成投资建议。',
    capacityKw: CAPACITY_KW,
    installationType: 'roof',
    moduleType: 'standard',
    tiltDeg: 0,
    azimuthDeg: 180,
    annualGhiKWhPerM2: ANNUAL_GHI,
    monthlyDailyGhiKWhPerM2: DAILY_GHI,
    temperatureC: 15,
    selfUsePriceYuanPerKwh: SELF_USE_PRICE,
    feedInPriceYuanPerKwh: FEED_IN_PRICE,
    selfUseRatio: SELF_USE_RATIO,
    unitCostYuanPerKw: 3000,
};

async function main() {
    const result = simulateSolar(resource, {
        lat: 32,
        province: '江苏',
        capacity: CAPACITY_KW,
        installationType: 'roof',
        moduleType: 'standard',
        tilt: 0,
        azimuth: 180,
        unitCost: 3000,
        selfUsePrice: SELF_USE_PRICE,
        feedInPrice: FEED_IN_PRICE,
        selfUseRatio: SELF_USE_RATIO,
    });
    const generatedAt = new Date('2026-10-27T02:00:00Z');
    const data = {
        ...result,
        metadata: {
            projectName: '示例项目：水平屋顶光伏',
            province: '江苏',
            capacity: CAPACITY_KW,
            pricing: {
                sourceStatus: '用户输入',
                province: '江苏',
                values: { 自用: SELF_USE_PRICE, 上网: FEED_IN_PRICE },
                source: '示例输入，不是省级电价表',
            },
        },
    };
    const here = dirname(fileURLToPath(import.meta.url));
    const outDir = join(here, '../../../docs/report-samples/cn');
    const buffer = await calculationDocxBuffer(data, 'solar', { generatedAt });
    writeFileSync(join(outDir, '测算报告.docx'), buffer);
    writeFileSync(join(outDir, '测算报告.inputs.json'), JSON.stringify({
        inputs,
        energy: {
            year1KWh: result.energy.year1,
            equivalentHours: result.energy.equivalentHours,
            pr: result.energy.pr,
            planeIrradiation: result.energy.planeIrradiation,
            monthlyKWh: result.energy.monthly,
            lifetimeKWh: result.energy.lifetime,
        },
        financial: {
            irr: result.financial.irr,
            paybackYears: result.financial.paybackYears,
            lcoe: result.financial.lcoe,
            investmentYuan: result.financial.investment,
        },
        environmental: result.environmental,
        generatedAt: generatedAt.toISOString(),
        engine: 'simulateSolar',
    }, null, 2));
    console.log(JSON.stringify({
        wrote: join(outDir, '测算报告.docx'),
        year1: result.energy.year1,
        irr: result.financial.irr,
        lcoe: result.financial.lcoe,
    }));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
