/**
 * GET /api/growth/funnel/weekly — 国内版全站只读周漏斗。
 *
 * 令牌：ENERGY_FUNNEL_READONLY_TOKEN（默认不设 = 入口关闭，返回 503）。
 * 只认 Authorization: Bearer <令牌>；不认登录会话、查询参数或其他口令。
 * 只导出 GET，其他方法由 Next 返回 405。返回只有全站合计，没有任何身份字段。
 */
import { prisma } from '@/lib/prisma';
import { bearerToken, checkParams, configuredToken, tokenMatches, WeekError } from '@/lib/growth/weekly-funnel';
import { reportFromDatabase } from '@/lib/growth/weekly-funnel-db';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

function fail(status: number, message: string): Response {
    return Response.json({ success: false, message }, { status, headers: NO_STORE });
}

export async function GET(request: Request): Promise<Response> {
    const expected = configuredToken();
    if (!expected) return fail(503, '只读入口未开启');
    if (!tokenMatches(bearerToken(request.headers.get('authorization')), expected)) {
        return fail(401, '只读令牌无效');
    }
    const url = new URL(request.url);
    const params = { weekStart: url.searchParams.get('week_start'), weeks: url.searchParams.get('weeks') };
    try {
        checkParams(params);
        const report = await reportFromDatabase(prisma, params);
        return Response.json(report, { headers: NO_STORE });
    } catch (error) {
        if (error instanceof WeekError) return fail(422, error.reason);
        console.error('weekly funnel failed', error instanceof Error ? error.name : 'unknown');
        return fail(503, '数据暂不可用，请稍后再试');
    }
}
