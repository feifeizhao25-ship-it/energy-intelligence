'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Zap, Wind, Thermometer, BarChart2, Layers } from 'lucide-react';
import { safeErrorMessage } from '@/lib/api/safe-error';
import { getSolarResource, getWindResource, getClimateData } from '@/lib/api/nasa-power';
import { calculateSolarScore, calculateWindScore } from '@/lib/resource/analysis';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface LocationData {
    id: string;
    name: string;
    lat: number;
    lng: number;
    solar: any;
    wind: any;
    climate: any;
    scores: {
        solar: number;
        wind: number;
    };
}

export default function ComparePage() {
    const [locations, setLocations] = useState<LocationData[]>([]);
    const [loading, setLoading] = useState(false);
    const [input, setInput] = useState('');

    const [error, setError] = useState<string | null>(null);

    /** 输入「纬度,经度」直接使用；否则按地名走高德地理编码。解析不出就如实告诉用户，不编造位置。 */
    async function resolveInput(text: string): Promise<{ lat: number; lng: number; name: string } | null> {
        const parts = text.split(/[,，]/).map((v) => v.trim());
        if (parts.length === 2 && parts.every((v) => v !== '' && Number.isFinite(Number(v)))) {
            const [lat, lng] = parts.map(Number);
            if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng, name: text };
            return null;
        }
        const res = await fetch(`/api/location?action=geocode&address=${encodeURIComponent(text)}`);
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(typeof body?.error === 'string' ? body.error : '地址解析失败，请稍后重试');
        const hit = body?.data?.[0];
        const [lng, lat] = String(hit?.location ?? '').split(',').map(Number);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng, name: hit.formatted_address || text };
    }

    const addLocation = async () => {
        if (!input.trim()) return;
        setError(null);
        if (locations.length >= 2) {
            setError('雷达图目前最多对比 2 个地点，请先删除一个再添加');
            return;
        }
        setLoading(true);
        let resolved: { lat: number; lng: number; name: string } | null;
        try {
            resolved = await resolveInput(input.trim());
        } catch (e) {
            setError(safeErrorMessage(e, '地址解析失败，请稍后重试'));
            setLoading(false);
            return;
        }
        if (!resolved) {
            setError('未找到该地点，请输入「纬度,经度」或更详细的地址');
            setLoading(false);
            return;
        }
        const { lat, lng, name } = resolved;
        try {
            const [solar, wind, climate] = await Promise.all([
                getSolarResource(lat, lng),
                getWindResource(lat, lng),
                getClimateData(lat, lng)
            ]);

            const solarScore = calculateSolarScore(solar, climate);
            const windScore = calculateWindScore(wind, climate, 0); // Elevation 0 for now

            const newLoc: LocationData = {
                id: Date.now().toString(),
                name,
                lat,
                lng,
                solar,
                wind,
                climate,
                scores: { solar: solarScore, wind: windScore }
            };

            setLocations([...locations, newLoc]);
            setInput('');
        } catch (e) {
            console.error(e);
            setError('获取资源数据失败，请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 bg-gray-900 min-h-screen text-white">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <BarChart2 className="w-6 h-6 text-blue-400" /> 多点资源对比分析
            </h1>

            {/* 输入区 */}
            <div className="flex gap-4 mb-8">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="输入坐标（纬度,经度）或地点名称"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                    onClick={addLocation}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
                >
                    <Plus className="w-5 h-5" />
                    {loading ? '分析中...' : '添加对比'}
                </button>
            </div>

            {error && <p role="alert" className="mb-4 text-sm text-red-400">{error}</p>}

            {/* 内容区 */}
            {locations.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 雷达图 */}
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <h3 className="text-lg font-semibold mb-4">综合评分对比</h3>
                        <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                                    { subject: '光伏评分', A: locations[0]?.scores.solar, B: locations[1]?.scores.solar, full: 100 },
                                    { subject: '风电评分', A: locations[0]?.scores.wind, B: locations[1]?.scores.wind, full: 100 },
                                    { subject: '环境适宜', A: 100 - Math.abs(locations[0]?.climate.annual.temperature - 25) * 2, B: 100 - Math.abs(locations[1]?.climate.annual.temperature - 25) * 2, full: 100 },
                                    { subject: '年辐照量', A: locations[0]?.solar.annual.ghi / 20, B: locations[1]?.solar.annual.ghi / 20, full: 100 },
                                    { subject: '年利用小时', A: locations[0]?.wind.annual.equivalentHours / 30, B: locations[1]?.wind.annual.equivalentHours / 30, full: 100 },
                                ]}>
                                    <PolarGrid stroke="#374151" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF' }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                    {locations.map((loc, i) => (
                                        <Radar
                                            key={loc.id}
                                            name={loc.name}
                                            dataKey={i === 0 ? 'A' : 'B'} // Simplified for 2 items demo
                                            stroke={i === 0 ? '#3B82F6' : '#F97316'}
                                            fill={i === 0 ? '#3B82F6' : '#F97316'}
                                            fillOpacity={0.3}
                                        />
                                    ))}
                                    <Legend />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 数据表格 */}
                    <div className="space-y-4">
                        {locations.map((loc, index) => (
                            <div key={loc.id} className="bg-gray-800 rounded-xl p-6 border border-gray-700 relative group transition-all hover:bg-gray-750">
                                <button
                                    onClick={() => setLocations(locations.filter(l => l.id !== loc.id))}
                                    className="absolute top-4 right-4 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>

                                <div className="flex items-center gap-4 mb-4">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index === 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                        {index + 1}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">{loc.name}</h3>
                                        <p className="text-sm text-gray-400">{loc.lat.toFixed(2)}°N, {loc.lng.toFixed(2)}°E</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-gray-900/50 p-3 rounded-lg">
                                        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                                            <Zap className="w-4 h-4 text-yellow-400" /> 光伏评分
                                        </div>
                                        <div className="text-2xl font-bold">{loc.scores.solar}</div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 rounded-lg">
                                        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                                            <Wind className="w-4 h-4 text-blue-400" /> 风电评分
                                        </div>
                                        <div className="text-2xl font-bold">{loc.scores.wind}</div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 rounded-lg">
                                        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                                            <Thermometer className="w-4 h-4 text-green-400" /> 年均温
                                        </div>
                                        <div className="text-2xl font-bold">{loc.climate.annual.temperature.toFixed(1)}°</div>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-gray-300">
                                    <div className="flex justify-between border-b border-gray-700 pb-1">
                                        <span>年总辐照量</span>
                                        <span>{Math.round(loc.solar.annual.ghi)} kWh/m²</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-700 pb-1">
                                        <span>100m风速</span>
                                        <span>{loc.wind.annual.avgSpeed.toFixed(2)} m/s</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-700 pb-1">
                                        <span>最佳倾角</span>
                                        <span>{Math.round(loc.solar.annual.optimalTilt)}°</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-700 pb-1">
                                        <span>满发小时数</span>
                                        <span>{Math.round(loc.wind.annual.equivalentHours)} h</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center size-full h-96 text-gray-500 border-2 border-dashed border-gray-700 rounded-xl">
                    <Layers className="w-16 h-16 mb-4 opacity-20" />
                    <p>添加地点开始对比分析</p>
                </div>
            )}
        </div>
    );
}
