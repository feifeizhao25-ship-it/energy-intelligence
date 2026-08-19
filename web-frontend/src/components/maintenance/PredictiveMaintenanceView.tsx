'use client';

import React from 'react';
import {
    BarChart3,
    TrendingUp,
    Calendar,
    AlertCircle,
    CheckCircle2,
    History,
    Zap
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    LineChart,
    Line,
    Legend
} from 'recharts';

// Mock Data
const COMPONENT_LIFESPAN = [
    { name: '逆变器模块', life: 75, status: 'good' },
    { name: '汇流箱防雷', life: 45, status: 'warning' },
    { name: '支架紧固件', life: 92, status: 'good' },
    { name: '变压器油温', life: 88, status: 'good' },
    { name: '风机齿轮箱', life: 12, status: 'critical' },
];

const MAINTENANCE_COST_FORECAST = [
    { year: '2025', routine: 120, replacement: 30 },
    { year: '2026', routine: 125, replacement: 45 },
    { year: '2027', routine: 130, replacement: 180 }, // Big jump
    { year: '2028', routine: 135, replacement: 60 },
    { year: '2029', routine: 140, replacement: 80 },
];

export default function PredictiveMaintenanceView() {
    return (
        <div className="space-y-6">
            <div className="bg-white rounded-[24px] border border-slate-100 p-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">预测性维护规划</h2>
                        <p className="text-sm text-slate-500">基于可靠性工程模型的寿命预测与预算规划</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Component Health Status */}
                <div className="bg-white rounded-[24px] border border-slate-100 p-6">
                    <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500" />
                        关键部件剩余寿命预测 (RUL)
                    </h3>
                    <div className="space-y-6">
                        {COMPONENT_LIFESPAN.map((comp, i) => (
                            <div key={i}>
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        {comp.status === 'critical' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                        <span className="font-bold text-slate-700 text-sm">{comp.name}</span>
                                    </div>
                                    <span className={`font-black text-sm ${comp.status === 'critical' ? 'text-red-500' :
                                            comp.status === 'warning' ? 'text-amber-500' : 'text-green-500'
                                        }`}>
                                        {comp.life}%
                                    </span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${comp.status === 'critical' ? 'bg-red-500' :
                                                comp.status === 'warning' ? 'bg-amber-500' : 'bg-green-500'
                                            }`}
                                        style={{ width: `${comp.life}%` }}
                                    />
                                </div>
                                <div className="text-xs text-slate-400 mt-1 flex justify-between">
                                    <span>预计更换: {comp.status === 'critical' ? '3个月内' : comp.status === 'warning' ? '12个月内' : '>3年'}</span>
                                    {comp.status === 'critical' && <span className="text-red-500 font-bold">建议备件</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Budget Forecast */}
                <div className="bg-white rounded-[24px] border border-slate-100 p-6">
                    <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-500" />
                        未来5年维保预算预测 (万元)
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={MAINTENANCE_COST_FORECAST} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis
                                    dataKey="year"
                                    tick={{ fontSize: 12, fill: '#64748B', fontWeight: 'bold' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: '#64748B' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: '#F1F5F9' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Legend iconType="circle" />
                                <Bar dataKey="routine" name="常规运维" stackId="a" fill="#94a3b8" radius={[0, 0, 4, 4]} barSize={32} />
                                <Bar dataKey="replacement" name="技改大修" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                        <div className="flex items-start gap-2">
                            <History className="w-4 h-4 text-indigo-600 mt-0.5" />
                            <p className="text-xs text-indigo-800 font-medium">
                                <span className="font-bold">分析洞察: </span>
                                2027年预计将迎来设备更换高峰期（主要为逆变器批量老化），建议提前规划 180万元 专项资金。
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
