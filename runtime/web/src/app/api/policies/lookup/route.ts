import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Source = {
    source_id?: string;
    title?: string;
    doc_number?: string;
    status?: string;
    issuer?: string;
    effective_date?: string;
    expiry_date?: string;
    source_url?: string;
    superseded_by?: string | null;
    evidence_status?: string;
};

function load(): Source[] {
    const path = join(process.cwd(), '..', 'backend', 'data', 'rag_sources.json');
    const data = JSON.parse(readFileSync(path, 'utf8')) as { sources?: Source[] };
    return data.sources || [];
}

export async function GET(request: NextRequest) {
    const query = (request.nextUrl.searchParams.get('q') || '').trim();
    if (!query) return NextResponse.json({ items: [] });
    const folded = query.replace(/\s/g, '');
    const items = load()
        .filter((item) => {
            const blob = `${item.title || ''}${item.doc_number || ''}${item.source_id || ''}`.replace(/\s/g, '');
            return blob.includes(folded);
        })
        .slice(0, 8)
        .map((item) => ({
            id: item.source_id,
            title: item.title,
            docNumber: item.doc_number,
            issuer: item.issuer,
            effectiveDate: item.effective_date,
            expiryDate: item.expiry_date,
            url: item.source_url,
            status: item.status === '失效' ? '已失效' : (item.status || '待审核'),
            review: item.evidence_status === 'expert_signed' ? '已审核' : '待审核',
            supersededBy: item.superseded_by,
        }));
    return NextResponse.json({ items });
}
