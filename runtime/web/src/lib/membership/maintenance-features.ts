import type { FeatureKey } from './middleware';

/** 运维动作 -> 会员功能权限（plans.ts FEATURE_ACCESS 里的键）。未列出的动作只受「每日诊断次数」约束。 */
export const MAINTENANCE_FEATURE: Record<string, FeatureKey | undefined> = {
  fault: 'inverter_diagnosis',
  cleaning: 'cleaning_decision',
  strings: 'string_analysis',
  'iv-curve': 'iv_curve_analysis',
  'work-permit': 'work_permit',
  predictive: 'predictive_maintenance',
  'downtime-loss': 'downtime_loss',
  vibration: 'wind_fault_diagnosis',
  blade_drone: 'wind_fault_diagnosis',
};
