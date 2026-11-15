'use client';

import { useEffect, useState } from 'react';
import type { TariffDefaults, PricingInfo } from '@/lib/pricing/tariff-defaults';
import { NEW_ENERGY_FEED_IN_BASIS, TARIFFS } from '@/lib/pricing/tariffs';

/** 省份下拉：电价表收录的省份 + 「其他省份（自己填写电价）」 */
export const TARIFF_PROVINCES = Object.keys(TARIFFS);

/**
 * 风电、储能测算页的电价输入：留空 = 按所选省份的电价表取值（输入框里以浅色显示表内数值），填了 = 用你的数值。
 * 表内条目的「来源待核实」状态、数据截至日期、是否超过 90 天都原样显示；
 * 已取消固定分时或未收录的省份，提示必须自己填写。上网电价附 136 号文后市场化 / 机制电价说明。
 */

export type PriceKey = 'peak' | 'flat' | 'valley' | 'coalBenchmarkPrice' | 'averageRetail';

export interface PriceField {
    key: PriceKey;
    label: string;
}

export type TariffRead =
    | { phase: 'loading' }
    | { phase: 'empty' }
    | { phase: 'error' }
    | { phase: 'ready'; defaults: TariffDefaults };

export const TARIFF_EMPTY_NOTE = '请选择省份，或直接填写电价';
export const TARIFF_ERROR_NOTE = '电价表暂时读不出来，请在输入框里填写电价（机制电价或合同价）';

/** 读取结果对应的一句说明。读不出来或没选省份时改为可手工填写，不再停在「正在读取」。 */
export function tariffFieldNote(read: TariffRead, key: PriceKey): string {
    if (read.phase === 'loading') return '正在读取电价表…';
    if (read.phase === 'empty') return TARIFF_EMPTY_NOTE;
    if (read.phase === 'error') return TARIFF_ERROR_NOTE;
    return describeDefault(read.defaults, key);
}

/** 输入框下方的说明：表里有值时写「留空按电价表 x 元/度（来源待核实…）」，没有时写必须填写。 */
export function describeDefault(defaults: TariffDefaults | null, key: PriceKey): string {
    if (!defaults) return TARIFF_ERROR_NOTE;
    if (key === 'coalBenchmarkPrice') {
        // 上网电价参考与分时电价无关：不因「已取消固定分时」挡住，只看表里有没有燃煤发电基准价
        if (typeof defaults.coalBenchmarkPrice !== 'number') return defaults.feedInMessage ?? '请填写上网电价（机制电价或合同价）';
        return `留空按燃煤发电基准价 ${defaults.coalBenchmarkPrice} 元/度作参考（${defaults.coalBenchmarkNote ?? defaults.sourceStatus ?? ''}）`;
    }
    if (defaults.status !== 'ok') return defaults.message ?? '电价表里没有该省数据，请填写';
    const value = defaults[key];
    if (typeof value !== 'number') return `电价表里没有${defaults.province}的这一项，请填写`;
    const parts = [defaults.sourceStatus, defaults.asOfLabel, defaults.staleNote].filter(Boolean).join('，');
    return `留空按电价表 ${value} 元/度（${parts}）`;
}

/** 测算结果里的电价来源一句话 */
export function describePricing(pricing: PricingInfo | null | undefined): string {
    if (!pricing) return '电价来源未返回';
    const used = Object.entries(pricing.values ?? {}).map(([k, v]) => `${k} ${v} 元/度`).join('、');
    if (pricing.sourceStatus === '用户输入') return `电价：${used || '全部'}为你填写的数值`;
    const own = pricing.userProvided.length ? `；其中 ${pricing.userProvided.length} 项为你填写` : '';
    const stale = pricing.staleNote ? `，${pricing.staleNote}` : '';
    return `电价：${used ? `${used}，` : ''}${pricing.province}省级电价表（${pricing.sourceStatus}${pricing.asOfLabel ? `，${pricing.asOfLabel}` : ''}${stale}）${own}`;
}

export function useTariffDefaults(province: string): TariffRead {
    const [read, setRead] = useState<TariffRead>(() => (province ? { phase: 'loading' } : { phase: 'empty' }));
    useEffect(() => {
        let cancelled = false;
        if (!province) {
            setRead({ phase: 'empty' });
            return;
        }
        setRead({ phase: 'loading' });
        const timer = setTimeout(() => {
            if (!cancelled) setRead({ phase: 'error' });
        }, 8000);
        fetch(`/api/pricing/tariff?province=${encodeURIComponent(province)}`, { signal: AbortSignal.timeout(8000) })
            .then(async (response) => {
                const body = await response.json().catch(() => null);
                if (cancelled) return;
                clearTimeout(timer);
                if (!response.ok || !body?.data || typeof body.data !== 'object') {
                    setRead({ phase: 'error' });
                    return;
                }
                setRead({ phase: 'ready', defaults: body.data as TariffDefaults });
            })
            .catch(() => { if (!cancelled) setRead({ phase: 'error' }); })
            .finally(() => clearTimeout(timer));
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [province]);
    return read;
}

export default function TariffPriceFields({
    province, fields, values, onChange, showFeedInBasis = false,
}: {
    province: string;
    fields: PriceField[];
    values: Partial<Record<PriceKey, string>>;
    onChange: (key: PriceKey, value: string) => void;
    showFeedInBasis?: boolean;
}) {
    const read = useTariffDefaults(province);
    const defaults = read.phase === 'ready' ? read.defaults : null;
    const noteIsProblem = read.phase === 'empty' || read.phase === 'error';
    return (
        <div className="space-y-4" data-testid="tariff-fields">
            {noteIsProblem && <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm leading-6 text-amber-100">{tariffFieldNote(read, fields[0]?.key ?? 'coalBenchmarkPrice')}</p>}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {fields.map(field => {
                    const tableValue = defaults && (defaults.status === 'ok' || field.key === 'coalBenchmarkPrice') ? defaults[field.key] : null;
                    return (
                        <label key={field.key} className="space-y-2 text-sm">
                            <span className="block text-xs font-bold text-slate-400">{field.label}（元/千瓦时）</span>
                            <input
                                type="number"
                                min={0}
                                max={10}
                                step="any"
                                inputMode="decimal"
                                value={values[field.key] ?? ''}
                                placeholder={typeof tableValue === 'number' ? String(tableValue) : '请填写'}
                                onChange={e => onChange(field.key, e.target.value)}
                                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500"
                            />
                            <span className="block text-[11px] leading-5 text-slate-500">{tariffFieldNote(read, field.key)}</span>
                        </label>
                    );
                })}
            </div>
            {/* 分时电价的备注只在填分时电价时显示；上网电价只显示基准价与 136 号文说明 */}
            {defaults?.note && fields.some(f => f.key !== 'coalBenchmarkPrice') && <p className="text-[11px] leading-5 text-slate-500">电价表备注：{defaults.note}</p>}
            <p className="text-[11px] leading-5 text-slate-500">这里的「度」指千瓦时。电价按元/千瓦时填写，不是分/千瓦时。</p>
            {showFeedInBasis && <p className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-[11px] leading-5 text-slate-400">{NEW_ENERGY_FEED_IN_BASIS}</p>}
        </div>
    );
}
