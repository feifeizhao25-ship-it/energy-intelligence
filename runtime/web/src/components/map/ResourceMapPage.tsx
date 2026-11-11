'use client';

import React, { useState } from 'react';
import ResourceMap from './ResourceMap';
import LocationDetail from './LocationDetail';
import {
    Search,
    Map as MapIcon,
    Layers,
    Download,
    BarChart2,
    Activity,
    ArrowRightLeft,
    History,
    Sparkles,
    Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAP_SEARCH_MISS, resolveMapSearch } from '@/lib/map/map-search';


export default function ResourceMapPage() {
    const [selectedLayer, setSelectedLayer] = useState<string>('solar'); // solar, wind, hybrid
    const [selectedLocation, setSelectedLocation] = useState<any>(null);
    const [compareMode, setCompareMode] = useState(false);
    const [compareList, setCompareList] = useState<any[]>([]);
    const [mapStyle, setMapStyle] = useState('dark');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchError, setSearchError] = useState<string | null>(null);
    const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>();

    const handleSearch = async (event?: React.FormEvent) => {
        event?.preventDefault();
        const result = await resolveMapSearch(searchQuery);
        if ('error' in result) {
            setSearchError(result.error || MAP_SEARCH_MISS);
            return;
        }
        setSearchError(null);
        setMapCenter({ lat: result.lat, lng: result.lng });
        setSelectedLocation({ lat: result.lat, lng: result.lng, name: result.name });
    };

    const handleSelectLocation = (loc: any) => {
        if (compareMode) {
            if (compareList.length < 3) {
                setCompareList([...compareList, { ...loc, id: Date.now() }]);
            }
        } else {
            setSelectedLocation(loc);
        }
    };

    return (
        <div className="relative flex h-[calc(100dvh-48px-env(safe-area-inset-bottom))] flex-col overflow-hidden bg-slate-950 text-white">
            {/* Minimal High-Tech Search & Layer Controls */}
            <div className="pointer-events-none absolute inset-x-3 top-4 z-20 flex flex-col gap-3 sm:inset-x-8 sm:top-8 sm:flex-row sm:items-start sm:justify-between">
                <div className="pointer-events-auto min-w-0 space-y-4">
                    <form onSubmit={handleSearch} className="group flex w-full max-w-full items-center gap-3 rounded-[32px] border border-white/10 bg-slate-950 p-2 pr-4 shadow-2xl sm:w-80">
                        <button type="submit" className="bg-emerald-800 p-3 rounded-2xl" aria-label="搜索地点">
                            <Search className="w-5 h-5 text-white" />
                        </button>
                        <input
                            type="text"
                            id="map-search-input"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="搜索地点或经纬度..."
                            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-white placeholder-slate-300 w-full outline-none pointer-events-auto"
                        />
                    </form>
                    {searchError && <p role="alert" className="max-w-xs rounded-2xl bg-slate-950 px-4 py-2 text-sm text-white">{searchError}</p>}

                    <div className="flex gap-2">
                        {['solar', 'wind'].map((l) => (
                            <button
                                key={l}
                                onClick={() => setSelectedLayer(l)}
                                className={cn(
                                    "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    selectedLayer === l
                                        ? "bg-white text-slate-900 shadow-xl"
                                        : "bg-slate-950 border border-white/10 text-slate-200 hover:text-white"
                                )}
                            >
                                {l === 'solar' ? '光伏 GHI' : '风电 100M'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="pointer-events-auto flex w-full min-w-0 flex-col gap-4 text-white sm:w-56 sm:items-end">
                    <div className="bg-slate-950 border border-white/10 p-1.5 rounded-2xl shadow-2xl flex gap-1">
                        <button
                            onClick={() => setCompareMode(!compareMode)}
                            className={cn(
                                "p-3 rounded-xl transition-all",
                                compareMode ? "bg-emerald-800 text-white shadow-lg" : "text-slate-200 hover:bg-white/5"
                            )}
                            title="多点资源对比"
                        >
                            <ArrowRightLeft className="w-5 h-5" />
                        </button>
                        <button className="p-3 rounded-xl text-slate-200 hover:bg-white/5" title="历史 34 年序列查询">
                            <History className="w-5 h-5" />
                        </button>
                        <button className="p-3 rounded-xl text-slate-200 hover:bg-white/5" title="导出评估报告">
                            <Download className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Legend */}
                    <div className="w-full max-w-full space-y-3 rounded-3xl border border-white/10 bg-slate-950 p-4 shadow-2xl sm:p-5">
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="whitespace-normal break-words text-[10px] font-black uppercase tracking-widest text-slate-200">
                                {selectedLayer === 'solar' ? '辐照分级' : '风速分级'}
                            </h4>
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                        </div>
                        <div className="space-y-2">
                            {[1, 2, 3, 4].map((v) => (
                                <div key={v} className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-1.5 rounded-full",
                                        v === 1 ? "bg-red-500" : v === 2 ? "bg-orange-500" : v === 3 ? "bg-yellow-400" : "bg-blue-400"
                                    )}></div>
                                    <span className="text-[10px] font-bold text-slate-300">第 {v} 级</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Compare Sidebar / Drawer */}
            {compareMode && compareList.length > 0 && (
                <div className="absolute bottom-8 left-8 right-8 z-30 pointer-events-none">
                    <div className="max-w-4xl mx-auto flex gap-4 pointer-events-auto animate-in slide-in-from-bottom-8 duration-500">
                        {compareList.map((loc, idx) => (
                            <div key={loc.id} className="flex-1 bg-white p-6 rounded-[32px] shadow-2xl space-y-4 group">
                                <div className="flex justify-between items-start">
                                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-900 font-black text-xs">
                                        {idx + 1}
                                    </div>
                                    <button
                                        onClick={() => setCompareList(compareList.filter(l => l.id !== loc.id))}
                                        className="p-1 text-slate-200 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    <h5 className="font-black text-slate-900 text-sm truncate">{loc.name || '选定位置'}</h5>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{loc.coordinates || '39.9°N, 116.4°E'}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-2">
                                    <div className="bg-slate-50 p-3 rounded-2xl">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">年均</span>
                                        <span className="text-sm font-black text-slate-900">{idx === 0 ? '1650' : idx === 1 ? '1420' : '1580'}</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-2xl">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">内部收益率（IRR）·示例</span>
                                        <span className="text-sm font-black text-green-600">14.2%</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {compareList.length > 1 && (
                            <button className="bg-slate-900 text-white px-10 rounded-[32px] font-black text-xs uppercase tracking-widest hover:bg-green-600 transition-all flex flex-col items-center justify-center gap-2 group">
                                <Activity className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                深度对比报告
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Instruction Tip */}
            {compareMode && compareList.length === 0 && (
                <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 px-8 py-5 rounded-full flex items-center gap-4 animate-pulse">
                        <Sparkles className="w-5 h-5 text-green-400" />
                        <span className="text-sm font-black uppercase tracking-widest text-white">请在地图上点击 2-3 个点进行对比评估</span>
                    </div>
                </div>
            )}

            {!compareMode && !selectedLocation && (
                <div className="absolute inset-0 z-10 flex items-end justify-center pointer-events-none pb-20">
                    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-full flex items-center gap-3 animate-bounce shadow-2xl">
                        <MapIcon className="w-4 h-4 text-green-400" />
                        <span className="text-xs font-black uppercase tracking-widest text-white">请在地图上点击任意位置，或在上方搜索地址</span>
                    </div>
                </div>
            )}

            {/* Main Map */}
            <ResourceMap
                layer={selectedLayer}
                mapStyle={mapStyle}
                focus={mapCenter}
                onSelectLocation={handleSelectLocation}
            />

            {/* Location Detail (L1/L2) */}
            {selectedLocation && !compareMode && (
                <LocationDetail
                    location={selectedLocation}
                    onClose={() => setSelectedLocation(null)}
                />
            )}
        </div>
    );
}
