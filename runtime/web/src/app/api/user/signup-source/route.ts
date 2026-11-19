// API: 注册来源题「从哪知道我们」的选项。开关关闭或国际版时 enabled=false、options 为空。不读任何用户信息。
import { NextResponse } from 'next/server';
import { publicSignupSourceOptions } from '@/lib/growth/signup-source';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json(publicSignupSourceOptions(), { headers: { 'Cache-Control': 'no-store' } });
}
