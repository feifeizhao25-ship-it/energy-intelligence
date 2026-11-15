'use client';

import React, { useEffect, useState } from 'react';
import DomesticTileMap from './DomesticTileMap';

interface ResourceMapProps {
    layer: string;
    mapStyle: string;
    onSelectLocation: (location: { lat: number; lng: number; name: string }) => void;
    focus?: { lat: number; lng: number };
}

/**
 * 国内地图只有服务端瓦片代理这一条。未配置密钥时不加载高德 JS，也不切到境外地图。
 */
export const MAP_UNAVAILABLE_TEXT = '地图服务暂不可用';
export const MAP_KEY_UNSET_TEXT = '地图未配置密钥，请直接填写经纬度';

const MapUnavailable = ({ onSelect }: { onSelect: (location: { lat: number; lng: number; name: string }) => void }) => {
    const [lat, setLat] = useState('');
    const [lng, setLng] = useState('');
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const valid = lat !== '' && lng !== '' && Number.isFinite(latNum) && Number.isFinite(lngNum)
        && Math.abs(latNum) <= 90 && Math.abs(lngNum) <= 180;
    return (
        <div role="status" className="flex h-full w-full items-center justify-center bg-slate-100 p-6">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg">
                <p className="text-base font-bold text-slate-800">{MAP_UNAVAILABLE_TEXT}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{MAP_KEY_UNSET_TEXT}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-left text-xs text-slate-600">
                    <label>纬度<input value={lat} onChange={e => setLat(e.target.value)} inputMode="decimal" placeholder="例如 32.06" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label>
                    <label>经度<input value={lng} onChange={e => setLng(e.target.value)} inputMode="decimal" placeholder="例如 118.79" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label>
                </div>
                <button type="button" disabled={!valid}
                    onClick={() => onSelect({ lat: latNum, lng: lngNum, name: `位置 (${latNum.toFixed(4)}, ${lngNum.toFixed(4)})` })}
                    className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">按经纬度查询</button>
            </div>
        </div>
    );
};

export default function ResourceMap({ layer, mapStyle, onSelectLocation, focus }: ResourceMapProps) {
    void layer;
    void mapStyle;
    const [ready, setReady] = useState(false);
    const [domestic, setDomestic] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/map-tiles')
            .then((response) => response.json())
            .then((status) => {
                if (cancelled) return;
                setDomestic(Boolean(status?.enabled));
                setReady(true);
            })
            .catch(() => {
                if (cancelled) return;
                setDomestic(false);
                setReady(true);
            });
        return () => { cancelled = true; };
    }, []);

    if (!ready) {
        return <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">正在检查地图配置...</div>;
    }
    if (!domestic) return <MapUnavailable onSelect={onSelectLocation} />;
    return (
        <div className="relative h-full min-h-[400px] w-full flex-1">
            <DomesticTileMap
                focus={focus}
                controlsClassName="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-3 z-40 flex gap-1.5 sm:absolute sm:bottom-auto sm:top-3 sm:z-30"
                onPick={(location) => onSelectLocation({
                    lat: location.lat,
                    lng: location.lng,
                    name: `位置 (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`,
                })}
            />
        </div>
    );
}
