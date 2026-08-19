'use client';

import React, { useState, useMemo } from 'react';
import {
    Zap,
    Wind,
    Battery,
    Plus,
    Sun,
    Bell,
    MapPin,
    Eye,
    Share2,
    Edit3,
    Trash2,
    ChevronRight,
    Sparkles,
    Trophy,
    Calendar,
    BarChart3,
    PenLine
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import StationDataInput, { StationRecordInput } from '@/components/station/StationDataInput';
import StationCharts from '@/components/station/StationCharts';

// Type definitions
interface StationRecord {
    date: string;
    generation: number;
    revenue: number;
    weather?: string;
}

interface Station {
    id: string;
    name: string;
    type: 'solar' | 'wind' | 'storage';
    capacity: number;
    location: string;
    installDate: string;
    status: 'online' | 'offline';
    todayGeneration: number;
    todayIncome: number;
    monthGeneration: number;
    monthIncome: number;
    yearGeneration: number;
    yearIncome: number;
    efficiency: number;
    lastUpdate: string;
    records: StationRecord[];
}


// Mock data
const mockStations = [
    {
        id: '1',
        name: '保定市区屋顶光伏',
        type: 'solar' as const,
        capacity: 15,
        location: '河北省保定市',
        installDate: '2024-06-15',
        status: 'online' as const,
        todayGeneration: 68.5,
        todayIncome: 58.2,
        monthGeneration: 1856,
        monthIncome: 1580,
        yearGeneration: 18650,
        yearIncome: 15852,
        efficiency: 94.5,
        lastUpdate: '10分钟前',
        records: [
            { date: '2026-01-08', generation: 62, revenue: 52.7, weather: 'sunny' },
            { date: '2026-01-09', generation: 45, revenue: 38.2, weather: 'cloudy' },
            { date: '2026-01-10', generation: 71, revenue: 60.3, weather: 'sunny' },
            { date: '2026-01-11', generation: 58, revenue: 49.3, weather: 'cloudy' },
            { date: '2026-01-12', generation: 65, revenue: 55.2, weather: 'sunny' },
            { date: '2026-01-13', generation: 68, revenue: 57.8, weather: 'sunny' },
            { date: '2026-01-14', generation: 68.5, revenue: 58.2, weather: 'sunny' },
        ]
    },
    {
        id: '2',
        name: '工厂屋顶储能系统',
        type: 'storage' as const,
        capacity: 100,
        location: '北京市海淀区',
        installDate: '2024-08-20',
        status: 'online' as const,
        todayGeneration: 45.2,
        todayIncome: 120.5,
        monthGeneration: 1234,
        monthIncome: 3280,
        yearGeneration: 8500,
        yearIncome: 22680,
        efficiency: 98.2,
        lastUpdate: '5分钟前',
        records: []
    }
];

const typeConfig = {
    solar: { icon: Zap, color: 'amber', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', gradient: 'from-amber-400 to-amber-600' },
    wind: { icon: Wind, color: 'blue', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', gradient: 'from-blue-400 to-blue-600' },
    storage: { icon: Battery, color: 'purple', bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', gradient: 'from-purple-400 to-purple-600' }
};

export default function MyStationsPage() {
    const [stations, setStations] = useState<Station[]>(mockStations as Station[]);
    const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'month' | 'year'>('month');
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedStation, setSelectedStation] = useState<string | null>(null);
    const [showDataInput, setShowDataInput] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

    // Calculate totals
    const totalStats = useMemo(() => {
        return stations.reduce((acc, station) => {
            acc.capacity += station.capacity;
            acc.generation += selectedPeriod === 'day' ? station.todayGeneration : selectedPeriod === 'month' ? station.monthGeneration : station.yearGeneration;
            acc.income += selectedPeriod === 'day' ? station.todayIncome : selectedPeriod === 'month' ? station.monthIncome : station.yearIncome;
            return acc;
        }, { capacity: 0, generation: 0, income: 0 });
    }, [stations, selectedPeriod]);

    // 正在查看的电站详情
    const activeStation = useMemo(() => {
        return stations.find(s => s.id === selectedStation);
    }, [stations, selectedStation]);

    const handleDataSubmit = async (stationId: string, data: StationRecordInput) => {
        // TODO: 调用API保存数据
        console.log('Recording data for station', stationId, data);

        // 更新本地状态
        const newRecord: StationRecord = {
            date: data.date,
            generation: data.generation,
            revenue: data.revenue || data.generation * 0.85,
            weather: data.weather || 'sunny',
        };

        setStations(prev => prev.map(s => {
            if (s.id === stationId) {
                return {
                    ...s,
                    todayGeneration: data.generation,
                    todayIncome: newRecord.revenue,
                    records: [...(s.records || []), newRecord]
                };
            }
            return s;
        }));

        setShowDataInput(null);

        // TODO: 检查成就解锁
    };

    if (viewMode === 'detail' && activeStation) {
        return (
            <StationDetailView
                station={activeStation}
                onBack={() => { setViewMode('list'); setSelectedStation(null); }}
                onRecordData={() => setShowDataInput(activeStation.id)}
            />
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-white border-b border-slate-100 px-6 py-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900">我的电站</h1>
                        <p className="text-slate-500 mt-1">管理您的清洁能源资产</p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-primary-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-primary-600 transition-colors shadow-primary"
                    >
                        <Plus className="w-5 h-5" />
                        添加电站
                    </button>
                </div>

                {/* Period Selector */}
                <div className="flex gap-3 mt-6">
                    {(['day', 'month', 'year'] as const).map((period) => (
                        <button
                            key={period}
                            onClick={() => setSelectedPeriod(period)}
                            className={cn(
                                "px-6 py-2 rounded-full font-bold text-sm transition-all",
                                selectedPeriod === period
                                    ? "bg-slate-900 text-white shadow-lg"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                        >
                            {period === 'day' ? '今日' : period === 'month' ? '本月' : '本年'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Total Stats */}
            <div className="px-6 py-8">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[40px] p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-5">
                        <Zap className="w-48 h-48" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-6">
                            <Sparkles className="w-5 h-5 text-primary-400" />
                            <span className="text-sm font-bold uppercase tracking-widest text-slate-400">资产总览</span>
                        </div>
                        <div className="grid grid-cols-3 gap-8">
                            <div>
                                <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">装机容量</div>
                                <div className="text-3xl font-black">{totalStats.capacity} <span className="text-lg font-normal">kW</span></div>
                            </div>
                            <div>
                                <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">发电量</div>
                                <div className="text-3xl font-black">{totalStats.generation.toLocaleString()} <span className="text-lg font-normal">kWh</span></div>
                            </div>
                            <div>
                                <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">收益</div>
                                <div className="text-3xl font-black text-primary-400">¥{(totalStats.income / 10000).toFixed(2)}万</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Achievement Teaser */}
            <div className="px-6 mb-6">
                <Link href="/achievements">
                    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center justify-between hover:shadow-md transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                <Trophy className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <div className="font-bold text-slate-900">累计发电 {totalStats.generation.toLocaleString()} kWh</div>
                                <div className="text-xs text-slate-500">距离下一个成就还差 {(20000 - totalStats.generation).toLocaleString()} 度</div>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300" />
                    </div>
                </Link>
            </div>

            {/* Stations List */}
            <div className="px-6 space-y-6">
                {stations.map((station) => {
                    const config = typeConfig[station.type];
                    const Icon = config.icon;

                    return (
                        <div
                            key={station.id}
                            className={cn(
                                "bg-white rounded-[32px] border-2 p-6 transition-all hover:shadow-xl",
                                config.border
                            )}
                        >
                            {/* Station Header */}
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", config.bg)}>
                                        <Icon className={cn("w-7 h-7", config.text)} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-xl text-slate-900">{station.name}</h3>
                                        <div className="flex items-center gap-2 mt-1 text-slate-400 text-sm">
                                            <MapPin className="w-4 h-4" />
                                            {station.location}
                                        </div>
                                    </div>
                                </div>
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-xs font-bold uppercase",
                                    station.status === 'online'
                                        ? "bg-green-100 text-green-600"
                                        : "bg-amber-100 text-amber-600"
                                )}>
                                    {station.status === 'online' ? '运行中' : '维护中'}
                                </span>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-slate-50 rounded-2xl p-4">
                                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">
                                        {selectedPeriod === 'day' ? '今日发电' : selectedPeriod === 'month' ? '本月发电' : '本年发电'}
                                    </div>
                                    <div className="text-2xl font-black text-slate-900">
                                        {(selectedPeriod === 'day' ? station.todayGeneration : selectedPeriod === 'month' ? station.monthGeneration : station.yearGeneration).toLocaleString()}
                                        <span className="text-sm font-normal text-slate-400 ml-1">kWh</span>
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4">
                                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">
                                        {selectedPeriod === 'day' ? '今日收益' : selectedPeriod === 'month' ? '本月收益' : '本年收益'}
                                    </div>
                                    <div className="text-2xl font-black text-primary-600">
                                        ¥{((selectedPeriod === 'day' ? station.todayIncome : selectedPeriod === 'month' ? station.monthIncome : station.yearIncome)).toFixed(0)}
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4">
                                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">装机容量</div>
                                    <div className="text-2xl font-black text-slate-900">
                                        {station.capacity} <span className="text-sm font-normal text-slate-400">kW</span>
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4">
                                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">运行效率</div>
                                    <div className="text-2xl font-black text-slate-900">
                                        {station.efficiency}% <span className="text-green-500 text-sm">✓</span>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex gap-3 pt-4 border-t border-slate-100">
                                <button
                                    onClick={() => setShowDataInput(station.id)}
                                    className="flex-1 py-3 rounded-2xl bg-primary-500 text-white font-bold text-sm hover:bg-primary-600 transition-colors flex items-center justify-center gap-2 shadow-primary"
                                >
                                    <PenLine className="w-4 h-4" />
                                    录入数据
                                </button>
                                <button
                                    onClick={() => { setSelectedStation(station.id); setViewMode('detail'); }}
                                    className="flex-1 py-3 rounded-2xl bg-slate-50 text-slate-600 font-bold text-sm hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                                >
                                    <BarChart3 className="w-4 h-4" />
                                    查看图表
                                </button>
                                <button className="flex-1 py-3 rounded-2xl bg-slate-50 text-slate-600 font-bold text-sm hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                                    <Share2 className="w-4 h-4" />
                                    分享
                                </button>
                            </div>

                            {/* Data Input Modal */}
                            {showDataInput === station.id && (
                                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                                    <div className="w-full max-w-md">
                                        <StationDataInput
                                            stationId={station.id}
                                            stationType={station.type}
                                            onSubmit={(data) => handleDataSubmit(station.id, data)}
                                            onCancel={() => setShowDataInput(null)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Empty State */}
            {stations.length === 0 && (
                <div className="px-6 py-20 text-center">
                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Zap className="w-12 h-12 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">还没有电站</h3>
                    <p className="text-slate-500 mb-8">添加您的第一个电站，开始追踪收益</p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-primary-500 text-white px-8 py-4 rounded-2xl font-bold hover:bg-primary-600 transition-colors shadow-primary"
                    >
                        立即添加
                    </button>
                </div>
            )}

            {/* Add Station Modal */}
            {showAddModal && (
                <AddStationModal onClose={() => setShowAddModal(false)} />
            )}

            {/* Daily Push Notice */}
            <div className="fixed bottom-24 right-6 w-80 z-40 hidden md:block">
                <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
                            <Sun className="text-white w-5 h-5" />
                        </div>
                        <div>
                            <div className="font-bold text-slate-900">今日发电报告</div>
                            <div className="text-xs text-slate-400">下午 18:00 推送</div>
                        </div>
                    </div>
                    <div className="bg-primary-50 rounded-2xl p-4 mb-3">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-600 font-medium">今日总发电</span>
                            <span className="text-2xl font-black text-primary-600">{totalStats.generation.toFixed(1)} kWh</span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-slate-600 font-medium">今日收益</span>
                            <span className="text-xl font-bold text-primary-600">¥{totalStats.income.toFixed(0)}</span>
                        </div>
                    </div>
                    <button className="w-full py-2 rounded-xl bg-slate-900 text-white font-bold text-sm">
                        查看详情
                    </button>
                </div>
            </div>
        </div>
    );
}

// Station Detail View Component
function StationDetailView({
    station,
    onBack,
    onRecordData
}: {
    station: Station;
    onBack: () => void;
    onRecordData: () => void;
}) {
    const config = typeConfig[station.type];
    const Icon = config.icon;

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className={cn("bg-gradient-to-br text-white px-6 py-8", config.gradient)}>
                <button onClick={onBack} className="text-white/80 font-bold mb-4 flex items-center gap-1">
                    ← 返回列表
                </button>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                        <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black">{station.name}</h1>
                        <div className="flex items-center gap-2 text-white/80 text-sm mt-1">
                            <MapPin className="w-4 h-4" />
                            {station.location}
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 -mt-4">
                {/* Quick Stats */}
                <div className="bg-white rounded-3xl shadow-lg p-6 mb-6">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-black text-slate-900">{station.capacity}</div>
                            <div className="text-xs text-slate-500">装机容量 kW</div>
                        </div>
                        <div>
                            <div className="text-2xl font-black text-primary-600">{station.yearGeneration.toLocaleString()}</div>
                            <div className="text-xs text-slate-500">年发电量 kWh</div>
                        </div>
                        <div>
                            <div className="text-2xl font-black text-primary-600">¥{(station.yearIncome / 10000).toFixed(2)}万</div>
                            <div className="text-xs text-slate-500">年收益</div>
                        </div>
                    </div>
                </div>

                {/* Charts */}
                <StationCharts
                    records={station.records || []}
                    stationType={station.type}
                    period="week"
                />

                {/* Record Data Button */}
                <button
                    onClick={onRecordData}
                    className="fixed bottom-6 left-6 right-6 bg-primary-500 text-white py-4 rounded-2xl font-bold text-lg shadow-primary hover:bg-primary-600 transition-all flex items-center justify-center gap-2"
                >
                    <PenLine className="w-5 h-5" />
                    录入今日数据
                </button>
            </div>
        </div>
    );
}

// Add Station Modal Component
function AddStationModal({ onClose }: { onClose: () => void }) {
    const [selectedType, setSelectedType] = useState<'solar' | 'wind' | 'storage' | null>(null);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-[40px] p-8 max-w-md w-full max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black text-slate-900">添加电站</h2>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200"
                    >
                        ✕
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">电站名称</label>
                        <input
                            type="text"
                            placeholder="给电站起个名字"
                            className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary-500 outline-none font-medium"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">电站类型</label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { type: 'solar' as const, icon: Zap, label: '光伏', color: 'amber' },
                                { type: 'wind' as const, icon: Wind, label: '风电', color: 'blue' },
                                { type: 'storage' as const, icon: Battery, label: '储能', color: 'purple' }
                            ].map(({ type, icon: Icon, label, color }) => (
                                <button
                                    key={type}
                                    onClick={() => setSelectedType(type)}
                                    className={cn(
                                        "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                                        selectedType === type
                                            ? `border-${color}-500 bg-${color}-50`
                                            : "border-slate-100 hover:border-slate-300"
                                    )}
                                >
                                    <Icon className={cn("w-6 h-6", selectedType === type ? `text-${color}-500` : "text-slate-400")} />
                                    <span className="text-sm font-bold text-slate-600">{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">装机容量 (kW)</label>
                        <input
                            type="number"
                            placeholder="输入装机容量"
                            className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary-500 outline-none font-medium"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">位置</label>
                        <input
                            type="text"
                            placeholder="电站所在位置"
                            className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary-500 outline-none font-medium"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">并网日期</label>
                        <input
                            type="date"
                            className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary-500 outline-none font-medium"
                        />
                    </div>
                </div>

                <button className="w-full bg-primary-500 text-white py-4 rounded-2xl font-bold mt-8 hover:bg-primary-600 transition-colors shadow-primary">
                    保存电站
                </button>
            </div>
        </div>
    );
}
