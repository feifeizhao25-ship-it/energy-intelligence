'use client';

import React, { useEffect, useState } from 'react';
import { X, Sun, Wind, CloudRain, TrendingUp, Info } from 'lucide-react';
import { getSolarResource, getWindResource, getClimateData } from '@/lib/api/nasa-power';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import SunPathChart from './SunPathChart';

interface LocationDetailProps {
    location: { lat: number; lng: number; name: string };
    onClose: () => void;
}

export default function LocationDetail({ location, onClose }: LocationDetailProps) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'monthly' | 'analysis' | 'sunpath'>('overview');

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                // 并行获取数据
                const [solar, wind, climate] = await Promise.all([
                    getSolarResource(location.lat, location.lng),
                    getWindResource(location.lat, location.lng),
                    getClimateData(location.lat, location.lng)
                ]);

                setData({ solar, wind, climate });
            } catch (error) {
                console.error('Failed to fetch data', error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [location]);

    if (!location) return null;

    if (loading) {
        return (
            <div className="absolute top-20 left-4 w-96 bg-gray-800/95 backdrop-blur border border-gray-700 text-white p-6 rounded-lg shadow-2xl z-30 min-h-[400px] flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-gray-400">正在分析NASA卫星数据...</p>
                <p className="text-xs text-gray-500 mt-2">获取40年历史气象记录</p>
            </div>
        );
    }

    if (!data) return null;

    const { solar, wind, climate } = data;

    // 准备图表数据
    const chartData = solar.monthly.map((m: any, i: number) => ({
        month: `${m.month}月`,
        ghi: Math.round(m.ghi), // GHI
        windSpeed: wind.monthly[i]?.speed100m.toFixed(1), // Wind Speed
    }));

    return (
        <div className="absolute top-20 left-4 w-[450px] bg-gray-800/95 backdrop-blur border border-gray-700 text-white rounded-lg shadow-2xl z-30 max-h-[80vh] overflow-y-auto flex flex-col">
            <div className="p-4 border-b border-gray-700 flex justify-between items-start sticky top-0 bg-gray-800/95 z-10">
                <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        📍 {location.name}
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                        {location.lat.toFixed(3)}°N, {location.lng.toFixed(3)}°E | 海拔 待定
                    </p>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="p-2 border-b border-gray-700 flex bg-gray-800/50">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`flex-1 py-2 text-sm font-medium ${activeTab === 'overview' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    资源概览
                </button>
                <button
                    onClick={() => setActiveTab('monthly')}
                    className={`flex-1 py-2 text-sm font-medium ${activeTab === 'monthly' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    月度分布
                </button>
                <button
                    onClick={() => setActiveTab('sunpath')}
                    className={`flex-1 py-2 text-sm font-medium ${activeTab === 'sunpath' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    太阳轨迹
                </button>
                <button
                    onClick={() => setActiveTab('analysis')}
                    className={`flex-1 py-2 text-sm font-medium ${activeTab === 'analysis' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    智能分析
                </button>
            </div>

            <div className="p-4 space-y-6 flex-1">
                {activeTab === 'overview' && (
                    <>
                        {/* 太阳能板块 */}
                        <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/50">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-orange-400 flex items-center gap-2">
                                    <Sun className="w-4 h-4" /> 太阳能资源
                                </h3>
                                <span className={`text-xs px-2 py-0.5 rounded ${getScoreColor(solar.annual.resourceClass)}`}>
                                    {solar.annual.resourceClass}类资源区
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-400">年总辐照量 (GHI)</p>
                                    <p className="text-xl font-bold">{Math.round(solar.annual.ghi)} <span className="text-xs font-normal text-gray-400">kWh/m²</span></p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">峰值日照时数</p>
                                    <p className="text-xl font-bold">{solar.annual.peakSunHours.toFixed(2)} <span className="text-xs font-normal text-gray-400">h/天</span></p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">最佳倾角</p>
                                    <p className="text-lg font-semibold">{Math.round(solar.annual.optimalTilt)}°</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">全国排名</p>
                                    <p className="text-lg font-semibold">前 35%</p>
                                </div>
                            </div>
                        </div>

                        {/* 风能板块 */}
                        <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/50">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                                    <Wind className="w-4 h-4" /> 风能资源 (100m)
                                </h3>
                                <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded border border-blue-800">
                                    {wind.annual.resourceClass}类风区
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-400">年平均风速</p>
                                    <p className="text-xl font-bold">{wind.annual.avgSpeed.toFixed(2)} <span className="text-xs font-normal text-gray-400">m/s</span></p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">风功率密度</p>
                                    <p className="text-xl font-bold">{Math.round(wind.annual.powerDensity)} <span className="text-xs font-normal text-gray-400">W/m²</span></p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">等效满发小时</p>
                                    <p className="text-lg font-semibold">{Math.round(wind.annual.equivalentHours)} h</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">可利用率</p>
                                    <p className="text-lg font-semibold">{(wind.annual.equivalentHours / 8760 * 100).toFixed(1)}%</p>
                                </div>
                            </div>
                        </div>

                        {/* 环境板块 */}
                        <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/50">
                            <h3 className="text-sm font-bold text-green-400 flex items-center gap-2 mb-3">
                                <CloudRain className="w-4 h-4" /> 气候环境
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="text-center bg-gray-800 rounded p-2">
                                    <p className="text-xs text-gray-400">年均温</p>
                                    <p className="font-semibold">{climate.annual.temperature.toFixed(1)}°C</p>
                                </div>
                                <div className="text-center bg-gray-800 rounded p-2">
                                    <p className="text-xs text-gray-400">年降水</p>
                                    <p className="font-semibold">{Math.round(climate.annual.precipitation)}mm</p>
                                </div>
                                <div className="text-center bg-gray-800 rounded p-2">
                                    <p className="text-xs text-gray-400">湿度</p>
                                    <p className="font-semibold">{Math.round(climate.annual.humidity)}%</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'monthly' && (
                    <div className="space-y-6">
                        <div className="h-64 w-full">
                            <h4 className="text-xs font-semibold text-gray-400 mb-2">月度总辐照量 (kWh/m²)</h4>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                                    <YAxis stroke="#9CA3AF" />
                                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                                    <Bar dataKey="ghi" fill="#F97316" name="辐照量" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="h-64 w-full">
                            <h4 className="text-xs font-semibold text-gray-400 mb-2">月度平均风速 (m/s)</h4>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                                    <YAxis stroke="#9CA3AF" domain={[0, 10]} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                                    <Line type="monotone" dataKey="windSpeed" stroke="#3B82F6" strokeWidth={2} name="风速" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {activeTab === 'sunpath' && (
                    <SunPathChart lat={location.lat} lng={location.lng} />
                )}

                {activeTab === 'analysis' && (
                    <div className="space-y-4">
                        <div className="bg-indigo-900/30 border border-indigo-500/30 p-3 rounded-lg">
                            <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2 mb-2">
                                <Info className="w-4 h-4" /> AI综合评价
                            </h4>
                            <p className="text-sm text-gray-300 leading-relaxed">
                                该地区<span className="text-orange-400 font-bold">太阳能资源{solar.annual.ghi > 1400 ? '丰富' : '一般'}</span>，
                                <span className="text-blue-400 font-bold">风能资源{wind.annual.avgSpeed > 6 ? '较好' : '较弱'}</span>。
                                {solar.annual.ghi > 1400 ? '建议优先开发光伏项目。' : ''}
                                {wind.annual.avgSpeed > 6 ? '风电开发具有一定潜力，建议采用低风速机型。' : ''}
                                根据气候数据，{climate.annual.temperature > 25 ? '夏季气温较高，需关注组件温度系数影响。' : '气温适宜，利于设备运行。'}
                            </p>
                        </div>

                        <button
                            onClick={() => window.open(`/map/report?lat=${location.lat}&lng=${location.lng}&name=${encodeURIComponent(location.name)}`, '_blank')}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-md font-medium text-sm flex items-center justify-center gap-2"
                        >
                            <TrendingUp className="w-4 h-4" />
                            生成详细评估报告
                        </button>
                    </div>
                )}
            </div>

            <div className="p-3 border-t border-gray-700 text-xs text-gray-500 bg-gray-800/95 sticky bottom-0 text-center">
                数据来源: NASA POWER (1991-2022) | 经度: {location.lng.toFixed(2)} 纬度: {location.lat.toFixed(2)}
            </div>
        </div>
    );
}

function getScoreColor(level: string) {
    if (level === 'I' || level === 'II') return 'bg-green-900/50 text-green-300 border border-green-800';
    if (level === 'III') return 'bg-yellow-900/50 text-yellow-300 border border-yellow-800';
    return 'bg-red-900/50 text-red-300 border border-red-800';
}
