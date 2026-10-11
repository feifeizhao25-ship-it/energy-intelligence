/**
 * PDF 测算报告的文字规则（与 components/calculator/InvestmentReport.tsx 分开，便于测试）。
 * - 结论随 IRR 与回收期变化，不再无条件写「具有较强的财务可行性……建议尽快推动立项开发」；
 * - 一律附「测算结果仅供参考，不构成投资建议」；
 * - 缺省值显式写「未填写」，不再兜底成「苏州」或 300 万元；
 * - 编号可追溯：项目/记录 id + 测算日期，不再是随机数。
 */

export const REPORT_TITLE = '测算报告';
export const REPORT_DISCLAIMER = '测算结果仅供参考，不构成投资建议。';
export const NOT_FILLED = '未填写';
/** 常用的全投资收益率比较基准，仅用于结论措辞 */
export const IRR_BENCHMARK = 8;
export const IRR_LOW = 6;

/** 自托管字体（@fontsource/noto-sans-sc 5.3.0 的简体中文子集，SIL OFL 1.1） */
export const PDF_FONT_FILES = {
    regular: '/fonts/noto-sans-sc/noto-sans-sc-chinese-simplified-400-normal.woff',
    bold: '/fonts/noto-sans-sc/noto-sans-sc-chinese-simplified-700-normal.woff',
} as const;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function reportConclusion(irr: number | null | undefined, paybackYears: number | null | undefined, lifetimeYears = 25): string {
    const payback = finite(paybackYears) && paybackYears < lifetimeYears
        ? `静态回收期约 ${paybackYears.toFixed(1)} 年`
        : `${lifetimeYears} 年估算期内未回本`;
    let body: string;
    if (!finite(irr)) {
        body = `按当前假设无法确认唯一的内部收益率（IRR），${payback}，建议复核电价、造价与发电量假设。`;
    } else if (irr < IRR_LOW) {
        body = `按当前假设收益偏低：IRR ${irr.toFixed(2)}%，${payback}，建议复核电价与造价。`;
    } else if (irr < IRR_BENCHMARK) {
        body = `按当前假设 IRR ${irr.toFixed(2)}%，低于常用的 ${IRR_BENCHMARK}% 比较基准，${payback}，建议结合融资成本与电价变化审慎评估。`;
    } else {
        body = `按当前假设 IRR ${irr.toFixed(2)}%，高于常用的 ${IRR_BENCHMARK}% 比较基准，${payback}。是否开展前期工作，须结合现场勘察、并网条件与最新电价政策确认。`;
    }
    return `${body}${REPORT_DISCLAIMER}`;
}

/** 简单稳定的 32 位 FNV-1a 哈希，用于没有记录 id 时生成可复现的编号 */
function fnv1a(text: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).toUpperCase().padStart(8, '0');
}

function yyyymmdd(date: Date): string {
    // 按北京时间取日期
    const local = new Date(date.getTime() + 8 * 3600_000);
    return local.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * 报告编号：CR-<项目/记录 id>-<测算日期>。
 * 没有保存记录时，用结果内容的哈希（同一结果同一天编号相同），并标 U 表示未保存。
 */
export function reportNumber(data: any, date: Date = new Date()): string {
    const meta = data?.metadata ?? {};
    const id = meta.projectId ?? meta.calculationId ?? meta.snapshotId;
    const key = id
        ? String(id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24)
        : `U${fnv1a(JSON.stringify({ e: data?.energy?.year1, f: data?.financial?.investment, i: data?.financial?.irr, p: meta.province }))}`;
    return `CR-${key}-${yyyymmdd(date)}`;
}

/** 衰减描述直接取测算引擎返回的 assumptions，与 degradationFactor 一致 */
export function degradationText(assumptions?: { firstYearDegradation?: number; annualDegradation?: number } | null): string {
    if (!assumptions || !finite(assumptions.firstYearDegradation) || !finite(assumptions.annualDegradation)) {
        return '衰减假设：本次测算未返回逐项假设';
    }
    return `衰减：首年按模型发电量计；第 2 年起较首年下降 ${assumptions.firstYearDegradation}%，此后每年再下降 ${assumptions.annualDegradation}%`;
}

export function displayOrNotFilled(value: unknown): string {
    if (value === undefined || value === null) return NOT_FILLED;
    const text = String(value).trim();
    return text ? text : NOT_FILLED;
}

/**
 * 报告用到的数字统一从这里取（PDF 与 Word 两种导出共用，避免两份报告各算各的）。
 * 光伏/风电结果是 financial.irr 等；储能结果在 financial.metrics 里。缺失一律为 null，不兜底。
 */
export function extractReportFigures(data: any) {
    const financial = data?.financial ?? {};
    const energy = data?.energy ?? {};
    const assumptions = data?.assumptions ?? null;
    const pick = (...values: unknown[]): number | null => {
        for (const v of values) if (finite(v)) return v;
        return null;
    };
    const cashFlow: number[] | null = Array.isArray(financial.cashFlow) ? financial.cashFlow : null;
    return {
        irr: pick(financial.irr, financial.metrics?.irr),
        payback: pick(financial.paybackYears, financial.metrics?.paybackYears),
        lcoe: pick(financial.lcoe, financial.metrics?.lcos),
        // 投资额：没有就写「未填写」，不再按 300 万元兜底
        investment: pick(financial.investment, financial.investment?.total),
        lifetime: (finite(assumptions?.lifetimeYears) ? assumptions.lifetimeYears : 25) as number,
        cashFlow,
        revenue: Array.isArray(financial.revenue) ? (financial.revenue as number[]) : null,
        discountRate: pick(assumptions?.discountRate, financial.discountRate),
        assumptions,
        energy: {
            year1: pick(energy.year1),
            lifetime: pick(energy.lifetime),
            equivalentHours: pick(energy.equivalentHours, energy.specificYield),
            pr: pick(energy.pr),
            monthly: Array.isArray(energy.monthly) ? (energy.monthly as unknown[]).slice(0, 12).map(v => (finite(v) ? v : null)) : null,
        },
        capacity: data?.metadata?.capacity ?? null,
        projectName: data?.metadata?.projectName ?? null,
        province: data?.metadata?.province ?? null,
        /** 光伏快速测算放在 metadata.pricing，风电/储能接口直接返回 pricing */
        pricing: data?.metadata?.pricing ?? data?.pricing ?? null,
    };
}

/** 光伏装机按组件峰值功率 kWp，风电、储能按额定功率 kW */
export function capacityUnitOf(type: string): string {
    return type === 'solar' ? 'kWp' : 'kW';
}

export function typeLabelOf(type: string): string {
    return type === 'solar' ? '分布式光伏' : type === 'wind' ? '分散式风电' : '工商业储能';
}
