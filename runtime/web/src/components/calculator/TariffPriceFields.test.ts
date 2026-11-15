import { tariffDefaults } from '@/lib/pricing/tariff-defaults';
import { TARIFF_EMPTY_NOTE, TARIFF_ERROR_NOTE, tariffFieldNote } from './TariffPriceFields';

describe('电价表读取状态', () => {
    it('没选省份或读不出来时给出中文说明，输入框仍可手工填写', () => {
        expect(tariffFieldNote({ phase: 'empty' }, 'coalBenchmarkPrice')).toBe(TARIFF_EMPTY_NOTE);
        expect(tariffFieldNote({ phase: 'error' }, 'coalBenchmarkPrice')).toBe(TARIFF_ERROR_NOTE);
        expect(TARIFF_ERROR_NOTE).toMatch(/填写/);
        expect(tariffFieldNote({ phase: 'empty' }, 'coalBenchmarkPrice')).not.toContain('正在读取电价表');
        expect(tariffFieldNote({ phase: 'error' }, 'coalBenchmarkPrice')).not.toContain('正在读取电价表');
        const ready = tariffFieldNote({ phase: 'ready', defaults: tariffDefaults('北京', new Date('2026-10-10T00:00:00Z')) }, 'coalBenchmarkPrice');
        expect(ready).toContain('燃煤发电基准价');
        expect(ready).not.toContain('正在读取电价表');
    });
});
