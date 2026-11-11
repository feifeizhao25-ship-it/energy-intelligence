'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileText, Download, Printer, Share2 } from 'lucide-react';
import { getSolarResource, getWindResource } from '@/lib/api/nasa-power';
import { domesticClimate } from '@/lib/api/domestic-station';
import { calculateSolarScore, calculateWindScore, analyzeComplementarity } from '@/lib/resource/analysis';
import { generateResourceReport } from '@/lib/resource/report';
import VectorLayerPanel from './VectorLayerPanel';

export default function ReportPage() {
    const searchParams = useSearchParams();
    const [report, setReport] = useState<string>('');
    const [loading, setLoading] = useState(true);

    const lat = readCoordinate(searchParams.get('lat'), 90);
    const lng = readCoordinate(searchParams.get('lng'), 180);
    const name = searchParams.get('name') || '未知地点';
    const hasPoint = lat !== null && lng !== null;

    useEffect(() => {
        if (!hasPoint || lat === null || lng === null) {
            setLoading(false);
            return;
        }
        const pointLat = lat;
        const pointLng = lng;

        async function generate() {
            try {
                const [solar, wind] = await Promise.all([
                    getSolarResource(pointLat, pointLng),
                    getWindResource(pointLat, pointLng),
                ]);
                const climate = domesticClimate(pointLat, pointLng);
                const history = { note: '历史逐年序列未随省级样本提供，本次报告不含趋势。' };

                // Mock elevation or fetch if needed
                const elevation = 0;

                const analysis = {
                    solarScore: calculateSolarScore(solar, climate),
                    windScore: calculateWindScore(wind, climate, elevation),
                    complementarity: analyzeComplementarity(solar, wind)
                };

                const markdown = generateResourceReport({
                    location: name,
                    solar,
                    wind,
                    climate,
                    history,
                    analysis
                }, 'detailed');

                setReport(markdown);
            } catch (error) {
                console.error(error);
                setReport('# 生成报告失败\n无法获取资源数据，请稍后重试。');
            } finally {
                setLoading(false);
            }
        }
        generate();
    }, [lat, lng, name, hasPoint]);

    if (!hasPoint) {
        return (
            <div className="min-h-screen bg-gray-900 p-8 text-white">
                <h1 className="text-xl font-bold">还没有地图选点</h1>
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
                    这份评估报告需要一个地图上的位置。请先打开资源地图，点选项目所在地，再生成报告。
                </p>
                <a href="/map" className="mt-6 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">去地图选点</a>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8 flex justify-center">
            <div className="w-full max-w-4xl space-y-4">
                <VectorLayerPanel />
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileText className="w-6 h-6 text-blue-400" />
                        资源评估报告预览
                    </h1>
                    <div className="flex gap-2">
                        <button onClick={() => window.print()} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 border border-gray-700">
                            <Printer className="w-4 h-4" /> 打印
                        </button>
                        <button className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg flex items-center gap-2">
                            <Download className="w-4 h-4" /> 导出PDF
                        </button>
                    </div>
                </div>

                <div className="bg-white text-gray-900 rounded-xl p-12 min-h-[800px] shadow-2xl">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-[400px]">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                            <p className="text-gray-500">正在生成专业评估报告...</p>
                            <p className="text-xs text-gray-400 mt-2">数据来自国内省级离线样本，不是实时境外气象。</p>
                        </div>
                    ) : (
                        <div className="prose prose-lg max-w-none whitespace-pre-wrap font-sans">
                            {report}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/** 查询串里的纬度或经度。没传、空字符串或超出范围时视为未选点。0 是合法坐标。 */
export function readCoordinate(value: string | null, limit: number): number | null {
    if (value == null || value.trim() === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || Math.abs(parsed) > limit) return null;
    return parsed;
}
