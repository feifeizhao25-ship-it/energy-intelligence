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
// 高德瓦片地址不带 key。GAODE_MAP_KEY 只决定是否开启这条代理，不出现在浏览器或上游 URL 里。
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

/** 同一服务商的另一台瓦片主机。不是新的地图供应商。 */
export function siblingTileUpstream(url: string): string | null {
    const gaode = url.match(/^(https:\/\/webrd0)([1-4])(\.is\.autonavi\.com\/.*)$/);
    if (gaode) return `${gaode[1]}${(Number(gaode[2]) % 4) + 1}${gaode[3]}`;
    const tianditu = url.match(/^(https:\/\/t)([0-7])(\.tianditu\.gov\.cn\/.*)$/);
    if (tianditu) return `${tianditu[1]}${(Number(tianditu[2]) + 1) % 8}${tianditu[3]}`;
    return null;
}

/** 上游 502/503/504 或连接失败时换一台同服务商主机再试一次。403/418 这类拒绝不重试。 */
export const TILE_RETRY_STATUSES = new Set([502, 503, 504]);

export function tileBytesLookLikeImage(contentType: string | null, bytes: Uint8Array): boolean {
    const type = (contentType || '').split(';')[0].trim().toLowerCase();
    if (type.startsWith('image/') && bytes.byteLength > 32) return true;
    if (bytes.byteLength < 8) return false;
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const webp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
    return (png || jpeg || webp) && bytes.byteLength > 32;
}
