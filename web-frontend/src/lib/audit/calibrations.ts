// 新能源口径库
// 护城河第二层：专业正确性（Domain Correctness）
// 建立行业术语/指标定义的"会计准则"

import type { CalibrationStandard } from './types';

/**
 * 新能源行业标准口径定义
 * 每个输出都引用口径，确保专业正确性
 */
export const CALIBRATIONS: Record<string, CalibrationStandard> = {
    // ========== 光伏核心指标 ==========
    PR: {
        id: 'PR',
        name: '系统效率 / 性能比',
        abbr: 'PR',
        definition: '光伏系统实际发电量与理论发电量的比值，反映系统整体效率',
        formula: 'PR = E_{actual} / (GHI × P_{rated} × η_{STC}) × 100%',
        unit: '%',
        reference: 'IEC 61724-1:2021',
        industryNote: '国内电站设计PR通常取75%-85%，实际运行PR低于75%需排查',
        version: '2024.1',
    },

    GHI: {
        id: 'GHI',
        name: '水平面总辐照量',
        abbr: 'GHI',
        definition: '单位面积水平面接收的太阳总辐射能量',
        formula: 'GHI = DNI × cos(θ_z) + DHI',
        unit: 'kWh/m²',
        reference: 'ISO 9060:2018',
        industryNote: '中国I类资源区GHI年值>1750kWh/m²',
        version: '2024.1',
    },

    LCOE: {
        id: 'LCOE',
        name: '平准化度电成本',
        abbr: 'LCOE',
        definition: '项目全生命周期发电成本的平均值，考虑资金时间价值',
        formula: 'LCOE = Σ(CAPEX + OPEX_t) / Σ(E_t × (1+r)^{-t})',
        unit: '元/kWh',
        reference: 'NREL/IEA LCOE计算方法',
        industryNote: '2024年光伏LCOE参考值0.15-0.25元/kWh',
        version: '2024.1',
    },

    IRR: {
        id: 'IRR',
        name: '内部收益率',
        abbr: 'IRR',
        definition: '使项目净现值为零的折现率，反映项目投资回报水平',
        formula: 'NPV = Σ(CF_t / (1+IRR)^t) = 0',
        unit: '%',
        reference: 'GB/T 12497-2006',
        industryNote: '新能源项目资本金IRR>8%通常认为可行',
        version: '2024.1',
    },

    NPV: {
        id: 'NPV',
        name: '净现值',
        abbr: 'NPV',
        definition: '项目全生命周期现金流按折现率折算后的总和',
        formula: 'NPV = Σ(CF_t × (1+r)^{-t}) - C_0',
        unit: '万元',
        reference: 'GB/T 12497-2006',
        industryNote: 'NPV>0表示项目可行',
        version: '2024.1',
    },

    PAYBACK: {
        id: 'PAYBACK',
        name: '投资回收期',
        abbr: '回收期',
        definition: '累计净现金流由负转正所需的时间',
        formula: 'Payback = n + |累计净现金流_n| / 净现金流_{n+1}',
        unit: '年',
        reference: 'GB/T 12497-2006',
        industryNote: '光伏项目回收期通常4-8年',
        version: '2024.1',
    },

    CAPEX: {
        id: 'CAPEX',
        name: '资本性支出',
        abbr: 'CAPEX',
        definition: '项目建设期的一次性投资，包括设备、安装、并网等',
        formula: 'CAPEX = 设备费 + 建安费 + 其他费用 + 预备费',
        unit: '元/Wp 或 万元',
        reference: '新能源项目可研编制规范',
        industryNote: '2024年集中式光伏CAPEX约3.0-3.5元/Wp',
        version: '2024.1',
    },

    OPEX: {
        id: 'OPEX',
        name: '运营支出',
        abbr: 'OPEX',
        definition: '项目运营期的年度费用，包括运维、保险、土地等',
        formula: 'OPEX = 运维费 + 保险费 + 土地租金 + 其他',
        unit: '元/kW/年',
        reference: '新能源项目可研编制规范',
        industryNote: '光伏年运维费约15-25元/kW',
        version: '2024.1',
    },

    DEGRADATION: {
        id: 'DEGRADATION',
        name: '年衰减率',
        abbr: '衰减率',
        definition: '光伏组件每年输出功率下降的比例',
        formula: 'P_n = P_0 × (1 - d)^n',
        unit: '%/年',
        reference: 'IEC 61215-2:2021',
        industryNote: '单晶组件首年衰减2%，后续每年0.5%',
        version: '2024.1',
    },

    EQUIVALENT_HOURS: {
        id: 'EQUIVALENT_HOURS',
        name: '等效利用小时数',
        abbr: '利用小时',
        definition: '年发电量与装机容量的比值，反映资源利用效率',
        formula: 'H_{eq} = E_{annual} / P_{rated}',
        unit: '小时/年',
        reference: 'NEA统计口径',
        industryNote: 'I类资源区>1500h，II类>1300h，III类>1100h',
        version: '2024.1',
    },

    // ========== 风电核心指标 ==========
    CAPACITY_FACTOR: {
        id: 'CAPACITY_FACTOR',
        name: '容量因子',
        abbr: 'CF',
        definition: '实际发电量与理论最大发电量的比值',
        formula: 'CF = E_{actual} / (P_{rated} × 8760) × 100%',
        unit: '%',
        reference: 'IEC 61400-26',
        industryNote: '陆上风电CF通常20%-35%',
        version: '2024.1',
    },

    WPD: {
        id: 'WPD',
        name: '风功率密度',
        abbr: 'WPD',
        definition: '单位扫风面积可获得的风能功率',
        formula: 'WPD = 0.5 × ρ × v³',
        unit: 'W/m²',
        reference: 'IEC 61400-12',
        industryNote: 'WPD>400W/m²为优质风资源',
        version: '2024.1',
    },

    // ========== 储能核心指标 ==========
    DOD: {
        id: 'DOD',
        name: '放电深度',
        abbr: 'DoD',
        definition: '电池放电容量与额定容量的比值',
        formula: 'DoD = Q_{discharge} / Q_{rated} × 100%',
        unit: '%',
        reference: 'IEC 62620',
        industryNote: '锂电池通常DoD≤90%以延长寿命',
        version: '2024.1',
    },

    SOC: {
        id: 'SOC',
        name: '荷电状态',
        abbr: 'SoC',
        definition: '电池当前剩余电量与额定容量的比值',
        formula: 'SoC = Q_{remain} / Q_{rated} × 100%',
        unit: '%',
        reference: 'IEC 62620',
        industryNote: '建议运行区间10%-90%',
        version: '2024.1',
    },

    SOH: {
        id: 'SOH',
        name: '健康状态',
        abbr: 'SoH',
        definition: '电池当前最大可用容量与初始容量的比值',
        formula: 'SoH = Q_{current_max} / Q_{initial} × 100%',
        unit: '%',
        reference: 'IEC 62620',
        industryNote: 'SoH<80%通常认为电池需更换',
        version: '2024.1',
    },

    ROUND_TRIP_EFFICIENCY: {
        id: 'ROUND_TRIP_EFFICIENCY',
        name: '循环效率',
        abbr: 'RTE',
        definition: '储能系统放电电量与充电电量的比值',
        formula: 'RTE = E_{discharge} / E_{charge} × 100%',
        unit: '%',
        reference: 'IEC 62933',
        industryNote: '锂电池RTE通常85%-92%',
        version: '2024.1',
    },
};

/**
 * 获取口径定义
 */
export function getCalibration(id: string): CalibrationStandard | undefined {
    return CALIBRATIONS[id];
}

/**
 * 获取多个口径定义
 */
export function getCalibrations(ids: string[]): CalibrationStandard[] {
    return ids.map(id => CALIBRATIONS[id]).filter(Boolean);
}

/**
 * 生成口径引用文本
 */
export function formatCalibrationRef(calibration: CalibrationStandard): string {
    return `${calibration.name}(${calibration.abbr}): ${calibration.definition} [${calibration.reference}]`;
}

/**
 * 口径版本号
 */
export const CALIBRATION_VERSION = '2024.1';
