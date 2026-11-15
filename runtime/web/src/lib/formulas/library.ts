import formulas from './formulas.json';

export interface FormulaEntry {
    id: string;
    name: string;
    latex: string;
    variables: { symbol: string; meaning: string; unit: string }[];
    source: string;
    review_status: string;
}

export function formulaLibrary(): FormulaEntry[] {
    return (formulas as { items: FormulaEntry[] }).items;
}

export function formulaById(id: string): FormulaEntry | undefined {
    return formulaLibrary().find((item) => item.id === id);
}
