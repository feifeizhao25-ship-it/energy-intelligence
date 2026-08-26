/**
 * 🏰 护城河系统：新能源行业口径库
 * 核心目标：建立类似"会计准则"的行业标准，确保所有计算结果有据可查
 */

export interface StandardDefinition {
    id: string;
    name: string;
    abbr: string;
    definition: string;
    formula?: string;
    unit: string;
    source: string;
    version: string;
}

export const STANDARDS: Record<string, StandardDefinition> = {
    PR: {
        id: 'PR',
        name: '系统性能比',
        abbr: 'Performance Ratio',
        definition: '光伏系统实际发电量与理论发电量的比值，反映系统综合效率。',
        formula: 'PR = E_actual / (H_poa * P_stc / I_stc)',
        unit: '%',
        source: 'IEC 61724-1',
        version: '2024.1'
    },
    IRR: {
        id: 'IRR',
        name: '内部收益率',
        abbr: 'Internal Rate of Return',
        definition: '使项目净现值(NPV)等于零的折现率，反映投资回报水平。',
        formula: 'Σ [CFt / (1+IRR)^t] = 0',
        unit: '%',
        source: '财务管理通用标准',
        version: '1.0'
    },
    NPV: {
        id: 'NPV',
        name: '净现值',
        abbr: 'Net Present Value',
        definition: '投资项目在整个寿命期内各年的净现金流量，按一定的折现率折算到基准年的现值之和。',
        formula: 'NPV = Σ [CFt / (1+r)^t]',
        unit: '元',
        source: '投资评价准则',
        version: '1.0'
    },
    LCOE: {
        id: 'LCOE',
        name: '平准化度电成本',
        abbr: 'Levelized Cost of Electricity',
        definition: '全生命周期内平均每度电的成本，用于评估不同发电技术的竞争力。',
        formula: 'LCOE = Σ [Cost_t / (1+r)^t] / Σ [E_t / (1+r)^t]',
        unit: '元/kWh',
        source: 'IEA/NEA 标准',
        version: '2024'
    },
    PAYBACK: {
        id: 'PAYBACK',
        name: '投资回收期',
        abbr: 'Payback Period',
        definition: '项目投产后，以每年取得的净现金收入补偿原始投资所需要的时间。',
        formula: 'Pt = (累积净现金流量开始出现正值的年份数 - 1) + (上一年累积净现金流量绝对值 / 当年净现金流量)',
        unit: '年',
        source: '财务评价准则',
        version: '1.0'
    },
    GHI: {
        id: 'GHI',
        name: '全球水平辐照度',
        abbr: 'Global Horizontal Irradiance',
        definition: '水平表面上接收到的来自上面的总短波太阳辐射量。',
        unit: 'kWh/m²',
        source: 'WMO 气象标准',
        version: '1.0'
    },
    POA: {
        id: 'POA',
        name: '斜面辐照度',
        abbr: 'Plane of Array Irradiance',
        definition: '落在光伏组件平面上的总太阳辐射，包括直接辐射、散射辐射和地面反射辐射。',
        unit: 'kWh/m²',
        source: 'IEC 61724',
        version: '1.0'
    },
    DEGRADATION: {
        id: 'DEGRADATION',
        name: '逐年衰减率',
        abbr: 'Annual Degradation Rate',
        definition: '由于设备老化等原因导致的发电能力逐年降低的比例。',
        unit: '%/year',
        source: '行业通用标准 (PVEL/NREL)',
        version: '2024'
    }
};

export function getStandard(id: string) {
    return STANDARDS[id];
}
