import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { analyzeIvCurveLocal, computePerformanceRatio, describeInverterCode } from '@/lib/maintenance/local-diagnostics';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const body = await req.json().catch(() => null);
    const kind = body?.kind;
    try {
        if (kind === 'pr') {
            return NextResponse.json({ success: true, data: computePerformanceRatio({ actualKwh: Number(body.actualKwh), theoreticalKwh: Number(body.theoreticalKwh) }) });
        }
        if (kind === 'iv') {
            return NextResponse.json({ success: true, data: analyzeIvCurveLocal(body) });
        }
        if (kind === 'inverter') {
            return NextResponse.json({ success: true, data: describeInverterCode(String(body.code || ''), String(body.symptoms || '')) });
        }
    } catch {
        return NextResponse.json({ error: '诊断输入无效' }, { status: 400 });
    }
    return NextResponse.json({ error: '请选择性能比、IV 或逆变器代码' }, { status: 400 });
}
