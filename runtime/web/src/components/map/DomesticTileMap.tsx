'use client';

import { useEffect, useRef, useState } from 'react';
import { MapApprovalNotice } from './MapApprovalNotice';
import {
    DEFAULT_MAP_CENTER,
    DEFAULT_ZOOM,
    TILE_SIZE,
    pixelToLatLng,
    tileGrid,
} from '@/lib/map/tile-layout';

export default function DomesticTileMap({
    onPick,
    initial,
    focus,
    frameSize,
}: {
    onPick: (location: { lat: number; lng: number }) => void;
    initial?: { lat: number; lng: number };
    focus?: { lat: number; lng: number };
    frameSize?: { width: number; height: number };
}) {
    const frameRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(DEFAULT_ZOOM);
    const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
    const [seenFocus, setSeenFocus] = useState(focus ? `${focus.lat},${focus.lng}` : '');
    const focusKey = focus ? `${focus.lat},${focus.lng}` : '';
    if (focusKey !== seenFocus) {
        setSeenFocus(focusKey);
        setPicked(null);
    }
    const center = picked ?? focus ?? initial ?? DEFAULT_MAP_CENTER;
    const [measured, setMeasured] = useState(frameSize ?? { width: 0, height: 0 });
    const size = frameSize ?? measured;

    useEffect(() => {
        if (frameSize) return undefined;
        const el = frameRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const apply = () => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) setMeasured({ width: rect.width, height: rect.height });
        };
        apply();
        const observer = new ResizeObserver(apply);
        observer.observe(el);
        return () => observer.disconnect();
    }, [frameSize]);

    const grid = size.width > 0 && size.height > 0 ? tileGrid(center, zoom, size.width, size.height) : null;

    return (
        <div ref={frameRef} className="relative h-full min-h-[400px] w-full overflow-hidden bg-slate-100">
            <div
                className="absolute inset-0"
                onClick={(event) => {
                    if (!grid) return;
                    const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                    onPick(pixelToLatLng(center, zoom, grid.width, grid.height, event.clientX - rect.left, event.clientY - rect.top));
                }}
            >
                {grid?.tiles.map((tile) => (
                    <img
                        key={`${tile.x}-${tile.y}-${tile.left}-${tile.top}`}
                        alt=""
                        width={TILE_SIZE}
                        height={TILE_SIZE}
                        className="map-tile absolute max-w-none"
                        style={{ left: tile.left, top: tile.top, width: TILE_SIZE, height: TILE_SIZE, maxWidth: 'none' }}
                        src={`/api/map-tiles/tile?z=${zoom}&x=${tile.x}&y=${tile.y}`}
                    />
                ))}
            </div>
            <div className="absolute right-3 top-3 flex gap-2">
                <button type="button" className="rounded bg-white px-2 py-1 text-sm shadow" onClick={() => setZoom((value) => Math.min(12, value + 1))}>放大</button>
                <button type="button" className="rounded bg-white px-2 py-1 text-sm shadow" onClick={() => setZoom((value) => Math.max(3, value - 1))}>缩小</button>
                <button type="button" className="rounded bg-white px-2 py-1 text-sm shadow" onClick={() => setPicked(DEFAULT_MAP_CENTER)}>回到全国</button>
            </div>
            <p className="absolute bottom-3 left-3 rounded bg-white/90 px-3 py-1 text-xs text-slate-600">点击地图选择位置。瓦片密钥留在服务端。</p>
            <MapApprovalNotice />
        </div>
    );
}
