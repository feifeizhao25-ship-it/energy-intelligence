/**
 * 开放计算接口 (v1)：第三方调用光伏测算，返回真实计算结果与审计快照。
 * 输出只做事实描述，不给投资结论。
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkApiKey, logApiCall } from '@/lib/api/middleware';
import { createCalculationEngine, CalcType } from '@/lib/calculation/auditable-engine';
import { calculateSolar } from '@/lib/calculator/solar';
import { safeErrorMessage } from '@/lib/api/safe-error';
import { BOTTOM_LINE_NOTICE_ZH } from '@/lib/compliance/bottom-line';
import { parseV1SolarInput, describeSolarOutput, auditUrlFor, V1InputError } from '@/lib/calculation/v1-solar';
import type { SolarCalculationInput, SolarCalculationOutput } from '@/types';

export async function POST(req: NextRequest) {
    const start = Date.now();

    const auth = await checkApiKey(req);
    if (!auth.valid) {
        return NextResponse.json({ error: 'API 密钥无效或缺失' }, { status: 401 });
    }

    let body: any;
    let input: SolarCalculationInput;
    try {
        body = await req.json();
        input = parseV1SolarInput(body);
    } catch (error) {
        const msg = error instanceof V1InputError ? error.zh : '请求体不是合法 JSON';
        return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    try {
        const result = await createCalculationEngine().execute({
            type: CalcType.SOLAR_REVENUE,
            params: input as unknown as Record<string, any>,
            userId: auth.userId!,
            compute: () => calculateSolar(input) as Promise<any>,
            describe: (o) => describeSolarOutput(o as SolarCalculationOutput),
            method: '逐月辐照 × 损耗链（lib/calculator/solar.ts）；IRR/NPV/LCOE 按 8% 折现率',
        });

        const response = {
            success: true,
            data: result.output,
            conclusion: result.conclusion,
            versions: result.versions,
            disclaimer: BOTTOM_LINE_NOTICE_ZH,
            auditUrl: auditUrlFor(result.auditPath),
            snapshotId: result.snapshotId,
        };

        await logApiCall({
            userId: auth.userId!,
            apiKeyId: auth.keyId,
            endpoint: '/api/v1/calculate/solar',
            method: 'POST',
            input: body,
            output: response,
            duration: Date.now() - start,
            status: 200
        });

        return NextResponse.json(response);
    } catch (error: any) {
        console.error('[v1/calculate/solar] 测算失败：', error);
        return NextResponse.json({ success: false, error: safeErrorMessage(error, '测算失败，请稍后重试') }, { status: 500 });
    }
}
