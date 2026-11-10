import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(__dirname, rel), 'utf8');

describe('国内地图页面不再把高德 JS 密钥发给浏览器', () => {
    it('选点和资源地图只走瓦片代理，未配置时给出原文提示', () => {
        const picker = read('../../components/map/LocationPicker.tsx');
        const resource = read('../../components/map/ResourceMap.tsx');
        const tiles = read('../../components/map/DomesticTileMap.tsx');
        for (const source of [picker, resource, tiles]) {
            expect(source).not.toMatch(/NEXT_PUBLIC_AMAP|securityJsCode|_AMapSecurityConfig|amap-jsapi-loader/);
            expect(source).not.toMatch(/openstreetmap\.org|nominatim|unpkg\.com/);
        }
        expect(picker).toContain('地图服务暂不可用');
        expect(picker).toContain('请直接填写经纬度');
        expect(resource).toContain("MAP_UNAVAILABLE_TEXT = '地图服务暂不可用'");
        expect(resource).toContain('请直接填写经纬度');
        expect(tiles).toContain('/api/map-tiles/tile?');
        expect(tiles).not.toMatch(/[?&]key=|[?&]tk=/);
    });
});
