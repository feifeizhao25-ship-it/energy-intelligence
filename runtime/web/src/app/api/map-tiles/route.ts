import { NextResponse } from 'next/server';
import { mapTileStatus } from '@/lib/map/tiles';

export async function GET() {
    const status = mapTileStatus();
    return NextResponse.json(status);
}
