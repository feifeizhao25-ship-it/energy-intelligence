import { NextRequest, NextResponse } from 'next/server';
import { withOpenApi } from '@/lib/api/open-api-middleware';

async function handleGetMonitoring(_req: NextRequest, _keyData: unknown) {
    return NextResponse.json({
        success: false,
        error: 'TELEMETRY_NOT_CONNECTED',
        message: '尚未接入经验证的 SCADA/IoT 遥测数据，系统不提供合成（模拟）的监测数据。',
    }, { status: 503 });
}

export const GET = withOpenApi(handleGetMonitoring, 'read:monitoring');
