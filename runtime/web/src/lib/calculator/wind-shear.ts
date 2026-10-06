/**
 * 风切变外推（对数律）：v(h) = v_ref × ln(h / z0) / ln(h_ref / z0)
 * z0 为地表粗糙度（m），缺省 0.03（开阔平地/低矮草地）。
 * 资源数据（nasa-power）与风电测算（wind.ts）共用这一个函数，避免两处用不同的切变律。
 */
export const DEFAULT_ROUGHNESS_M = 0.03;

export function extrapolateWindSpeed(vRef: number, hRef: number, hTarget: number, z0: number = DEFAULT_ROUGHNESS_M): number {
  if (!(vRef > 0) || !(hRef > z0) || !(hTarget > z0)) return 0;
  return vRef * (Math.log(hTarget / z0) / Math.log(hRef / z0));
}
