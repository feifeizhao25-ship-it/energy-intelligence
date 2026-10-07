// API: 能源存储系统收益计算
import { NextRequest, NextResponse } from 'next/server';
import { calculateStorage } from '@/lib/calculator/storage';
import { withMembershipCheck } from '@/lib/membership/middleware';
import { prisma } from '@/lib/prisma';
import { safeErrorMessage } from '@/lib/api/safe-error';
import { resolveStoragePrices, PriceInputError } from '@/lib/pricing/tariff-defaults';

export async function POST(req: NextRequest) {
    return withMembershipCheck(
        req,
        { usageType: 'calculation' },
        async (user) => {
            try {
                const input = await req.json();
                // 套利电价：页面填写的峰/平/谷优先，没填的按所选省份的电价表取；不再由页面写死
                let prices: ReturnType<typeof resolveStoragePrices>;
                try {
                    const given = input?.arbitrageConfig ?? {};
                    prices = resolveStoragePrices(input?.location?.province, {
                        peakPrice: given.peakPrice, valleyPrice: given.valleyPrice, flatPrice: given.flatPrice,
                    }, { needsFlat: Boolean(given.chargeTime2) });
                } catch (e) {
                    if (e instanceof PriceInputError) {
                        return NextResponse.json({ error: e.code, message: safeErrorMessage(e, '电价输入不完整，请检查后重试') }, { status: 422 });
                    }
                    throw e;
                }
                input.applicationMode = input.applicationMode || 'arbitrage';
                input.arbitrageConfig = {
                    ...(input.arbitrageConfig ?? {}),
                    peakPrice: prices.peakPrice, valleyPrice: prices.valleyPrice, flatPrice: prices.flatPrice ?? 0, // 平段价只在两充两放时使用
                };
                const result = { ...(await calculateStorage(input)), pricing: prices.pricing };

                try {
                    await prisma.calculation.create({
                        data: {
                            userId: user.id,
                            type: 'STORAGE',
                            input: input,
                            output: result
                        }
                    });
                } catch (dbError) {
                    console.error('Database logging failed:', dbError);
                }

                return NextResponse.json({ success: true, data: result });
            } catch (error) {
                return NextResponse.json(
                    { error: 'CALCULATION_ERROR', message: safeErrorMessage(error, '计算失败') },
                    { status: 500 }
                );
            }
        }
    );
}
