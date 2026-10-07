import { NextResponse } from 'next/server';
import { calculateWind } from '@/lib/calculator/wind';
import { WindCalculationInput } from '@/types';
import { enforceRateLimit, PUBLIC_RULES } from '@/lib/security/rate-limit';
import { safeErrorMessage } from '@/lib/api/safe-error';
import { resolveWindPrices, PriceInputError } from '@/lib/pricing/tariff-defaults';

export async function POST(req: Request) {
    const limited = await enforceRateLimit(req, PUBLIC_RULES.calculators);
    if (limited) return limited;

    try {
        const body = await req.json();

        // 验证输入
        if (!body.lat || !body.lng || !body.capacity) {
            return NextResponse.json(
                { error: '缺少必要参数 (lat, lng, capacity)' },
                { status: 400 }
            );
        }

        // 电价：用户填写的优先，没填的按省级电价表取（上网电价参考燃煤发电基准价，原来写死 0.4）。
        // 兼容旧参数：全额上网时 electricityPrice 视为上网电价。
        const mode: 'full_export' | 'self_use_export' = body.mode === 'self_use_export' ? 'self_use_export' : 'full_export';
        let prices: ReturnType<typeof resolveWindPrices>;
        try {
            prices = resolveWindPrices(body.province, {
                feedInTariff: body.feedInTariff ?? (mode === 'full_export' ? body.electricityPrice : undefined),
                electricityPrice: body.electricityPrice,
            }, mode);
        } catch (e) {
            if (e instanceof PriceInputError) {
                return NextResponse.json({ error: safeErrorMessage(e, '电价输入不完整，请检查后重试'), code: e.code }, { status: 422 });
            }
            throw e;
        }

        const input: WindCalculationInput = {
            lat: Number(body.lat),
            lng: Number(body.lng),
            projectName: body.projectName || '未命名项目',
            province: prices.pricing.province || '未填写',
            turbine: {
                type: body.turbineType || 'medium_wind',
                capacity: (Number(body.capacity) / (Number(body.turbineCount) || 1)) / 1000, // 单机容量 MW
                count: Number(body.turbineCount) || 1,
                hubHeight: Number(body.hubHeight) || 80,
                rotorDiameter: Number(body.rotorDiameter) || 100,
                cutInSpeed: Number(body.cutInSpeed) || 3,
                ratedSpeed: Number(body.ratedSpeed) || 12,
                cutOutSpeed: Number(body.cutOutSpeed) || 25,
            },
            businessModel: {
                mode,
                feedInTariff: prices.feedInTariff,
                electricityPrice: prices.electricityPrice,
                selfUseRatio: Number(body.selfUseRatio) || 0.8
            },
            investment: {
                unitCost: Number(body.unitCost) || 5500
            },
            operation: {
                operationYears: 20,
                availability: 0.97
            }
        };

        const result = await calculateWind(input);

        return NextResponse.json({ ...result, pricing: prices.pricing });
    } catch (error) {
        console.error('Wind calculation error:', error);
        return NextResponse.json(
            { error: '计算服务出错' },
            { status: 500 }
        );
    }
}
