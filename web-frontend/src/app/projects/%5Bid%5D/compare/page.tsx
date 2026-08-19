/**
 * 🏰 护城河系统：方案对比页面
 * 核心：让用户在不同决策路径之间进行深度对比，沉淀决策资产
 */

import React from 'react';
import {
    ArrowLeftRight, TrendingUp, TrendingDown,
    CheckCircle2, AlertCircle, ShieldCheck,
    ChevronLeft, BarChart2
} from 'lucide-react';

export default function ComparePage() {
    const comparison = {
        summary: "由于方案 B 采用了更高效率的 N 型组件，IRR 提升了 1.2%，整体回本周期缩短了 0.8 年。",
        recommendation: "建议优先考虑方案 B，尽管初始投资高出 5%，但其 LCOE 更有竞争优势。",
        differences: [
            { metric: "内部收益率 (IRR)", left: "11.3%", right: "12.5%", delta: "+1.2%", impact: "positive" },
            { metric: "回本周期", left: "7.0年", right: "6.2年", delta: "-0.8年", impact: "positive" },
            { metric: "LCOE (度电成本)", left: "0.32", right: "0.29", delta: "-0.03", impact: "positive" },
            { metric: "初始投资 (CAPEX)", left: "¥18.2万", right: "¥19.1万", delta: "+¥0.9万", impact: "negative" }
        ]
    };

    return (
        <div className="min-h-screen bg-gray-50/50 py-12">
            <div className="max-w-5xl mx-auto px-6">
                <div className="flex items-center gap-2 text-gray-400 mb-8 cursor-pointer hover:text-gray-600">
                    <ChevronLeft size={20} />
                    返回项目仪表盘
                </div>

                <div className="flex items-center gap-3 mb-10">
                    <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary-200">
                        <ArrowLeftRight size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">方案深度对比分析</h1>
                        <p className="text-gray-500">正在对比：2026.Q1 标准方案 vs 高效 N 型组件方案</p>
                    </div>
                </div>

                {/* AI 诊断结果 */}
                <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm mb-8">
                    <div className="flex items-center gap-2 text-primary-600 font-bold mb-4">
                        <ShieldCheck size={20} />
                        AI 审计意见
                    </div>
                    <p className="text-xl text-gray-800 leading-relaxed font-medium mb-6">
                        {comparison.summary}
                    </p>
                    <div className="bg-primary-50 p-4 rounded-2xl text-primary-700 font-bold border border-primary-100 italic">
                        " {comparison.recommendation} "
                    </div>
                </div>

                {/* 核心指标对比表 */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-8">
                    <div className="grid grid-cols-4 p-6 bg-gray-50/50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <div>指标项</div>
                        <div>方案 A (基准)</div>
                        <div>方案 B (对比)</div>
                        <div className="text-right">差异 (Delta)</div>
                    </div>

                    <div className="divide-y divide-gray-50">
                        {comparison.differences.map((diff, i) => (
                            <div key={i} className="grid grid-cols-4 p-6 items-center hover:bg-gray-50/50 transition-colors">
                                <div className="font-bold text-gray-700">{diff.metric}</div>
                                <div className="text-gray-500">{diff.left}</div>
                                <div className="text-gray-900 font-bold">{diff.right}</div>
                                <div className={`text-right font-bold flex items-center justify-end gap-1 ${diff.impact === 'positive' ? 'text-green-600' :
                                        diff.impact === 'negative' ? 'text-red-500' : 'text-gray-900'
                                    }`}>
                                    {diff.impact === 'positive' ? <TrendingUp size={14} /> :
                                        diff.impact === 'negative' ? <TrendingDown size={14} /> : null}
                                    {diff.delta}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 图表展示区说明 */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                            <BarChart2 size={24} />
                        </div>
                        <h3 className="font-bold mb-1">现金流对比曲线</h3>
                        <p className="text-xs text-gray-400">正在生成 25 年动态现金流分析图...</p>
                    </div>
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 bg-yellow-50 text-yellow-500 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle size={24} />
                        </div>
                        <h3 className="font-bold mb-1">敏感性分析对比</h3>
                        <p className="text-xs text-gray-400">正在对比不同电价波动下的方案抗风险能力...</p>
                    </div>
                </div>

                <div className="mt-12 flex justify-center gap-4">
                    <button className="px-8 py-3 border rounded-2xl font-bold text-gray-600 hover:bg-gray-50">
                        下载详细对比报告
                    </button>
                    <button className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 shadow-lg">
                        通过方案 B 更新项目
                    </button>
                </div>
            </div>
        </div>
    );
}
