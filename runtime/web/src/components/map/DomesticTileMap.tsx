'use client';

import { useMemo, useState } from 'react';

const TILE = 256;

function worldToTile(lat: number, lng: number, zoom: number) {
    const n = 2 ** zoom;
    const x = ((lng + 180) / 360) * n;
    const latRad = (lat * Math.PI) / 180;
    const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
    return { x, y };
}

function tilePixelToLatLng(zoom: number, tileX: number, tileY: number, px: number, py: number) {
    const n = 2 ** zoom;
    const x = (tileX + px / TILE) / n;
    const y = (tileY + py / TILE) / n;
    const lng = x * 360 - 180;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
    return { lat, lng };
}

export default function DomesticTileMap({
    onPick,
    initial,
}: {
    onPick: (location: { lat: number; lng: number }) => void;
    initial?: { lat: number; lng: number };
}) {
    const [zoom, setZoom] = useState(4);
    const [center, setCenter] = useState(initial || { lat: 35, lng: 105 });
    const origin = useMemo(() => worldToTile(center.lat, center.lng, zoom), [center, zoom]);
    const startX = Math.floor(origin.x) - 1;
    const startY = Math.floor(origin.y) - 1;
    const tiles = [];
    for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
            const x = startX + col;
            const y = startY + row;
            if (x < 0 || y < 0) continue;
            tiles.push({ x, y, left: col * TILE, top: row * TILE });
        }
    }
    return (
        <div className="relative h-[400px] overflow-hidden bg-slate-100">
            <div
                className="absolute"
                style={{ left: -(origin.x - startX) * TILE + 400, top: -(origin.y - startY) * TILE + 160 }}
                onClick={(event) => {
                    const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const px = event.clientX - rect.left;
                    const py = event.clientY - rect.top;
                    const tileX = startX + Math.floor(px / TILE);
                    const tileY = startY + Math.floor(py / TILE);
                    onPick(tilePixelToLatLng(zoom, tileX, tileY, px % TILE, py % TILE));
                }}
            >
                {tiles.map((tile) => (
                    <img
                        key={`${tile.x}-${tile.y}`}
                        alt=""
                        width={TILE}
                        height={TILE}
                        className="absolute"
                        style={{ left: tile.left, top: tile.top }}
                        src={`/api/map-tiles/tile?z=${zoom}&x=${tile.x}&y=${tile.y}`}
                    />
                ))}
            </div>
            <div className="absolute right-3 top-3 flex gap-2">
                <button type="button" className="rounded bg-white px-2 py-1 text-sm shadow" onClick={() => setZoom((value) => Math.min(12, value + 1))}>放大</button>
                <button type="button" className="rounded bg-white px-2 py-1 text-sm shadow" onClick={() => setZoom((value) => Math.max(3, value - 1))}>缩小</button>
                <button type="button" className="rounded bg-white px-2 py-1 text-sm shadow" onClick={() => setCenter({ lat: 35, lng: 105 })}>回到全国</button>
            </div>
            <p className="absolute bottom-3 left-3 rounded bg-white/90 px-3 py-1 text-xs text-slate-600">点击地图选择位置。瓦片密钥留在服务端。</p>
        </div>
    );
}
