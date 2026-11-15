import { NextRequest, NextResponse } from 'next/server';
import { siblingTileUpstream, TILE_RETRY_STATUSES, tileBytesLookLikeImage, tileUpstream } from '@/lib/map/tiles';

const UNAVAILABLE = { error: '地图瓦片暂时不可用' };

async function readTile(url: string): Promise<{ ok: true; bytes: Uint8Array; type: string } | { ok: false; status: number }> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'XinNengYuanZhiKu-Map/1.0',
                Accept: 'image/png,image/jpeg,image/webp,image/*;q=0.8',
            },
            cache: 'no-store',
            signal: AbortSignal.timeout(8000),
        });
        const bytes = new Uint8Array(await response.arrayBuffer());
        const type = response.headers.get('content-type');
        if (response.ok && tileBytesLookLikeImage(type, bytes)) {
            const contentType = (type || 'image/png').split(';')[0];
            return { ok: true, bytes, type: contentType.startsWith('image/') ? contentType : 'image/png' };
        }
        // 200 但不是图片（错误页）按暂时失败处理，好让同服务商的另一台主机再试一次。
        return { ok: false, status: response.ok ? 502 : response.status };
    } catch {
        return { ok: false, status: 502 };
    }
}

function imageResponse(bytes: Uint8Array, type: string) {
    return new NextResponse(Buffer.from(bytes), {
        headers: {
            'Content-Type': type,
            'Cache-Control': 'public, max-age=86400',
        },
    });
}

export async function GET(req: NextRequest) {
    const z = Number(req.nextUrl.searchParams.get('z'));
    const x = Number(req.nextUrl.searchParams.get('x'));
    const y = Number(req.nextUrl.searchParams.get('y'));
    const upstream = tileUpstream(process.env, z, x, y);
    if (!upstream) return NextResponse.json({ error: '地图未配置密钥' }, { status: 404 });
    const first = await readTile(upstream);
    if (first.ok) return imageResponse(first.bytes, first.type);
    const sibling = TILE_RETRY_STATUSES.has(first.status) ? siblingTileUpstream(upstream) : null;
    if (sibling && sibling !== upstream) {
        const second = await readTile(sibling);
        if (second.ok) return imageResponse(second.bytes, second.type);
    }
    return NextResponse.json(UNAVAILABLE, { status: 502 });
}
