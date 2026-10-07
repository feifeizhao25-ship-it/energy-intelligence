import { NextResponse } from 'next/server';
import { calculateStorage } from '@/lib/calculator/storage';
import { StorageCalculationInput } from '@/types';
import { enforceRateLimit, PUBLIC_RULES } from '@/lib/security/rate-limit';
import { safeErrorMessage } from '@/lib/api/safe-error';
import { resolveStoragePrices, PriceInputError } from '@/lib/pricing/tariff-defaults';

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

        // 套利电价：用户填写的峰/平/谷优先，没填的按省级电价表取（原来写死峰 1.0、谷 0.3、平 0.6）
        let prices: ReturnType<typeof resolveStoragePrices>;
        try {
            // 本接口按每天一次「谷充峰放」计算，不需要平段价
            prices = resolveStoragePrices(body.province, { peakPrice: body.peakPrice, valleyPrice: body.valleyPrice, flatPrice: body.flatPrice });
        } catch (e) {
            if (e instanceof PriceInputError) {
                return NextResponse.json({ error: safeErrorMessage(e, '电价输入不完整，请检查后重试'), code: e.code }, { status: 422 });
            }
            throw e;
        }

        const input: StorageCalculationInput = {
            capacity: Number(body.power) || Number(body.capacity) / 2, // 功率 kW
            energy: Number(body.capacity), // 容量 kWh
            batteryType: 'lithium',
            location: {
                province: prices.pricing.province || '未填写',
                lat: Number(body.lat),
                lng: Number(body.lng),
            },
            applicationMode: 'arbitrage',
            arbitrageConfig: {
                chargeTime1: [0, 4],
                dischargeTime1: [8, 11],
                peakPrice: prices.peakPrice,
                valleyPrice: prices.valleyPrice,
                flatPrice: prices.flatPrice ?? 0 // 单次循环不使用
            },
            investment: {
                unitCost: Number(body.unitCost) || 1200,
                financing: 'cash'
            },
            technical: {
                efficiency: 90,
                dod: 90,
                cycleLife: Number(body.cycleLife) || 6000,
                degradationRate: 2,
                maintenanceCostRatio: 0.5
            }
        };

        const result = await calculateStorage(input);

        // pricing：电价来源、「来源待核实」状态、数据截至、哪些是用户填写的
        return NextResponse.json({ ...result, pricing: prices.pricing });
    } catch (error) {
        console.error('Storage calculation error:', error);
        return NextResponse.json(
            { error: '计算服务出错' },
            { status: 500 }
        );
    }
}
