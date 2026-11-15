/**
 * 风电选点：搜索「北京市」必须把省份收成电价表里的「北京」，测算不再因省份被清空而失败。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveMapSearch } from '@/lib/map/map-search';
import { provinceFromPickedLocation } from '@/lib/map/picked-province';
import { resolveWindPrices, tariffDefaults } from '@/lib/pricing/tariff-defaults';

function jsonResponse(body: unknown): Response {
    return { ok: true, status: 200, json: async () => body } as Response;
}

describe('风电搜索北京市', () => {
    it('搜索北京市 → 省份北京 → 测算可以取到该省电价', async () => {
        const fetchImpl = jest.fn(async () => jsonResponse({
            data: [{ location: '116.407387,39.904179', formatted_address: '北京市', province: '北京市' }],
        }));
        const hit = await resolveMapSearch('北京市', fetchImpl as unknown as typeof fetch);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(String(fetchImpl.mock.calls[0][0])).toContain('address=%E5%8C%97%E4%BA%AC%E5%B8%82');
        if ('error' in hit) throw new Error(hit.error);
        expect(hit.province).toBe('北京');

        const province = provinceFromPickedLocation('', hit.province);
        expect(province).toBe('北京');
        expect(() => resolveWindPrices('', {}, 'full_export')).toThrow(/请选择省份/);

        const prices = resolveWindPrices(province, {}, 'full_export', new Date('2026-10-10T00:00:00Z'));
        expect(prices.pricing.province).toBe('北京');
        expect(prices.feedInTariff).toBe(tariffDefaults('北京').coalBenchmarkPrice);
        expect(prices.feedInTariff).toBeGreaterThan(0);

        const page = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
        const picker = readFileSync(join(__dirname, '../../../../components/map/LocationPicker.tsx'), 'utf8');
        const place = readFileSync(join(__dirname, '../../../../lib/map/wind-place.ts'), 'utf8');
        expect(page).toContain('applyWindPick');
        expect(page).not.toContain("province: v.province || ''");
        expect(place).toContain('provinceFromPickedLocation');
        expect(picker).toContain('province: result.province');
    });
});
