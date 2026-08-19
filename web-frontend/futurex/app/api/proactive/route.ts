import { NextResponse } from 'next/server';
import {
    generateWellnessCareMessage,
    generateEnergyCareMessage,
    generateContentCareMessage
} from '@/lib/agents/formatters';

export async function GET() {
    const wellness = generateWellnessCareMessage();
    const energy = generateEnergyCareMessage();
    const content = generateContentCareMessage();

    // Return proactive notifications based on time and priority
    const all = [wellness, energy, content];

    return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        notifications: all.map(n => ({
            ...n,
            id: Math.random().toString(36).substring(7),
        }))
    });
}
