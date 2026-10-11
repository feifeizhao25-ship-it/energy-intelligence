/**
 * 「每日额度」的一天按北京时间（Asia/Shanghai，UTC+8，无夏令时）算。
 *
 * 原来用服务器本地时区的 getDate()：容器没设 TZ 时是 UTC，于是「明日 0 点重置」
 * 实际在北京时间 08:00 才重置——用户晚上用完额度，要等到第二天上午 8 点。
 */
const OFFSET_MS = 8 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

export function shanghaiDayIndex(d: Date): number {
  return Math.floor((d.getTime() + OFFSET_MS) / DAY_MS);
}

export function sameShanghaiDay(a: Date, b: Date): boolean {
  return shanghaiDayIndex(a) === shanghaiDayIndex(b);
}

/** 当天北京时间 00:00 对应的时刻 */
export function startOfShanghaiDay(now: Date): Date {
  return new Date(shanghaiDayIndex(now) * DAY_MS - OFFSET_MS);
}

/** 次日北京时间 00:00（额度重置时刻） */
export function nextShanghaiMidnight(now: Date): Date {
  return new Date(startOfShanghaiDay(now).getTime() + DAY_MS);
}

/** 按北京时间显示日期（YYYY-MM-DD）。toISOString 是 UTC：北京时间 0 点的到期时刻会显示成前一天。 */
export function shanghaiDate(d: Date): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}
