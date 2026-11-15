import { NextResponse } from 'next/server';
import { demoCohorts } from '@/lib/policy/demo-library';

/** 线上聚合统计未连接。只返回标明示例、且人数不少于 20 的分组。 */
export async function GET() {
    const body = demoCohorts();
    return NextResponse.json({ success: true, ...body });
}
