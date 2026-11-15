/** 气候面板上的一个数。缺测、未提供时写「暂无数据」，不把空值收成 0。 */
export function climateReading(value: unknown, unit: string): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '暂无数据';
    const text = unit === '°C' ? value.toFixed(1) : String(Math.round(value));
    return `${text}${unit}`;
}

export function ClimateEnvironment({
    annual,
}: {
    annual: { temperature?: unknown; precipitation?: unknown; humidity?: unknown };
}) {
    const items = [
        ['年均温', climateReading(annual.temperature, '°C')],
        ['年降水', climateReading(annual.precipitation, 'mm')],
        ['湿度', climateReading(annual.humidity, '%')],
    ] as const;
    return (
        <div className="grid grid-cols-3 gap-2" data-testid="climate-environment">
            {items.map(([label, value]) => (
                <div key={label} className="text-center bg-gray-800 rounded p-2">
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="font-semibold">{value}</p>
                </div>
            ))}
        </div>
    );
}
