import { NextRequest, NextResponse } from 'next/server';
import { tariffDefaults } from '@/lib/pricing/tariff-defaults';
import { TARIFFS } from '@/lib/pricing/tariffs';

/**
 * GET /api/pricing/tariff?province=江苏
 * 给风电、储能测算页预填电价：只读站内省级电价表（不访问任何外部服务），带「来源待核实」状态与数据截至日期。
 * 不传 province 时返回表里收录的省份列表。
 */
export async function GET(req: NextRequest) {
    const province = req.nextUrl.searchParams.get('province');
    if (!province) {
        return NextResponse.json({
            success: true,
            provinces: Object.values(TARIFFS).map(t => ({ province: t.province, touStatus: t.touStatus })),
        });
    }
    return NextResponse.json({ success: true, data: tariffDefaults(province) }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
