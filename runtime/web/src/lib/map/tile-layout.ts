/** Slippy-map layout. The selected lat/lng sits at the centre of the measured box, and the tiles cover that box. */

export const TILE_SIZE = 256;
export const DEFAULT_ZOOM = 4;
export const DEFAULT_MAP_CENTER = { lat: 35, lng: 105 };

export function worldToTile(lat: number, lng: number, zoom: number) {
    const n = 2 ** zoom;
    const x = ((lng + 180) / 360) * n;
    const latRad = (lat * Math.PI) / 180;
    const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
    return { x, y };
}

export function latLngToPixel(
    center: { lat: number; lng: number },
    zoom: number,
    width: number,
    height: number,
    lat: number,
    lng: number,
) {
    const origin = worldToTile(center.lat, center.lng, zoom);
    const point = worldToTile(lat, lng, zoom);
    return {
        x: width / 2 + (point.x - origin.x) * TILE_SIZE,
        y: height / 2 + (point.y - origin.y) * TILE_SIZE,
    };
}

export function pixelToLatLng(
    center: { lat: number; lng: number },
    zoom: number,
    width: number,
    height: number,
    px: number,
    py: number,
) {
    const origin = worldToTile(center.lat, center.lng, zoom);
    const worldX = origin.x + (px - width / 2) / TILE_SIZE;
    const worldY = origin.y + (py - height / 2) / TILE_SIZE;
    const n = 2 ** zoom;
    const lng = (worldX / n) * 360 - 180;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY / n))) * 180) / Math.PI;
    return { lat, lng };
}

export type MapTile = { x: number; y: number; left: number; top: number };

/** Tiles needed to cover a box of `width`×`height`, with `center` drawn at the box centre. */
export function tileGrid(
    center: { lat: number; lng: number },
    zoom: number,
    width: number,
    height: number,
): { tiles: MapTile[]; width: number; height: number } {
    const safeWidth = Math.max(width, 1);
    const safeHeight = Math.max(height, 1);
    const origin = worldToTile(center.lat, center.lng, zoom);
    const n = 2 ** zoom;
    const minX = Math.floor(origin.x - safeWidth / 2 / TILE_SIZE);
    const maxX = Math.floor(origin.x + safeWidth / 2 / TILE_SIZE);
    const minY = Math.floor(origin.y - safeHeight / 2 / TILE_SIZE);
    const maxY = Math.floor(origin.y + safeHeight / 2 / TILE_SIZE);
    const tiles: MapTile[] = [];
    for (let y = minY; y <= maxY; y += 1) {
        if (y < 0 || y >= n) continue;
        for (let x = minX; x <= maxX; x += 1) {
            const wrappedX = ((x % n) + n) % n;
            tiles.push({
                x: wrappedX,
                y,
                left: safeWidth / 2 + (x - origin.x) * TILE_SIZE,
                top: safeHeight / 2 + (y - origin.y) * TILE_SIZE,
            });
        }
    }
    return { tiles, width: safeWidth, height: safeHeight };
}
