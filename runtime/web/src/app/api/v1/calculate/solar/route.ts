/**
 * 🏰 护城河系统：开放计算接口 (v1)
 * 允许第三方 Agent 获取受审计的专业新能源计算结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkApiKey, logApiCall } from '@/lib/api/middleware';
import { calculationEngine, CalcType } from '@/lib/calculation/auditable-engine';
import { safeErrorMessage } from '@/lib/api/safe-error';

export async function POST(req: NextRequest) {
    const start = Date.now();

    // 1. 鉴权
    const auth = await checkApiKey(req);
    if (!auth.valid) {
        return NextResponse.json({ error: 'API 密钥无效或缺失' }, { status: 401 });
    }

    try {
        const body = await req.json();

        // 2. 调用核心可审计引擎
        const result = await calculationEngine.execute({
            type: CalcType.SOLAR_REVENUE,
            params: body,
            userId: auth.userId!
        });

        // 3. 构建响应（包含审计链接）
        const response = {
            success: true,
            data: result.conclusion,
            auditUrl: `https://solarwind.pro/audit/${result.snapshotId}`, // 护城河核心：强制输出审计链接
            snapshotId: result.snapshotId
        };

        // 4. 记录日志
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
        return NextResponse.json({ error: safeErrorMessage(error, '测算失败，请稍后重试') }, { status: 500 });
    }
}
