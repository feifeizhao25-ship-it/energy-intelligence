/**
 * 国内地图瓦片状态。密钥只留在服务端，返回值里不出现 tk 或密钥。
 * 未配置时关闭，不回退到 OpenStreetMap。
 */

export interface MapTileStatus {
    enabled: boolean;
    provider: string;
    reason: string;
}

export function mapTileStatus(env: NodeJS.ProcessEnv = process.env): MapTileStatus {
    const edition = (env.APP_EDITION || '').toLowerCase();
    if (edition && edition !== 'cn') return { enabled: false, reason: 'not-cn', provider: '' };
    const provider = (env.MAP_TILE_PROVIDER || '').trim().toLowerCase();
    const tianditu = (env.TIANDITU_KEY || '').trim();
    const gaode = (env.GAODE_MAP_KEY || '').trim();
    const url = (env.MAP_TILE_URL || '').toLowerCase();
    if (url.includes('openstreetmap.org') || url.includes('tile.openstreetmap')) {
        return { enabled: false, reason: 'osm-blocked', provider: 'disabled' };
    }
    if (provider === 'tianditu' || provider === '天地图') {
        if (!tianditu) return { enabled: false, reason: 'key-unset', provider: 'tianditu' };
        return { enabled: true, provider: 'tianditu', reason: '' };
    }
    if (provider === 'amap' || provider === 'gaode' || provider === '高德') {
        if (!gaode) return { enabled: false, reason: 'key-unset', provider: 'amap' };
        return { enabled: true, provider: 'amap', reason: '' };
    }
    return { enabled: false, reason: 'unset', provider };
}

const TIANDITU = 'https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk={key}';
const GAODE = 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}';

export function tileUpstream(env: NodeJS.ProcessEnv, z: number, x: number, y: number): string | null {
    const status = mapTileStatus(env);
    if (!status.enabled) return null;
    if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > 18 || x < 0 || y < 0) return null;
    const span = 2 ** z;
    if (x >= span || y >= span) return null;
    const sub = String((x + y) % (status.provider === 'amap' ? 4 : 8) + (status.provider === 'amap' ? 1 : 0));
    const template = status.provider === 'amap' ? GAODE : TIANDITU;
    return template
        .replace('{s}', sub)
        .replace('{z}', String(z))
        .replace('{x}', String(x))
        .replace('{y}', String(y))
        .replace('{key}', (env.TIANDITU_KEY || '').trim());
}
