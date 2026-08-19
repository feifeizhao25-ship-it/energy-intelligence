import { NextResponse } from 'next/server';
import { calculateSolar } from '@/lib/calculator/solar';
import { getLatestPrice } from '@/lib/crawler/price-crawler';
import { SolarCalculationInput } from '@/types';

/**
 * 光伏收益测算。
 *
 * 这个路由此前**不存在** —— `calculate/wind`、`calculate/storage`、
 * `calculate/comparison` 三个兄弟都在，唯独 solar 缺席，
 * 而 `components/quick-calc/ConversationalWizard.tsx` 一直在打它。
 * 请求 404 后被 catch 吞掉，静默跳回旧结果页，用户看到的是过时的静态页面
 * 而不是真实测算 —— 表现成「功能怪怪的」，而非「接口不存在」。
 *
 * 与 `/api/v2/solar/calculate` 的区别：v2 面向带证据链的审计级计算，
 * 要求 `location` / `unitCost` 且返回 `{success, data, meta}`；
 * 本路由是快速测算入口，参数更少，并按前端约定返回 `{success, data, pricing}`。
 *
 * 电价：前端传的是默认值（注释里写明「will be updated by API」），
 * 这里用 `getLatestPrice()` 覆盖，并把数据新鲜度一并返回 ——
 * 用 8 个月前的备份电价算出来的收益，必须让用户知道。
 */

export async function POST(req: Request) {
    try {
        const body = await req.json();

        if (!body.lat || !body.lng || !body.capacity) {
            return NextResponse.json(
                { success: false, error: '缺少必要参数 (lat, lng, capacity)' },
                { status: 400 },
            );
        }

        const province = String(body.province || '').trim();
        if (!province) {
            return NextResponse.json(
                { success: false, error: '缺少 province —— 电价按省份取，不能省略' },
                { status: 400 },
            );
        }

        // 取真实电价。`getLatestPrice` 对未收录省份会抛错而非静默套用邻省价格
        // （否则收益测算会整体算错却看不出来）。这里把它翻译成可读提示。
        let pricing;
        try {
            pricing = await getLatestPrice(province);
        } catch (e) {
            return NextResponse.json(
                {
                    success: false,
                    error: `暂无「${province}」的电价数据，无法测算`,
                    code: 'PRICE_UNAVAILABLE',
                    detail: e instanceof Error ? e.message : String(e),
                },
                { status: 422 },
            );
        }

        const selfUseRatioRaw = Number(body.selfUseRatio ?? 0);
        // 前端按百分比传（70 表示 70%），计算器要的是 0–1
        const selfUseRatio = selfUseRatioRaw > 1 ? selfUseRatioRaw / 100 : selfUseRatioRaw;

        const input: SolarCalculationInput = {
            lat: Number(body.lat),
            lng: Number(body.lng),
            capacity: Number(body.capacity),
            installationType: (body.installationType as SolarCalculationInput['installationType']) || 'roof',
            moduleType: (body.moduleType as SolarCalculationInput['moduleType']) || 'standard',
            tilt: body.tilt !== undefined ? Number(body.tilt) : undefined,
            azimuth: body.azimuth !== undefined ? Number(body.azimuth) : undefined,
            selfUseRatio: Math.min(Math.max(selfUseRatio, 0), 1),
            // 以真实电价为准，前端传的只是占位默认值
            electricityPrice: pricing.flat,
            feedInTariff: Number(body.feedInTariff) || pricing.flat,
            unitCost: body.unitCost !== undefined ? Number(body.unitCost) : undefined,
            province,
        };

        const result = await calculateSolar(input);

        return NextResponse.json({
            success: true,
            data: result,
            pricing: {
                province,
                flat: pricing.flat,
                // 让 UI 能提示「此结果基于 X 天前的电价备份」
                source: pricing.source,
                stale: pricing.stale,
                updatedAt: pricing.updatedAt,
            },
        });
    } catch (error) {
        console.error('Solar calculation error:', error);
        return NextResponse.json(
            { success: false, error: '计算服务出错' },
            { status: 500 },
        );
    }
}
