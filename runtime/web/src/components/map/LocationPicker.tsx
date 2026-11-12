// 地图位置选择器。国内只走服务端瓦片，或让用户直接填经纬度。
'use client';

import { useEffect, useState } from 'react';
import { MapPin, Search, X, Crosshair, Loader2 } from 'lucide-react';
import DomesticTileMap from './DomesticTileMap';
import { resolveMapSearch, windPickerSearchNote } from '@/lib/map/map-search';
import { placeNameFromGeocodeRecord, provinceFromGeocodeRecord } from '@/lib/map/picked-province';
import {
    confirmPickerSelection,
    dismissPickerSelection,
    openPickerSession,
    stagePickerSelection,
} from '@/lib/map/picker-selection';

const MAP_UNAVAILABLE = '地图服务暂不可用';
const MAP_KEY_UNSET = '地图未配置密钥，请直接填写经纬度';

/** 搜索结果里已有省名和地名就用它；地图点选只有坐标时再逆地理编码，失败则保持原样。 */
async function withPlace(location: LocationData): Promise<LocationData> {
    if (location.province && location.address) return location;
    try {
        const response = await fetch(
            `/api/location?action=reverse&lat=${encodeURIComponent(String(location.lat))}&lng=${encodeURIComponent(String(location.lng))}`,
            { signal: AbortSignal.timeout(8000) },
        );
        const body = await response.json().catch(() => null);
        const province = location.province || provinceFromGeocodeRecord(body?.data);
        const address = location.address || placeNameFromGeocodeRecord(body?.data);
        return {
            ...location,
            ...(province ? { province } : {}),
            ...(address ? { address } : {}),
        };
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
    value?: { lat: string; lng: string; province?: string; name?: string };
    onChange: (location: LocationData) => void;
    placeholder?: string;
}

export default function LocationPicker({ value, onChange, placeholder = "点击地图或搜索地址选择位置" }: LocationPickerProps) {
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchNote, setSearchNote] = useState<string | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
    const [pickerSession, setPickerSession] = useState(() => openPickerSession<LocationData>(null));
    const [tileMode, setTileMode] = useState<'loading' | 'domestic' | 'disabled'>('loading');
    const [manualLat, setManualLat] = useState('');
    const [manualLng, setManualLng] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [searchSession, setSearchSession] = useState(0);
    const tempLocation = pickerSession.pending;

    // 点选、搜索、定位和手填只记在待确认位置上，确认选择才写回表单。
    const stage = (location: LocationData) => {
        setPickerSession((current) => stagePickerSelection(current, location));
    };

    const openPicker = () => {
        const lat = Number(value?.lat);
        const lng = Number(value?.lng);
        const committed = Number.isFinite(lat) && Number.isFinite(lng)
            ? { lat, lng, address: value?.name || '', province: value?.province }
            : null;
        setPickerSession(openPickerSession(committed));
        // 已确认的位置留在按钮上；只清搜索框，避免再次打开时接着上次的字继续输入。
        setSearchQuery('');
        setSearchNote(null);
        setSearchSession((session) => session + 1);
        setIsMapOpen(true);
    };

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
            stage({
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
                stage({ lat: position.coords.latitude, lng: position.coords.longitude, address: '' });
            },
            () => setSearchNote(MAP_KEY_UNSET),
        );
    };

    const handleConfirm = async () => {
        if (!tempLocation || confirming) return;
        setConfirming(true);
        try {
            const picked = await withPlace(tempLocation);
            const result = confirmPickerSelection(pickerSession, picked);
            if (!result) return;
            setPickerSession(result.session);
            setSelectedLocation(result.applied);
            onChange(result.applied);
            setIsMapOpen(false);
        } finally {
            setConfirming(false);
        }
    };

    const handleCancel = () => {
        const result = dismissPickerSelection(pickerSession);
        setPickerSession(result.session);
        if (result.restored) {
            setSelectedLocation(result.restored);
            onChange(result.restored);
        }
        setIsMapOpen(false);
    };

    const handleDismiss = () => {
        handleCancel();
    };

    const displayText = selectedLocation
        ? (selectedLocation.address || `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`)
        : (value?.name
            ? value.name
            : (value?.lat && value?.lng
                ? `${value.lat}, ${value.lng}`
                : placeholder));

    return (
        <div className="relative">
            <button
                type="button"
                onClick={openPicker}
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
                <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
                    <div className="scheme-light flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-white text-slate-900 sm:h-auto sm:max-h-[90dvh] sm:rounded-xl sm:shadow-2xl">
                        <div className="flex shrink-0 items-center justify-between border-b bg-gradient-to-r from-blue-600 to-blue-700 p-4">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <MapPin className="w-5 h-5" />
                                选择项目位置
                            </h3>
                            <button type="button" onClick={handleDismiss} className="text-white/80 hover:text-white transition-colors" aria-label="关闭">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form
                            className="shrink-0 border-b bg-gray-50 p-4"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void handleSearch();
                            }}
                        >
                            <div className="flex flex-wrap gap-2">
                                <div className="relative min-w-0 basis-full sm:flex-1">
                                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-600" />
                                    <input
                                        key={searchSession}
                                        type="search"
                                        enterKeyHint="search"
                                        autoComplete="off"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        placeholder="搜索地址、城市或地名..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onFocus={(event) => {
                                            const field = event.currentTarget;
                                            requestAnimationFrame(() => field.select());
                                        }}
                                        className="scheme-light w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-slate-900 caret-slate-900 placeholder:text-slate-500 placeholder:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSearching}
                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex flex-1 items-center justify-center gap-2 sm:flex-none"
                                >
                                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    搜索
                                </button>
                                <button
                                    type="button"
                                    onClick={handleLocateMe}
                                    className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-slate-800 hover:bg-gray-100"
                                    title="定位到当前位置"
                                    aria-label="定位到当前位置"
                                >
                                    <Crosshair className="h-4 w-4 text-slate-800" />
                                </button>
                            </div>
                            {searchNote && <p className="mt-2 text-sm text-slate-600" role="status">{searchNote}</p>}
                        </form>

                        <div className="min-h-0 flex-1 overflow-y-auto">

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
                                        <input value={manualLat} onChange={(event) => setManualLat(event.target.value)} inputMode="decimal" placeholder="例如 31.23" className="scheme-light mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-900 placeholder:text-slate-500" />
                                    </label>
                                    <label>经度
                                        <input value={manualLng} onChange={(event) => setManualLng(event.target.value)} inputMode="decimal" placeholder="例如 121.47" className="scheme-light mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-900 placeholder:text-slate-500" />
                                    </label>
                                </div>
                                <button
                                    type="button"
                                    className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                                    onClick={() => {
                                        const lat = Number(manualLat);
                                        const lng = Number(manualLng);
                                        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
                                        stage({ lat, lng, address: '' });
                                    }}
                                >使用这两个坐标</button>
                            </div>
                        )}
                        {tileMode === 'domestic' && (
                            <DomesticTileMap
                                initial={value?.lat && value?.lng ? { lat: parseFloat(value.lat), lng: parseFloat(value.lng) } : undefined}
                                focus={tempLocation ? { lat: tempLocation.lat, lng: tempLocation.lng } : undefined}
                                onPick={(location) => stage({ lat: location.lat, lng: location.lng, address: '' })}
                            />
                        )}

                        {tempLocation && (
                            <div className="border-t px-4 py-3 text-sm text-slate-700">
                                已选 {tempLocation.address || '位置'}：纬度 {tempLocation.lat.toFixed(6)}，经度 {tempLocation.lng.toFixed(6)}
                            </div>
                        )}
                        </div>

                        <div className="flex shrink-0 justify-end gap-3 border-t bg-gray-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                            <button type="button" onClick={handleCancel} className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-slate-900 transition-colors hover:bg-gray-100">
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
