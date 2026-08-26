import { NextRequest, NextResponse } from 'next/server';
import { generateSummary, extractKeyData, translateText, generateFullTranslation } from '@/lib/papers/ai';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, text, title, context } = body;

        let result;

        switch (action) {
            case 'summary':
                result = await generateSummary(text, title);
                break;
            case 'key_data':
                result = await extractKeyData(text);
                break;
            case 'translate':
                result = await translateText(text);
                break;
            case 'full_translation':
                result = await generateFullTranslation(text);
                break;
            default:
                throw new Error('Invalid action');
        }

        return NextResponse.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Paper AI error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'AI Processing failed' },
            { status: 500 }
        );
    }
}
