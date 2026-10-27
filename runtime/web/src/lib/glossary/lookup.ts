import glossary from './terms.json';

export interface GlossaryTerm {
    id: string;
    term: string;
    short: string;
    example: string;
    source: string;
    source_url: string;
    as_of: string;
    review_status: string;
}

const rows = (glossary as { terms: GlossaryTerm[] }).terms;

export function glossaryCount(): number {
    return rows.length;
}

export function findTerm(name: string): GlossaryTerm | undefined {
    return rows.find((item) => item.term === name || item.id === name);
}

export function glossaryReviewStatus(): string {
    return (glossary as { review_status?: string }).review_status || '';
}
