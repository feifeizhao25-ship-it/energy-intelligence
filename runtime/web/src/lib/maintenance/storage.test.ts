import { analyzeSOH } from './storage';

const input = { batteryId: 'b1', cycleCount: 2000, voltage: 3.2, current: 10, temperature: 25, nominalCapacity: 100 };

describe('储能 SOH 估算', () => {
  it('同样的输入永远得到同样的结果（不含随机数）', async () => {
    const a = await analyzeSOH(input);
    const b = await analyzeSOH(input);
    expect(a).toEqual(b);
    expect(a.soh).toBe(90);
  });
  it('循环次数越多，估算 SOH 越低，并不会低于 0', async () => {
    const low = await analyzeSOH({ ...input, cycleCount: 100 });
    const high = await analyzeSOH({ ...input, cycleCount: 30000 });
    expect(low.soh).toBeGreaterThan(high.soh);
    expect(high.soh).toBe(0);
    expect(high.remainingCycles).toBe(0);
    expect(high.factors.join('')).not.toMatch(/高温|大电流/);
  });
});
