/**
 * 排放因子门禁：全站只能有一个电网排放因子（lib/standards/emission-factor.ts）。
 * 旧的 0.785、0.5839、区域电网表（无来源年份）和 550 g 一旦在 src 里重新出现就失败。
 */
import fs from 'fs';
import path from 'path';
import { GRID_EMISSION_FACTOR, EMISSION_FACTOR_NOTE, co2AvoidedKg } from './emission-factor';

const SRC = path.resolve(__dirname, '../..');
const SELF = path.resolve(__dirname, 'emission-factor.ts');

function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full);
        return /\.(ts|tsx|js|jsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [full] : [];
    });
}

const FORBIDDEN: Array<[RegExp, string]> = [
    [/(?<![\d.])0\.0*785(?!\d)/, '旧全国因子 0.785'],
    [/0\.5839/, '旧因子 0.5839'],
    [/0\.8843|0\.8179|0\.7035|0\.5257|0\.8922|0\.5271/, '无来源年份的区域电网因子'],
    [/carbon_intensity\s*\|\|\s*550|(?<![\d.])550\s*,?\s*\/\/\s*gCO2/, '旧回退值 550 gCO2/kWh'],
    [/0\.5703/, '碳市场核算口径 0.5703（未核实是否更新，不在测算里使用）'],
];

describe('电网排放因子统一', () => {
    it('数值、年份、来源与公告一致', () => {
        expect(GRID_EMISSION_FACTOR.value).toBe(0.5306);
        expect(GRID_EMISSION_FACTOR.year).toBe(2023);
        expect(GRID_EMISSION_FACTOR.source).toBe('生态环境部、国家统计局公告 2025 年第 47 号');
        expect(EMISSION_FACTOR_NOTE).toBe('按 2023 年全国电力平均排放因子 0.5306 kg/kWh 计算');
        // 手算：10,000 kWh × 0.5306 = 5,306 kg
        expect(co2AvoidedKg(10_000)).toBeCloseTo(5306, 6);
    });

    it('src 里不再出现旧排放因子', () => {
        const hits: string[] = [];
        for (const file of sourceFiles(SRC).filter(f => f !== SELF)) {
            const text = fs.readFileSync(file, 'utf8');
            for (const [pattern, label] of FORBIDDEN) {
                if (pattern.test(text)) hits.push(`${path.relative(SRC, file)}：${label}`);
            }
        }
        expect(hits).toEqual([]);
    });

    it('数字 0.5306 只写在常量模块里', () => {
        const hits = sourceFiles(SRC)
            .filter(file => file !== SELF && /0\.5306/.test(fs.readFileSync(file, 'utf8')))
            .map(file => path.relative(SRC, file));
        expect(hits).toEqual([]);
    });
});
