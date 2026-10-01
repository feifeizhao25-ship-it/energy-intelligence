import { NextRequest, NextResponse } from 'next/server';
import { withOpenApi } from '@/lib/api/open-api-middleware';

/**
 * 开放 API v1 - 性能分析
 * 
 * GET /api/v1/projects/[id]/analytics
 * 
 * Headers:
 *   X-API-Key: your_api_key
 *   
 * Query Parameters:
 *   - period: 分析周期 (7d, 30d, 90d, 1y)
 *   - metrics: 指标选择 (efficiency, availability, generation, all)
 */

async function handleGetAnalytics(_req: NextRequest, _keyData: unknown) {
    return NextResponse.json({
        success: false,
        error: { code: 'VERIFIED_ANALYTICS_UNAVAILABLE', message: '尚未接入经验证的遥测与基准数据，系统不提供合成（模拟）的分析结果。' },
    }, { status: 503 });
}

export const GET = withOpenApi(handleGetAnalytics, 'read:analytics');
