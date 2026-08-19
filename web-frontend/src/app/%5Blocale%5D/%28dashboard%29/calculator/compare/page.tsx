'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, Zap, DollarSign, MapPin, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import MonthlyGenerationBarChart from '@/components/charts/MonthlyGenerationBarChart';
import UnlockModal from '@/components/ui/UnlockModal';

const PROVINCES = [
    { name: '北京', retailPrice: 0.85, feedInTariff: 0.65, capacity: 1000 },
    { name: '上海', retailPrice: 0.92, feedInTariff: 0.73, capacity: 1000 },
    { name: '广东', retailPrice: 0.78, feedInTariff: 0.53, capacity: 1000 },
    { name: '江苏', retailPrice: 0.75, feedInTariff: 0.50, capacity: 1000 },
    { name: '浙江', retailPrice: 0.83, feedInTariff: 0.58, capacity: 1000 },
    { name: '山东', retailPrice: 0.72, feedInTariff: 0.48, capacity: 1000 },
    { name: '河北', retailPrice: 0.65, feedInTariff: 0.45, capacity: 1000 },
    { name: '四川', retailPrice: 0.70, feedInTariff: 0.47, capacity: 1000 },
];

// 光伏发电系数（不同省份因光照条件不同）
const SOLAR_COEFFICIENTS: Record<string, number> = {
    '西藏': 1.5, '青海': 1.35, '甘肃': 1.25, '宁夏': 1.2, '内蒙古': 1.15,
    '新疆': 1.1, '吉林': 1.0, '辽宁': 0.95, '黑龙江': 0.9, '北京': 1.05,
    '天津': 1.0, '河北': 1.0, '山西': 1.05, '山东': 0.95, '河南': 0.9,
    '陕西': 0.95, '江苏': 0.85, '上海': 0.85, '浙江': 0.8, '安徽': 0.85,
    '江西': 0.8, '福建': 0.75, '湖北': 0.8, '湖南': 0.75, '四川': 0.7,
    '重庆': 0.7, '贵州': 0.65, '云南': 0.85, '广西': 0.7, '广东': 0.75,
    '海南': 0.9, '东北': 0.95, '其他': 1.0,
};

export default function ComparePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isClient, setIsClient] = useState(false);
    const [selectedProvinces, setSelectedProvinces] = useState<string[]>(['北京', '上海', '广东']);
    const [comparisonData, setComparisonData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);

    useEffect(() => {
        setIsClient(true);
        // 解析传入的数据
        const rawData = searchParams.get('data');
        if (rawData) {
            const baseData = JSON.parse(decodeURIComponent(rawData));
            runComparison(baseData);
        }
    }, [searchParams]);

    const runComparison = async (baseData: any) => {
        setLoading(true);
        const results: any[] = [];
        const baseCapacity = baseData.metadata?.capacity || 100;

        for (const province of PROVINCES) {
            // 简化的计算逻辑
            const baseYield = baseData.energy?.year1 || 1000000;
            const coef = SOLAR_COEFFICIENTS[province.name] || 1.0;
            const adjustedYield = baseYield * coef;

            const investment = baseCapacity * 4; // 假设4000元/kW
            const avgPrice = (province.retailPrice + province.feedInTariff) / 2;
            const year1Revenue = adjustedYield * avgPrice * 0.9; // 考虑自用比例
            const annualCost = investment * 0.015; // 运维成本
            const annualProfit = year1Revenue - annualCost;
            const payback = investment / annualProfit;

            results.push({
                province: province.name,
                capacity: baseCapacity,
                annualGeneration: Math.round(adjustedYield),
                irr: ((annualProfit / investment) * 100).toFixed(1),
                paybackYears: payback.toFixed(1),
                lcoe: (investment / adjustedYield / 20).toFixed(3),
                revenue: Math.round(year1Revenue),
                retailPrice: province.retailPrice,
                feedInTariff: province.feedInTariff,
                coefficient: coef.toFixed(2),
                monthly: baseData.energy?.monthly?.map((m: number) => Math.round(m * coef)) || []
            });
        }

        setComparisonData(results);
        setLoading(false);
    };

    const toggleProvince = (province: string) => {
        setSelectedProvinces(prev => {
            if (prev.includes(province)) {
                return prev.filter(p => p !== province);
            } else if (prev.length < 4) {
                return [...prev, province];
            }
            return prev;
        });
    };

    if (!isClient) return null;

    const filteredData = comparisonData.filter(d => selectedProvinces.includes(d.province));

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 pb-20">
            {/* Header */}
            <div className="bg-slate-900/50 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
                <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-white flex items-center gap-2">
                                多点深度对比分析
                                <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px] uppercase font-bold border border-purple-500/20 tracking-widest">
                                    PRO
                                </span>
                            </h1>
                            <p className="text-xs text-slate-500">多省份投资效益横向对比</p>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-6xl mx-auto px-6 mt-10">
                {/* Province Selector */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-blue-400" />
                        选择对比省份（最多4个）
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        {PROVINCES.map(province => (
                            <button
                                key={province.name}
                                onClick={() => toggleProvince(province.name)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedProvinces.includes(province.name)
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                    }`}
                            >
                                {province.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="relative">
                    {!isUnlocked && filteredData.length > 0 && (
                        <div className="absolute inset-0 z-30 bg-slate-900/60 backdrop-blur-[2px] rounded-3xl flex flex-col items-center justify-center border border-slate-700/50">
                            <div className="p-8 text-center max-w-md">
                                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                                    <Lock className="w-8 h-8 text-indigo-400" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">解锁多点深度对比</h3>
                                <p className="text-slate-400 mb-8">
                                    当前仅预览前 3 个省份的数据。升级 Pro 会员即可查看全国 34 个省份的完整投资回报对比分析。
                                </p>
                                <button
                                    onClick={() => setShowPaywall(true)}
                                    className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/25 transition-all hover:scale-105"
                                >
                                    立即解锁
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Comparison Table */}
                    {filteredData.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-emerald-400" />
                                关键指标对比
                            </h3>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-700">
                                            <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">省份</th>
                                            <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 uppercase">年发电量</th>
                                            <th className="text-right py-3 px-4 text-xs font-bold text-blue-400 uppercase">IRR</th>
                                            <th className="text-right py-3 px-4 text-xs font-bold text-orange-400 uppercase">回收期</th>
                                            <th className="text-right py-3 px-4 text-xs font-bold text-emerald-400 uppercase">LCOE</th>
                                            <th className="text-right py-3 px-4 text-xs font-bold text-purple-400 uppercase">年收入</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredData.map((item, idx) => (
                                            <motion.tr
                                                key={item.province}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.1 }}
                                                className="border-b border-slate-800 hover:bg-slate-800/50"
                                            >
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-white">{item.province}</span>
                                                        <span className="text-[10px] text-slate-500">系数:{item.coefficient}</span>
                                                    </div>
                                                </td>
                                                <td className="text-right py-4 px-4 text-slate-300">
                                                    {(item.annualGeneration / 10000).toFixed(1)}万 kWh
                                                </td>
                                                <td className="text-right py-4 px-4">
                                                    <span className="text-blue-400 font-bold">{item.irr}%</span>
                                                    {parseFloat(item.irr) > 15 && <TrendingUp className="inline w-3 h-3 text-emerald-400 ml-1" />}
                                                </td>
                                                <td className="text-right py-4 px-4 text-orange-400 font-bold">
                                                    {item.paybackYears}年
                                                </td>
                                                <td className="text-right py-4 px-4 text-emerald-400 font-bold">
                                                    ¥{item.lcoe}
                                                </td>
                                                <td className="text-right py-4 px-4 text-purple-400 font-bold">
                                                    ¥{(item.revenue / 10000).toFixed(1)}万
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Monthly Comparison Chart */}
                    {filteredData.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Zap className="w-5 h-5 text-yellow-400" />
                                月度发电量对比
                            </h3>
                            <div className="h-[300px]">
                                <ProvinceComparisonChart data={filteredData} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
                        <span className="text-slate-400">正在计算多省份数据...</span>
                    </div>
                )}

                {/* Best Recommendation */}
                {filteredData.length > 0 && (
                    <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-3xl p-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <TrendingUp className="w-32 h-32" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-4">💡 投资建议</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {filteredData
                                .sort((a, b) => parseFloat(b.irr) - parseFloat(a.irr))
                                .slice(0, 3)
                                .map((item, idx) => (
                                    <div key={item.province} className="bg-white/10 rounded-2xl p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-2xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                                            <span className="font-bold text-white">{item.province}</span>
                                        </div>
                                        <div className="space-y-1 text-sm text-white/80">
                                            <div>IRR: <span className="text-yellow-300 font-bold">{item.irr}%</span></div>
                                            <div>回收期: <span className="text-white">{item.paybackYears}年</span></div>
                                            <div>年收入: <span className="text-emerald-300">¥{(item.revenue / 10000).toFixed(1)}万</span></div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

// 简化的省份对比图表组件
function ProvinceComparisonChart({ data }: { data: any[] }) {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

    const maxValue = Math.max(...data.flatMap(d => d.monthly));

    return (
        <div className="flex h-full">
            <div className="w-16 flex flex-col justify-between py-2 text-xs text-slate-500">
                <span>{(maxValue / 1000).toFixed(0)}k</span>
                <span>{(maxValue / 2000).toFixed(0)}k</span>
                <span>0</span>
            </div>
            <div className="flex-1 flex flex-col">
                <div className="flex-1 flex items-end gap-1 border-l border-b border-slate-700 pb-2">
                    {data[0]?.monthly.map((val: number, idx: number) => (
                        <div key={idx} className="flex-1 flex gap-0.5 justify-center items-end">
                            {data.map((province, pIdx) => (
                                <div
                                    key={pIdx}
                                    className="w-full rounded-t-sm"
                                    style={{
                                        height: `${(province.monthly[idx] / maxValue) * 100}%`,
                                        backgroundColor: colors[pIdx % colors.length],
                                        opacity: 0.8
                                    }}
                                />
                            ))}
                        </div>
                    ))}
                </div>
                <div className="flex justify-between mt-2 px-1">
                    {months.map((m, i) => (
                        <span key={i} className="text-[10px] text-slate-500">{m}</span>
                    ))}
                </div>
            </div>
            <div className="ml-4 flex flex-col justify-center gap-2">
                {data.map((item, idx) => (
                    <div key={item.province} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: colors[idx % colors.length] }} />
                        <span className="text-xs text-slate-300">{item.province}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
