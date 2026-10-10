import { redirect } from 'next/navigation';

/**
 * 旧的「快速测算结果」页：发电量按 1250 小时、IRR 用「+15」凑数，风电 IRR 写死 15.2%、储能 23.5%，
 * 还写着「是银行理财的 6 倍」「村民人均增收 ¥2,800/年」「月均被动收入」等没有依据的说法。
 * 这些数字不是测算结果，已删除；旧链接转到对应的真实测算页。
 */
export default async function LegacyQuickCalcResult({ params }: { params: Promise<{ type: string }> }) {
    const { type } = await params;
    redirect(['solar', 'wind', 'storage'].includes(type) ? `/calculator/${type}` : '/calculator');
}
