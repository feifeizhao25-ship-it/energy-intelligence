import { NextRequest, NextResponse } from 'next/server';
import { withOpenApi } from '@/lib/api/open-api-middleware';

async function handleGetMonitoring(_req: NextRequest, _keyData: unknown) {
    return NextResponse.json({
        success: false,
        error: 'TELEMETRY_NOT_CONNECTED',
        message: 'Verified SCADA/IoT telemetry is not connected; synthetic monitoring data is disabled.',
    }, { status: 503 });
}

export const GET = withOpenApi(handleGetMonitoring, 'read:monitoring');
