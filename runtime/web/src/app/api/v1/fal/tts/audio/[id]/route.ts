import { NextResponse } from 'next/server';
import { readClip } from '@/lib/voice/tts-clips';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const wav = readClip(id);
    if (!wav) return new NextResponse(null, { status: 404, headers: { 'Content-Type': 'audio/wav' } });
    return new NextResponse(Buffer.from(wav), { headers: { 'Content-Type': 'audio/wav' } });
}
