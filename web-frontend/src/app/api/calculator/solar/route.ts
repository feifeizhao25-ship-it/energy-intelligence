// API: 分布式光伏收益计算
import { NextRequest, NextResponse } from 'next/server';
import { calculateSolar } from '@/lib/calculator/solar';
import { withMembershipCheck } from '@/lib/membership/middleware';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    return withMembershipCheck(
        req,
        {
            usageType: 'calculation',
        },
        async (user) => {
            let input: any;
            try {
                try {
                    input = await req.json();
                } catch (e) {
                    return NextResponse.json({ error: 'INVALID_JSON', message: '无效的 JSON 数据' }, { status: 400 });
                }

                // 验证输入
                if (!input.lat || !input.lng || !input.capacity) {
                    return NextResponse.json(
                        { error: 'INVALID_INPUT', message: '缺少必要参数' },
                        { status: 400 }
                    );
                }

                // 2. 价格补全 (如果用户没填，自动抓取对应省份参考价)
                if (!input.electricityPrice && input.province) {
                    try {
                        const { getLatestPrice, calculateAveragePrice } = await import('@/lib/crawler/price-crawler');
                        const provincePrice = await getLatestPrice(input.province);
                        input.electricityPrice = calculateAveragePrice(provincePrice, input.selfUseRatio || 0.8);
                        console.log(`[CRAWLER] Auto-filled price for ${input.province}: ${input.electricityPrice}`);
                    } catch (pError) {
                        console.warn('Price auto-fill failed:', pError);
                    }
                }

                // 执行计算
                const result = await calculateSolar(input);

                // 保存计算记录到数据库
                try {
                    await prisma.calculation.create({
                        data: {
                            userId: user.id,
                            type: 'SOLAR',
                            input: input,
                            output: result as any
                        }
                    });
                } catch (dbError) {
                    console.error('Database logging failed:', dbError);
                }

                return NextResponse.json({
                    success: true,
                    data: result,
                    metadata: {
                        timestamp: new Date().toISOString(),
                        version: '2.0.0-prod'
                    }
                });
            } catch (error: any) {
                console.error('Solar calculation error details:', {
                    message: error.message,
                    stack: error.stack,
                    input: input
                });
                return NextResponse.json(
                    {
                        error: 'CALCULATION_ERROR',
                        message: error instanceof Error ? error.message : '计算失败',
                    },
                    { status: 500 }
                );
            }
        }
    );
}
