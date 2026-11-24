import { NextRequest, NextResponse } from 'next/server';
import { textFromWav } from '@/lib/voice/speech-wav';

export async function POST(request: NextRequest) {
    const form = await request.formData();
    const hinted = String(form.get('transcript') || '').trim();
    const file = form.get('file');
    let recovered = '';
    if (file instanceof File) {
        recovered = textFromWav(new Uint8Array(await file.arrayBuffer()));
    }
    const text = hinted || recovered;
    if (text) {
        return NextResponse.json({ success: true, text, engine: hinted ? 'client-transcript' : 'embedded-text' });
    }
    return NextResponse.json({
        success: true,
        text: '',
        engine: 'unavailable',
        message: '这段录音没有可识别的文本。请使用浏览器语音输入，或先由本站朗读接口生成音频。',
    });
}
