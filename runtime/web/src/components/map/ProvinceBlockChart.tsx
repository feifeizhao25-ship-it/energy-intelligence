const MAINLAND = [
    '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江', '上海', '江苏', '浙江', '安徽',
    '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州',
    '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆',
];

/** 省级色块统计。没有接入的数值保持空，不画边界地图。 */
export function ProvinceBlockChart({ values }: { values?: Record<string, number | null> }) {
    const connected = values && Object.values(values).some((value) => typeof value === 'number');
    return (
        <section data-testid="province-blocks" className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">省级色块</h2>
            <p className="mt-1 text-xs text-slate-500">{connected ? '色块数值来自调用方传入的已核数据。' : '统计尚未连接'}</p>
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
                {MAINLAND.map((name) => (
                    <div key={name} className="rounded-lg bg-slate-100 px-2 py-2 text-center text-xs text-slate-700">
                        <div>{name}</div>
                        <div className="mt-1 font-bold">{typeof values?.[name] === 'number' ? values[name] : '—'}</div>
                    </div>
                ))}
            </div>
        </section>
    );
}
