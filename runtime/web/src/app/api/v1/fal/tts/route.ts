import { NextRequest, NextResponse } from 'next/server';
import { speechWav, wavBase64 } from '@/lib/voice/speech-wav';
import { saveClip } from '@/lib/voice/tts-clips';

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}));
    const text = String(body?.text || '').trim();
    if (!text) {
        return NextResponse.json({ success: false, error: { code: 'empty', message: '请提供要朗读的文字。' } }, { status: 400 });
    }
    const wav = speechWav(text);
    const id = crypto.randomUUID().replace(/-/g, '');
    saveClip(id, wav);
    const payload = {
        audio_url: `/api/v1/fal/tts/audio/${id}`,
        audio_base64: wavBase64(text),
        content_type: 'audio/wav',
        model_name: 'local-pcm-v1',
        duration_estimate_s: Math.round(Math.max(text.length, 1) * 0.057 * 100) / 100,
        elapsed_s: 0.01,
    };
    return NextResponse.json({ success: true, data: payload, ...payload });
}
