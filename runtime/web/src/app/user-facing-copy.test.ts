/**
 * 用户可见文案门禁：结果页、报告里不出现内部程序名（price-crawler 等）、「来源：来源待核实」这样的重复，
 * 指标名配中文；风电装机单位不写 kWp。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TARIFFS, priceAsOfText, lookupTariff } from '@/lib/pricing/tariffs';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('用户可见文案', () => {
    it('电价来源不含内部程序名，电价说明不出现「来源：来源待核实」', () => {
        for (const t of Object.values(TARIFFS)) {
            expect(t.source).not.toMatch(/price-crawler|electricity-price|tariffs\.ts|[A-Za-z_]+\.ts/);
        }
        const js = lookupTariff('江苏');
        if (js.status !== 'ok') throw new Error('江苏应有电价');
        const text = priceAsOfText({ asOfLabel: js.freshness.label, staleNote: js.freshness.staleNote, source: js.tariff.source });
        expect(text).not.toContain('来源：来源');
        expect(text).toContain('来源待核实：原参考电价表注明为 2025 年第四季度参考值');
    });

    it('结果页指标名配中文；装机单位按类型（风电不写 kWp）', () => {
        const page = read('src/app/(dashboard)/calculator/result/page.tsx');
        expect(page).toContain('label="内部收益率（IRR）"');
        expect(page).toContain('label="平准化度电成本（LCOE）"');
        expect(page).not.toContain('label="项目 IRR"');
        expect(page).toContain("type === 'solar' || !type ? 'kWp' : 'kW'");
    });

    it('风电页参数单位用中文（兆瓦、米），不被大写成「(M)」', () => {
        const wind = read('src/app/(dashboard)/calculator/wind/page.tsx');
        expect(wind).toContain('轮毂高度（米）');
        expect(wind).toContain('单机容量（兆瓦）');
        expect(wind).not.toMatch(/uppercase[^"]*">(单机容量|轮毂高度)/);
    });
});
