import { mapTileStatus, tileUpstream } from './tiles';

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

    it('拒绝 OpenStreetMap 地址', () => {
        const status = mapTileStatus({
            APP_EDITION: 'cn',
            MAP_TILE_PROVIDER: 'tianditu',
            TIANDITU_KEY: 'secret-key',
            MAP_TILE_URL: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        });
        expect(status.reason).toBe('osm-blocked');
    });
});
