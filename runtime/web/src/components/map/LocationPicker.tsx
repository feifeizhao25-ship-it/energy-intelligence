// 地图位置选择器。国内只走服务端瓦片，或让用户直接填经纬度。
'use client';

import { useEffect, useState } from 'react';
import { MapPin, Search, X, Crosshair, Loader2 } from 'lucide-react';
import DomesticTileMap from './DomesticTileMap';
import { resolveMapSearch, windPickerSearchNote } from '@/lib/map/map-search';
import { provinceFromGeocodeRecord } from '@/lib/map/picked-province';

const MAP_UNAVAILABLE = '地图服务暂不可用';
const MAP_KEY_UNSET = '地图未配置密钥，请直接填写经纬度';

/** 搜索结果里已有省名就用它；地图点选只有坐标时再逆地理编码，失败则保持原样。 */
async function withProvince(location: LocationData): Promise<LocationData> {
    if (location.province) return location;
    try {
        const response = await fetch(
            `/api/location?action=reverse&lat=${encodeURIComponent(String(location.lat))}&lng=${encodeURIComponent(String(location.lng))}`,
            { signal: AbortSignal.timeout(8000) },
        );
        const body = await response.json().catch(() => null);
        const province = provinceFromGeocodeRecord(body?.data);
        return province ? { ...location, province } : location;
    } catch {
        return location;
    }
}

interface LocationData {
    lat: number;
    lng: number;
    address?: string;
    province?: string;
    city?: string;
    district?: string;
}

interface LocationPickerProps {
    value?: { lat: string; lng: string; province?: string };
    onChange: (location: LocationData) => void;
    placeholder?: string;
}

export default function LocationPicker({ value, onChange, placeholder = "点击地图或搜索地址选择位置" }: LocationPickerProps) {
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchNote, setSearchNote] = useState<string | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
    const [tempLocation, setTempLocation] = useState<LocationData | null>(null);
    const [tileMode, setTileMode] = useState<'loading' | 'domestic' | 'disabled'>('loading');
    const [manualLat, setManualLat] = useState('');
    const [manualLng, setManualLng] = useState('');
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        if (!isMapOpen) return;
        let cancelled = false;
        setTileMode('loading');
        fetch('/api/map-tiles')
            .then((response) => response.json())
            .then((data) => {
                if (cancelled) return;
                setTileMode(data?.enabled ? 'domestic' : 'disabled');
            })
            .catch(() => {
                if (cancelled) return;
                setTileMode('disabled');
            });
        return () => { cancelled = true; };
    }, [isMapOpen]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setSearchNote(null);
        try {
            const result = await resolveMapSearch(searchQuery);
            if ('error' in result) {
                setSearchNote(windPickerSearchNote(result));
                return;
            }
            setTempLocation({
                lat: result.lat,
                lng: result.lng,
                address: result.name,
                province: result.province,
            });
        } catch {
            setSearchNote(`${MAP_UNAVAILABLE}，${MAP_KEY_UNSET}`);
        } finally {
            setIsSearching(false);
        }
    };

    const handleLocateMe = () => {
        if (!navigator.geolocation) {
            setSearchNote(MAP_KEY_UNSET);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setTempLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
            },
            () => setSearchNote(MAP_KEY_UNSET),
        );
    };

    const handleConfirm = async () => {
        if (!tempLocation || confirming) return;
        setConfirming(true);
        try {
            const picked = await withProvince(tempLocation);
            setSelectedLocation(picked);
            onChange(picked);
            setIsMapOpen(false);
        } finally {
            setConfirming(false);
        }
    };

    const handleCancel = () => {
        setTempLocation(null);
        setIsMapOpen(false);
    };

    const displayText = selectedLocation
        ? (selectedLocation.address || `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`)
        : (value?.lat && value?.lng
            ? `${value.lat}, ${value.lng}`
            : placeholder);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsMapOpen(true)}
                className="w-full flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left group"
            >
                <MapPin className="w-5 h-5 text-blue-600 group-hover:text-blue-700" />
                <span className={`flex-1 min-w-0 break-words ${selectedLocation || (value?.lat && value?.lng) ? 'text-gray-900' : 'text-gray-500'}`}>
                    {displayText}
                </span>
                <span className="shrink-0 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    点击选择
                </span>
            </button>

            {isMapOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <MapPin className="w-5 h-5" />
                                选择项目位置
                            </h3>
                            <button type="button" onClick={handleCancel} className="text-white/80 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-4 border-b bg-gray-50">
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="搜索地址、城市或地名..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSearch}
                                    disabled={isSearching}
                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    搜索
                                </button>
                                <button
                                    type="button"
                                    onClick={handleLocateMe}
                                    className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center gap-2"
                                    title="定位到当前位置"
                                >
                                    <Crosshair className="w-4 h-4" />
                                </button>
                            </div>
                            {searchNote && <p className="mt-2 text-sm text-slate-600" role="status">{searchNote}</p>}
                        </div>

                        {tileMode === 'loading' && (
                            <div className="flex h-40 items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                            </div>
                        )}
                        {tileMode === 'disabled' && (
                            <div className="p-6" role="status">
                                <p className="text-base font-medium text-slate-800">{MAP_UNAVAILABLE}</p>
                                <p className="mt-1 text-sm text-slate-600">{MAP_KEY_UNSET}</p>
                                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                    <label>纬度
                                        <input value={manualLat} onChange={(event) => setManualLat(event.target.value)} inputMode="decimal" placeholder="例如 31.23" className="mt-1 w-full rounded border px-2 py-1.5" />
                                    </label>
                                    <label>经度
                                        <input value={manualLng} onChange={(event) => setManualLng(event.target.value)} inputMode="decimal" placeholder="例如 121.47" className="mt-1 w-full rounded border px-2 py-1.5" />
                                    </label>
                                </div>
                                <button
                                    type="button"
                                    className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                                    onClick={() => {
                                        const lat = Number(manualLat);
                                        const lng = Number(manualLng);
                                        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
                                        setTempLocation({ lat, lng });
                                    }}
                                >使用这两个坐标</button>
                            </div>
                        )}
                        {tileMode === 'domestic' && (
                            <DomesticTileMap
                                initial={value?.lat && value?.lng ? { lat: parseFloat(value.lat), lng: parseFloat(value.lng) } : undefined}
                                focus={tempLocation ? { lat: tempLocation.lat, lng: tempLocation.lng } : undefined}
                                onPick={(location) => setTempLocation(location)}
                            />
                        )}

                        {tempLocation && (
                            <div className="border-t px-4 py-3 text-sm text-slate-700">
                                已选 {tempLocation.address || '位置'}：纬度 {tempLocation.lat.toFixed(6)}，经度 {tempLocation.lng.toFixed(6)}
                            </div>
                        )}

                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button type="button" onClick={handleCancel} className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={!tempLocation || confirming}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                <MapPin className="w-4 h-4" />
                                确认选择
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
