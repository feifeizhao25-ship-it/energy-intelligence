'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileText, Download, Printer, Share2 } from 'lucide-react';
import { getSolarResource, getWindResource, getClimateData, getHistoricalData } from '@/lib/api/nasa-power';
import { calculateSolarScore, calculateWindScore, analyzeComplementarity } from '@/lib/resource/analysis';
import { generateResourceReport } from '@/lib/resource/report';

export default function ReportPage() {
    const searchParams = useSearchParams();
    const [report, setReport] = useState<string>('');
    const [loading, setLoading] = useState(true);

    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const name = searchParams.get('name') || '未知地点';

    useEffect(() => {
        if (!lat || !lng) {
            setLoading(false);
            return;
        }

        async function generate() {
            try {
                const [solar, wind, climate, history] = await Promise.all([
                    getSolarResource(lat, lng),
                    getWindResource(lat, lng),
                    getClimateData(lat, lng),
                    getHistoricalData(lat, lng, 2020, 2022)
                ]);

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
    }, [lat, lng, name]);

    if (!lat || !lng) {
        return <div className="p-8 text-white">无效的坐标参数</div>;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8 flex justify-center">
            <div className="w-full max-w-4xl">
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
                            <p className="text-xs text-gray-400 mt-2">整合NASA气象数据与AI分析模型</p>
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
