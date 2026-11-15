import { mapTileStatus, siblingTileUpstream, tileBytesLookLikeImage, tileUpstream } from './tiles';

describe('国内地图瓦片', () => {
    it('未配置密钥时关闭，返回值不含密钥', () => {
        const status = mapTileStatus({ APP_EDITION: 'cn', MAP_TILE_PROVIDER: 'tianditu', TIANDITU_KEY: '' });
        expect(status).toEqual({ enabled: false, reason: 'key-unset', provider: 'tianditu' });
        expect(JSON.stringify(status)).not.toContain('secret');
        expect(tileUpstream({ APP_EDITION: 'cn', MAP_TILE_PROVIDER: 'tianditu', TIANDITU_KEY: '' }, 4, 1, 1)).toBeNull();
    });

    it('天地图地址只在服务端拼密钥', () => {
        const env = { APP_EDITION: 'cn', MAP_TILE_PROVIDER: 'tianditu', TIANDITU_KEY: 'secret-key' };
        expect(JSON.stringify(mapTileStatus(env))).not.toContain('secret-key');
        const url = tileUpstream(env, 4, 12, 6);
        expect(url).toContain('tianditu.gov.cn');
        expect(url).toContain('tk=secret-key');
        expect(tileUpstream(env, 99, 1, 1)).toBeNull();
    });

    it('高德瓦片只在配了密钥时开启，地址里不带密钥', () => {
        const missing = mapTileStatus({ APP_EDITION: 'cn', MAP_TILE_PROVIDER: 'amap', GAODE_MAP_KEY: '' });
        expect(missing).toEqual({ enabled: false, reason: 'key-unset', provider: 'amap' });
        const env = { APP_EDITION: 'cn', MAP_TILE_PROVIDER: 'gaode', GAODE_MAP_KEY: 'gaode-secret' };
        expect(mapTileStatus(env)).toEqual({ enabled: true, provider: 'amap', reason: '' });
        const url = tileUpstream(env, 5, 26, 12);
        expect(url).toContain('autonavi.com');
        expect(url).not.toContain('gaode-secret');
        expect(url).not.toContain('key=');
        expect(JSON.stringify(mapTileStatus(env))).not.toContain('gaode-secret');
    });

    it('拒绝 OpenStreetMap 地址', () => {
        const status = mapTileStatus({
            APP_EDITION: 'cn',
            MAP_TILE_PROVIDER: 'tianditu',
            TIANDITU_KEY: 'secret-key',
            MAP_TILE_URL: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        });
        expect(status.reason).toBe('osm-blocked');
    });

    it('502 时只换同一服务商的下一台主机', () => {
        const gaode = tileUpstream({ APP_EDITION: 'cn', MAP_TILE_PROVIDER: 'gaode', GAODE_MAP_KEY: 'secret' }, 4, 12, 6);
        const nextGaode = siblingTileUpstream(gaode || '');
        expect(nextGaode).toContain('autonavi.com');
        expect(nextGaode).not.toBe(gaode);
        expect(nextGaode).not.toContain('secret');
        const tianditu = tileUpstream({ APP_EDITION: 'cn', MAP_TILE_PROVIDER: 'tianditu', TIANDITU_KEY: 'secret-key' }, 4, 12, 6);
        const nextTianditu = siblingTileUpstream(tianditu || '');
        expect(nextTianditu).toContain('tianditu.gov.cn');
        expect(nextTianditu).toContain('tk=secret-key');
        expect(nextTianditu).not.toBe(tianditu);
        const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 40 }, () => 2)]);
        expect(tileBytesLookLikeImage('image/png', png)).toBe(true);
        expect(tileBytesLookLikeImage('text/html', new TextEncoder().encode('<html>no tile</html>'))).toBe(false);
    });
});
