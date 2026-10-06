// API: 分布式光伏收益计算
import { NextRequest, NextResponse } from 'next/server';
import { calculateSolar, normalizeSelfUseRatio } from '@/lib/calculator/solar';
import { withMembershipCheck } from '@/lib/membership/middleware';
import { prisma } from '@/lib/prisma';
import { safeErrorMessage } from '@/lib/api/safe-error';

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

                // 1. 自用比例统一为 0–1 小数（客户端可能传百分数 80）
                input.selfUseRatio = normalizeSelfUseRatio(input.selfUseRatio, 0.8);

                // 2. 价格补全 (如果用户没填，自动抓取对应省份参考价)
                // 补全失败必须让用户知道——静默跳过会让后续测算基于缺失电价出结果。
                let priceMeta: { source: string; stale: boolean; updatedAt: string } | null = null;
                if (!input.electricityPrice && input.province) {
                    try {
                        const { getLatestPrice, calculateAveragePrice } = await import('@/lib/crawler/price-crawler');
                        const provincePrice = await getLatestPrice(input.province);
                        // electricityPrice 是「自用部分」的电价；自用/上网的加权由 calculateSolar 按 selfUseRatio 再做，
                        // 这里若再按自用比例混合一次，上网部分会被重复折算。
                        input.electricityPrice = calculateAveragePrice(provincePrice, 1);
                        priceMeta = {
                            source: provincePrice.source,
                            stale: provincePrice.stale,
                            updatedAt: provincePrice.updatedAt,
                        };
                    } catch {
                        console.warn('Price auto-fill failed');
                        return NextResponse.json(
                            {
                                error: 'ELECTRICITY_PRICE_UNAVAILABLE',
                                message: `暂无「${input.province}」的电价数据，请手动填写电价后重新测算。`,
                            },
                            { status: 422 }
                        );
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
                        version: '2.0.0-prod',
                        // 电价来源与时效，前端应在结果页标注（尤其 stale=true 时）
                        electricityPrice: priceMeta,
                    }
                });
            } catch (error: any) {
                console.error('Solar calculation error details:', error, { input });
                return NextResponse.json(
                    {
                        error: 'CALCULATION_ERROR',
                        message: safeErrorMessage(error, '计算失败'),
                    },
                    { status: 500 }
                );
            }
        }
    );
}
