import { solarResourceClass } from '@/lib/api/verified-solar';
import { solarResourceLabel } from '@/lib/resource/solar-grade';

describe('GB/T 31155-2014 四档（核4）', () => {
  it.each([
    [2000, 'I'], [1750, 'I'], [1749, 'II'], [1450, 'II'], [1400, 'II'], [1399, 'III'], [1050, 'III'], [1049, 'IV'], [0, 'IV'],
  ])('%p kWh/m² → %s', (ghi, cls) => {
    expect(solarResourceClass(ghi as number)).toBe(cls);
  });
  it('label', () => {
    expect(solarResourceLabel('II')).toBe('很丰富（GB/T 31155）');
    expect(solarResourceLabel('V')).toBe('V类资源区');
  });
});
