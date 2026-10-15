import { NextResponse } from 'next/server';
import { calculateSolar, normalizeSelfUseRatio } from '@/lib/calculator/solar';
import { getLatestPrice, calculateAveragePrice } from '@/lib/crawler/price-crawler';
import { lookupTariff, TariffUnavailableError, NEW_ENERGY_FEED_IN_BASIS, sourceStatusLabel } from '@/lib/pricing/tariffs';
import { SolarCalculationInput } from '@/types';
import { enforceRateLimit, PUBLIC_RULES } from '@/lib/security/rate-limit';

/**
 * 光伏收益测算。
 *
 * 这个路由此前**不存在** —— `calculate/wind`、`calculate/storage`、
 * `calculate/comparison` 三个兄弟都在，唯独 solar 缺席，
 * 而当时的问答式入口 ConversationalWizard（已删除）一直在打它。
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
    const limited = await enforceRateLimit(req, PUBLIC_RULES.calculators);
    if (limited) return limited;

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

        // 已取消固定分时的省份：必须由用户输入合同电价（contractPrice，元/kWh），否则不测算。
        const tariff = lookupTariff(province);
        const contractPrice = Number(body.contractPrice);
        if (tariff.status === 'market') {
            if (!(contractPrice > 0)) {
                return NextResponse.json(
                    { success: false, error: tariff.message, code: 'MARKET_TOU' },
                    { status: 422 },
                );
            }
        }

        // 取真实电价。`getLatestPrice` 对未收录省份会抛错而非静默套用邻省价格
        // （否则收益测算会整体算错却看不出来）。这里把它翻译成可读提示。
        let pricing: {
            province: string; selfUsePrice: number; feedInTariff: number;
            sourceDoc: string; sourceVerified?: boolean; sourceStatus?: string; asOfLabel: string; stale: boolean; staleNote: string | null; updatedAt: string | null;
        };
        if (tariff.status === 'market') {
            pricing = {
                province, selfUsePrice: contractPrice, feedInTariff: contractPrice,
                sourceDoc: '用户输入的合同电价', sourceVerified: true, sourceStatus: '用户输入', asOfLabel: '电价为用户输入的合同电价', stale: false, staleNote: null, updatedAt: null,
            };
        } else {
            try {
                const price = await getLatestPrice(province);
                // 上网电价参考：燃煤发电基准价（136 号文后新能源上网电价走市场化，见 feedInBasis）
                const feedIn = tariff.status === 'ok' ? tariff.tariff.coalBenchmarkPrice : undefined;
                pricing = {
                    province: price.province,
                    // 自用电价按 峰4:平8:谷12 加权（与 /api/calculator/solar 同一口径）
                    selfUsePrice: calculateAveragePrice(price, 1),
                    feedInTariff: feedIn ?? price.valley,
                    sourceDoc: price.sourceDoc,
                    // 电价来源核验状态如实返回，结果页显示「来源待核实」
                    sourceVerified: tariff.status === 'ok' ? tariff.tariff.sourceVerified : false,
                    sourceStatus: tariff.status === 'ok' ? sourceStatusLabel(tariff.tariff) : '来源待核实',
                    asOfLabel: price.asOfLabel,
                    stale: price.stale,
                    staleNote: price.staleNote,
                    updatedAt: price.updatedAt || null,
                };
            } catch (e) {
                return NextResponse.json(
                    {
                        success: false,
                        error: e instanceof TariffUnavailableError ? `${e.lookup.message}，无法测算` : `暂无「${province}」的电价数据，无法测算`,
                        code: 'PRICE_UNAVAILABLE',
                    },
                    { status: 422 },
                );
            }
        }

        // 前端按百分比传（70 表示 70%），计算器要的是 0–1 小数
        const selfUseRatio = normalizeSelfUseRatio(body.selfUseRatio, 0);

        const input: SolarCalculationInput = {
            lat: Number(body.lat),
            lng: Number(body.lng),
            capacity: Number(body.capacity),
            installationType: (body.installationType as SolarCalculationInput['installationType']) || 'roof',
            moduleType: (body.moduleType as SolarCalculationInput['moduleType']) || 'standard',
            tilt: body.tilt !== undefined ? Number(body.tilt) : undefined,
            azimuth: body.azimuth !== undefined ? Number(body.azimuth) : undefined,
            selfUseRatio,
            // 以电价表为准，前端传的只是占位默认值
            electricityPrice: pricing.selfUsePrice,
            feedInTariff: pricing.feedInTariff,
            unitCost: body.unitCost !== undefined ? Number(body.unitCost) : undefined,
            province,
        };

        const result = await calculateSolar(input);

        return NextResponse.json({
            success: true,
            data: result,
            pricing: {
                province: pricing.province,
                selfUsePrice: pricing.selfUsePrice,
                feedInTariff: pricing.feedInTariff,
                // 让 UI 能提示「电价数据截至 2025-12，可能已变化，请以最新文件为准」
                source: pricing.sourceDoc,
                asOfLabel: pricing.asOfLabel,
                stale: pricing.stale,
                staleNote: pricing.staleNote,
                updatedAt: pricing.updatedAt,
                feedInBasis: NEW_ENERGY_FEED_IN_BASIS,
            },
        });
    } catch {
        console.error('Solar calculation failed');
        return NextResponse.json(
            { success: false, error: '计算服务出错' },
            { status: 500 },
        );
    }
}
