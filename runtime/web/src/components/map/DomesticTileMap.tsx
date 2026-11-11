'use client';

import { useEffect, useRef, useState } from 'react';
import { MapApprovalNotice } from './MapApprovalNotice';
import {
    DEFAULT_MAP_CENTER,
    DEFAULT_ZOOM,
    TILE_SIZE,
    latLngToPixel,
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
    const pointerOnMap = useRef(false);
    const [zoom, setZoom] = useState(DEFAULT_ZOOM);
    const [tilesUnavailable, setTilesUnavailable] = useState(false);
    const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
    const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(focus ?? initial ?? null);
    const [seenFocus, setSeenFocus] = useState(focus ? `${focus.lat},${focus.lng}` : '');
    const focusKey = focus ? `${focus.lat},${focus.lng}` : '';
    if (focusKey !== seenFocus) {
        setSeenFocus(focusKey);
        setPicked(null);
        setMarker(focus ?? null);
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
    const markerPx = marker && grid ? latLngToPixel(center, zoom, grid.width, grid.height, marker.lat, marker.lng) : null;
    const gridKey = grid ? `${zoom}:${grid.tiles.map((tile) => `${tile.x},${tile.y}`).join(';')}` : '';
    const [seenGrid, setSeenGrid] = useState(gridKey);
    if (gridKey !== seenGrid) {
        setSeenGrid(gridKey);
        setTilesUnavailable(false);
    }

    return (
        <div ref={frameRef} className="relative h-full min-h-[400px] w-full overflow-hidden bg-slate-100">
            <div
                className="absolute inset-0"
                onPointerDown={() => { pointerOnMap.current = true; }}
                onClick={(event) => {
                    // 没有落在地图上的 pointerdown（例如搜索按钮松手后的幽灵点击）不改选点。
                    if (!pointerOnMap.current || !grid) return;
                    pointerOnMap.current = false;
                    const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const next = pixelToLatLng(center, zoom, grid.width, grid.height, event.clientX - rect.left, event.clientY - rect.top);
                    setMarker(next);
                    onPick(next);
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
                        onError={(event) => {
                            event.currentTarget.hidden = true;
                            setTilesUnavailable(true);
                        }}
                    />
                ))}
                {markerPx && (
                    <span
                        data-testid="map-marker"
                        role="img"
                        aria-label="已选位置"
                        className="pointer-events-none absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-rose-600 shadow"
                        style={{ left: markerPx.x, top: markerPx.y }}
                    />
                )}
            </div>
            {tilesUnavailable && (
                <p role="status" data-testid="map-tiles-unavailable" className="pointer-events-none absolute inset-x-3 top-1/2 z-20 -translate-y-1/2 rounded-xl bg-white/95 px-4 py-3 text-center text-sm font-medium text-slate-900 shadow">
                    地图瓦片暂时不可用
                </p>
            )}
            <div className="absolute right-3 top-3 z-20 flex gap-2">
                <button type="button" aria-label="放大" className="rounded bg-white px-2 py-1 text-sm font-medium text-slate-900 shadow" onClick={() => setZoom((value) => Math.min(12, value + 1))}>放大</button>
                <button type="button" aria-label="缩小" className="rounded bg-white px-2 py-1 text-sm font-medium text-slate-900 shadow" onClick={() => setZoom((value) => Math.max(3, value - 1))}>缩小</button>
                <button type="button" aria-label="回到全国" className="rounded bg-white px-2 py-1 text-sm font-medium text-slate-900 shadow" onClick={() => setPicked(DEFAULT_MAP_CENTER)}>回到全国</button>
            </div>
            <p className="absolute bottom-3 left-3 rounded bg-white/90 px-3 py-1 text-xs text-slate-600">点击地图选择位置。瓦片密钥留在服务端。</p>
            <MapApprovalNotice />
        </div>
    );
}
