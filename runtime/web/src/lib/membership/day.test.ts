import { nextShanghaiMidnight, sameShanghaiDay, startOfShanghaiDay } from './day';

describe('每日额度的一天按北京时间算', () => {
  it('UTC 同一天但北京时间已跨天：算新的一天（旧实现在服务器为 UTC 时会晚 8 小时才重置）', () => {
    const lastUse = new Date('2026-09-30T15:00:00Z'); // 北京 9/30 23:00
    const now = new Date('2026-09-30T16:30:00Z'); // 北京 10/1 00:30
    expect(lastUse.getUTCDate()).toBe(now.getUTCDate());
    expect(sameShanghaiDay(lastUse, now)).toBe(false);
  });

  it('北京时间同一天（含 UTC 跨天的那几小时）算同一天', () => {
    expect(sameShanghaiDay(new Date('2026-09-30T00:10:00Z'), new Date('2026-09-30T15:50:00Z'))).toBe(true);
  });

  it('重置时刻是次日北京 0 点', () => {
    expect(startOfShanghaiDay(new Date('2026-09-30T16:30:00Z')).toISOString()).toBe('2026-09-30T16:00:00.000Z');
    expect(nextShanghaiMidnight(new Date('2026-09-30T10:00:00Z')).toISOString()).toBe('2026-09-30T16:00:00.000Z');
  });
});

describe('到期日按北京时间显示', () => {
  it('北京时间 2027-06-30 00:00 到期显示为 2027-06-30（UTC 截取会显示成 06-29）', () => {
    const { shanghaiDate } = require('./day');
    const expire = new Date('2027-06-30T00:00:00+08:00');
    expect(expire.toISOString().slice(0, 10)).toBe('2027-06-29');
    expect(shanghaiDate(expire)).toBe('2027-06-30');
  });
});
