import { NextResponse } from 'next/server';
import { bookConsultation } from '@/lib/membership/consultation';

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const topic = typeof body?.topic === 'string' ? body.topic : '';
    if (!topic.trim()) return NextResponse.json({ message: '请填写咨询主题' }, { status: 400 });
    return NextResponse.json(bookConsultation(topic));
}
