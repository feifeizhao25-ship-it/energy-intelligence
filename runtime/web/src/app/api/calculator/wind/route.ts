// API: 分散式风电收益计算
import { NextRequest, NextResponse } from 'next/server';
import { calculateWind } from '@/lib/calculator/wind';
import { withMembershipCheck } from '@/lib/membership/middleware';
import { prisma } from '@/lib/prisma';
import { safeErrorMessage } from '@/lib/api/safe-error';
import { resolveWindPrices, PriceInputError } from '@/lib/pricing/tariff-defaults';

export async function POST(req: NextRequest) {
    return withMembershipCheck(
        req,
        { feature: 'wind_calculation', usageType: 'calculation' },
        async (user) => {
            try {
                const input = await req.json();
                // 电价：页面填写的优先，没填的按所选省份的电价表取（上网电价参考燃煤发电基准价）；引擎不再默认 0.4 / 0.6
                const businessModel = input?.businessModel ?? {};
                const mode = businessModel.mode === 'self_use_export' ? 'self_use_export' : 'full_export';
                let prices: ReturnType<typeof resolveWindPrices>;
                try {
                    prices = resolveWindPrices(input?.province, {
                        feedInTariff: businessModel.feedInTariff, electricityPrice: businessModel.electricityPrice,
                    }, mode);
                } catch (e) {
                    if (e instanceof PriceInputError) {
                        return NextResponse.json({ error: e.code, message: safeErrorMessage(e, '电价输入不完整，请检查后重试') }, { status: 422 });
                    }
                    throw e;
                }
                input.businessModel = { ...businessModel, mode, feedInTariff: prices.feedInTariff, electricityPrice: prices.electricityPrice };
                const result = { ...(await calculateWind(input)), pricing: prices.pricing };

                let calculationId: string | undefined;
                try {
                    const saved = await prisma.calculation.create({
                        data: {
                            userId: user.id,
                            type: 'WIND',
                            input: input,
                            output: result
                        }
                    });
                    calculationId = saved.id;
                } catch (dbError) {
                    console.error('Database logging failed:', dbError);
                }

                return NextResponse.json({ success: true, data: { ...result, calculationId } });
            } catch (error) {
                return NextResponse.json(
                    { error: 'CALCULATION_ERROR', message: safeErrorMessage(error, '计算失败') },
                    { status: 500 }
                );
            }
        }
    );
}
