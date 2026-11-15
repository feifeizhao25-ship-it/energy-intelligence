/**
 * 运维算法的可复核计算。只使用调用方给出的实测或遥测，不访问境外气象，也不调用模型。
 * 输出是比值和偏差，不是投资结论。
 */

export interface PrInput {
  actualKwh: number;
  theoreticalKwh: number;
}

export interface PrResult {
  performanceRatio: number | null;
  formula: string;
  note: string;
}

export function computePerformanceRatio(input: PrInput): PrResult {
  const formula = 'PR = 实际发电量 / 理论发电量';
  if (!(input.theoreticalKwh > 0) || !(input.actualKwh >= 0) || !Number.isFinite(input.actualKwh)) {
    return { performanceRatio: null, formula, note: '理论发电量必须大于 0，实际发电量必须是非负数字。未给出性能比。' };
  }
  const performanceRatio = input.actualKwh / input.theoreticalKwh;
  return {
    performanceRatio: Math.round(performanceRatio * 10000) / 10000,
    formula,
    note: '性能比只描述这段实测相对所给理论发电量的比值。',
  };
}

export interface IvInput {
  vocNom: number; iscNom: number; vmpNom: number; impNom: number;
  vocMeas: number; iscMeas: number; vmpMeas: number; impMeas: number;
  irradiance: number; temperature: number;
}

export function analyzeIvCurveLocal(input: IvInput) {
  const nominalOk = input.vocNom > 0 && input.iscNom > 0 && input.vmpNom > 0 && input.impNom > 0;
  const measuredOk = input.vocMeas > 0 && input.iscMeas > 0 && input.vmpMeas > 0 && input.impMeas > 0;
  if (!nominalOk || !measuredOk || !(input.irradiance > 0)) {
    return { fillFactorNominal: null, fillFactorMeasured: null, note: '额定与实测的开路电压、短路电流、最大功率点都必须大于 0，且辐照度大于 0。' };
  }
  const fillFactorNominal = (input.vmpNom * input.impNom) / (input.vocNom * input.iscNom);
  const fillFactorMeasured = (input.vmpMeas * input.impMeas) / (input.vocMeas * input.iscMeas);
  const iscRatio = input.iscMeas / input.iscNom;
  const vocRatio = input.vocMeas / input.vocNom;
  const notes = [
    `填充因子：额定 ${fillFactorNominal.toFixed(3)}，实测 ${fillFactorMeasured.toFixed(3)}。`,
    `短路电流比 ${iscRatio.toFixed(3)}，开路电压比 ${vocRatio.toFixed(3)}。测试辐照 ${input.irradiance} W/m²，温度 ${input.temperature} °C。`,
    '偏差需要对照组件规格书和当时的辐照、温度。这里不判断是否应当更换设备。',
  ];
  return {
    fillFactorNominal: round4(fillFactorNominal),
    fillFactorMeasured: round4(fillFactorMeasured),
    iscRatio: round4(iscRatio),
    vocRatio: round4(vocRatio),
    note: notes.join(''),
  };
}

/** 公开故障码只作对照提示，完整含义以厂商手册为准。 */
const INVERTER_CODES: Record<string, string> = {
  '2001': '部分华为机型将 2001 标为电网电压超限。请以该机型手册为准，先确认电网电压测量值。',
  '2011': '部分阳光电源机型将电网频率异常标为相近代码。请以铭牌机型的手册代码表为准。',
};

export function describeInverterCode(code: string, symptoms: string) {
  const key = code.trim();
  const known = INVERTER_CODES[key];
  return {
    code: key || null,
    handbookHint: known || (key ? `代码 ${key} 没有收录在本地对照表。请查阅该品牌该型号的官方手册，不要把未收录代码当成已确认故障。` : '未提供故障代码。'),
    symptoms: symptoms.trim(),
    note: '本页只复述对照表和用户填写的现象，不生成维修投资建议。',
  };
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000;
}
