import { TILE_SIZE, pixelToLatLng, tileGrid } from './tile-layout';

function covers(tiles: { left: number; top: number }[], width: number, height: number) {
    const right = Math.max(...tiles.map((tile) => tile.left + TILE_SIZE));
    const bottom = Math.max(...tiles.map((tile) => tile.top + TILE_SIZE));
    const left = Math.min(...tiles.map((tile) => tile.left));
    const top = Math.min(...tiles.map((tile) => tile.top));
    expect(left).toBeLessThanOrEqual(0);
    expect(top).toBeLessThanOrEqual(0);
    expect(right).toBeGreaterThanOrEqual(width);
    expect(bottom).toBeGreaterThanOrEqual(height);
}

describe('地图瓦片按容器尺寸居中并铺满', () => {
    const china = { lat: 35, lng: 105 };

    it('375px 宽时选中的经纬度落在容器中心，而不是固定的 400px 偏移', () => {
        const width = 375;
        const height = 400;
        const grid = tileGrid(china, 4, width, height);
        const back = pixelToLatLng(china, 4, width, height, width / 2, height / 2);
        expect(back.lat).toBeCloseTo(china.lat, 6);
        expect(back.lng).toBeCloseTo(china.lng, 6);
        expect(width / 2).toBeLessThan(width);
        expect(width / 2).not.toBe(400);
        covers(grid.tiles, width, height);
    });

    it('1280px 宽时瓦片铺满容器，右侧没有空白条', () => {
        const grid = tileGrid(china, 4, 1280, 400);
        covers(grid.tiles, 1280, 400);
        expect(grid.tiles.length).toBeGreaterThan(3);
    });

    it('换成刚解析出的坐标后，中心瓦片跟着移动', () => {
        const before = tileGrid({ lat: 43.8, lng: 87.6 }, 4, 375, 400);
        const after = tileGrid({ lat: 31.23, lng: 121.47 }, 4, 375, 400);
        const centerTile = (grid: ReturnType<typeof tileGrid>) => grid.tiles.find((tile) =>
            tile.left <= 375 / 2 && tile.left + TILE_SIZE > 375 / 2
            && tile.top <= 200 && tile.top + TILE_SIZE > 200);
        expect(centerTile(before)?.x).not.toBe(centerTile(after)?.x);
        const back = pixelToLatLng({ lat: 31.23, lng: 121.47 }, 4, 375, 400, 375 / 2, 200);
        expect(back.lat).toBeCloseTo(31.23, 6);
        expect(back.lng).toBeCloseTo(121.47, 6);
    });
});
