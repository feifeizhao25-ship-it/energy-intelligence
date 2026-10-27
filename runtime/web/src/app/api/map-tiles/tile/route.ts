import { NextRequest, NextResponse } from 'next/server';
import { tileUpstream } from '@/lib/map/tiles';

export async function GET(req: NextRequest) {
    const z = Number(req.nextUrl.searchParams.get('z'));
    const x = Number(req.nextUrl.searchParams.get('x'));
    const y = Number(req.nextUrl.searchParams.get('y'));
    const upstream = tileUpstream(process.env, z, x, y);
    if (!upstream) return NextResponse.json({ error: '地图未配置密钥' }, { status: 404 });
    try {
        const response = await fetch(upstream, { headers: { 'User-Agent': 'XinNengYuanZhiKu-Map/1.0' } });
        if (!response.ok) return NextResponse.json({ error: '瓦片暂不可用' }, { status: 502 });
        const bytes = await response.arrayBuffer();
        return new NextResponse(bytes, {
            headers: {
                'Content-Type': response.headers.get('content-type') || 'image/png',
                'Cache-Control': 'public, max-age=86400',
            },
        });
    } catch {
        return NextResponse.json({ error: '瓦片暂不可用' }, { status: 502 });
    }
}
