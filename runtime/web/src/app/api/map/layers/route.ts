import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { importMapLayer, readMapLayers } from '@/lib/map/vector-layers';

export async function GET() {
    const data = readMapLayers();
    return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const body = await req.json().catch(() => null);
    try {
        const data = importMapLayer({
            id: String(body?.id || ''),
            title: body?.title,
            kind: body?.kind,
            licenceNote: body?.licenceNote,
            featureCollection: body?.featureCollection,
        });
        return NextResponse.json({ success: true, data });
    } catch {
        return NextResponse.json({ error: '图层导入失败，请检查要素和许可说明' }, { status: 400 });
    }
}
