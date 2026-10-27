import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const path = join(process.cwd(), '..', 'backend', 'data', 'province_profiles.json');
        const payload = JSON.parse(readFileSync(path, 'utf8')) as {
            label?: string;
            note?: string;
            provinces?: unknown[];
        };
        return NextResponse.json({
            success: true,
            label: payload.label || '待核实',
            note: payload.note || '',
            provinces: payload.provinces || [],
        });
    } catch {
        return NextResponse.json({ success: false, label: '待核实', note: '省级档案文件未读到', provinces: [] }, { status: 503 });
    }
}
