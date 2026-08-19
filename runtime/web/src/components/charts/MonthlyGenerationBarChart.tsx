'use client';

type EnergyData = {
  monthly?: number[];
} | number[];

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export default function MonthlyGenerationBarChart({ data }: { data?: EnergyData }) {
  const values = Array.isArray(data) ? data : data?.monthly ?? [];
  const normalized = MONTHS.map((_, index) => Number(values[index] ?? 0));
  const maximum = Math.max(...normalized, 1);

  return (
    <div
      className="grid h-64 grid-cols-12 items-end gap-2"
      role="img"
      aria-label="月度发电量柱状图"
    >
      {normalized.map((value, index) => (
        <div key={MONTHS[index]} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
          <span className="text-[10px] text-slate-400">{Math.round(value).toLocaleString()}</span>
          <div
            className="w-full min-h-[2px] rounded-t bg-gradient-to-t from-blue-600 to-cyan-400"
            style={{ height: `${Math.max((value / maximum) * 82, 1)}%` }}
            title={`${MONTHS[index]}：${Math.round(value).toLocaleString()} kWh`}
          />
          <span className="text-[10px] text-slate-500">{MONTHS[index]}</span>
        </div>
      ))}
    </div>
  );
}
