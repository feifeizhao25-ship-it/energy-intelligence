// OpenClaw Skill API 端点
// 护城河：把OpenClaw变成分发渠道

import { NextRequest, NextResponse } from 'next/server';
import { handleOpenClawRequest, XINNENGYUAN_SKILL } from '@/lib/audit/openclaw-skill';

/**
 * GET /api/v1/openclaw
 * 返回 skill 定义（供 OpenClaw 发现）
 */
export async function GET() {
    return NextResponse.json({
        skill: XINNENGYUAN_SKILL,
        endpoints: {
            manifest: '/api/v1/openclaw',
            execute: '/api/v1/openclaw',
        },
        docs: 'https://xinnengyuan.ai/docs/openclaw',
    });
}

/**
 * POST /api/v1/openclaw
 * 执行能力调用
 */
export async function POST(request: NextRequest) {
    try {
        // 验证 API Key
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Missing or invalid Authorization header' },
                { status: 401 }
            );
        }
        const apiKey = authHeader.slice(7);

        // 获取请求体
        const body = await request.json();
        const { capability, input } = body;

        if (!capability) {
            return NextResponse.json(
                { error: 'Missing capability parameter' },
                { status: 400 }
            );
        }

        // 验证能力是否存在
        const validCapabilities = XINNENGYUAN_SKILL.capabilities.map(c => c.id);
        if (!validCapabilities.includes(capability)) {
            return NextResponse.json(
                {
                    error: `Unknown capability: ${capability}`,
                    available: validCapabilities,
                },
                { status: 400 }
            );
        }

        // 执行请求
        const result = await handleOpenClawRequest(capability, input || {}, apiKey);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: result.error,
                    quotaRemaining: result.quotaRemaining,
                },
                { status: result.error?.includes('额度') ? 429 : 400 }
            );
        }

        return NextResponse.json({
            success: true,
            data: result.data,
            quotaRemaining: result.quotaRemaining,
            poweredBy: 'XinNengYuan AI',
            upgradeUrl: 'https://xinnengyuan.ai/pricing',
        });

    } catch (error) {
        console.error('OpenClaw API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
