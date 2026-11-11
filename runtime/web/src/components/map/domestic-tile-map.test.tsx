import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import DomesticTileMap from './DomesticTileMap';
import { TILE_SIZE, tileGrid } from '@/lib/map/tile-layout';

describe('瓦片图', () => {
    it('瓦片图保持 256px，不受 img max-width:100% 压成 0', () => {
        const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');
        expect(css).toMatch(/img\.map-tile\s*\{[^}]*max-width:\s*none/);
        expect(css).toMatch(/img\.map-tile\s*\{[^}]*width:\s*256px/);
        const html = renderToStaticMarkup(
            <DomesticTileMap frameSize={{ width: 375, height: 400 }} onPick={() => undefined} />,
        );
        expect(html).toContain('map-tile');
        expect(html).toContain('max-width:none');
        expect(html).toContain(`width:${TILE_SIZE}px`);
        expect(html).toContain(`height:${TILE_SIZE}px`);
        expect(html).not.toContain('left:400');
        expect(html).not.toContain('已选位置');
        expect(html).toContain('aria-label="放大"');
        expect(html).toContain('aria-label="缩小"');
        expect(html).toContain('aria-label="回到全国"');
        expect(html).toContain('text-slate-900');
        expect(html).toContain('>放大</button>');
        expect(html).toContain('>缩小</button>');
        expect(html).toContain('>回到全国</button>');
    });

    it('搜索或选中的点有标记，标记落在该经纬度上', () => {
        const center = { lat: 31.23, lng: 121.47 };
        const html = renderToStaticMarkup(
            <DomesticTileMap frameSize={{ width: 1280, height: 400 }} focus={center} onPick={() => undefined} />,
        );
        expect(html).toContain('aria-label="已选位置"');
        expect(html).toContain('data-testid="map-marker"');
        expect(html).toContain('left:640px');
        expect(html).toContain('top:200px');
        const picked = renderToStaticMarkup(
            <DomesticTileMap frameSize={{ width: 375, height: 400 }} initial={{ lat: 32.06, lng: 118.8 }} onPick={() => undefined} />,
        );
        expect(picked).toContain('aria-label="已选位置"');
        expect(picked).toContain('left:187.5px');
        expect(picked).toContain('top:200px');
    });

    it('按容器尺寸把选中的经纬度放在中心，并铺满 1280px 宽的容器', () => {
        const center = { lat: 31.23, lng: 121.47 };
        const grid = tileGrid(center, 4, 1280, 400);
        const html = renderToStaticMarkup(
            <DomesticTileMap frameSize={{ width: 1280, height: 400 }} focus={center} onPick={() => undefined} />,
        );
        for (const tile of grid.tiles) {
            expect(html).toContain(`/api/map-tiles/tile?z=4&amp;x=${tile.x}&amp;y=${tile.y}`);
        }
        const right = Math.max(...grid.tiles.map((tile) => tile.left + TILE_SIZE));
        expect(right).toBeGreaterThanOrEqual(1280);
    });

    it('焦点改到刚解析的坐标后，瓦片请求跟着变', () => {
        const first = renderToStaticMarkup(
            <DomesticTileMap frameSize={{ width: 375, height: 400 }} focus={{ lat: 43.8, lng: 87.6 }} onPick={() => undefined} />,
        );
        const second = renderToStaticMarkup(
            <DomesticTileMap frameSize={{ width: 375, height: 400 }} focus={{ lat: 31.23, lng: 121.47 }} onPick={() => undefined} />,
        );
        const tile = tileGrid({ lat: 31.23, lng: 121.47 }, 4, 375, 400).tiles[0];
        expect(second).toContain(`/api/map-tiles/tile?z=4&amp;x=${tile.x}&amp;y=${tile.y}`);
        expect(first).not.toBe(second);
    });
});
