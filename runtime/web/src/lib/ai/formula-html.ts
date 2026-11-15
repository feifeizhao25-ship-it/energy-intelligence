import katex from 'katex';

/** Render one formula. The TeX is a fixed expression, not a price or a measurement. */
export function formulaHtml(tex: string, display = false): string {
    return katex.renderToString(tex, { throwOnError: false, displayMode: display, strict: 'ignore' });
}

export function reportFormula(type?: string | null): { name: string; latex: string } {
    if (type === 'storage') {
        return {
            name: '平准化储能成本',
            latex: 'LCOS = \\frac{I_0 + \\sum_{t=1}^{N} \\frac{OM_t + Ch_t}{(1+r)^t}}{\\sum_{t=1}^{N} \\frac{D_t}{(1+r)^t}}',
        };
    }
    return {
        name: '平准化度电成本',
        latex: 'LCOE = \\frac{I_0 + \\sum_{t=1}^{N} \\frac{M_t}{(1+r)^t}}{\\sum_{t=1}^{N} \\frac{E_t}{(1+r)^t}}',
    };
}
