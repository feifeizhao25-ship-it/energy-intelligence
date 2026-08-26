'use client';

import { Shield, AlertTriangle, HelpCircle, CheckCircle, ChevronRight } from 'lucide-react';

// 在结果页添加"打消顾虑"模块
export function FearReliefSection() {
    const fears = [
        {
            fear: '收益数据真实吗？',
            relief: '我们的数据直接对接 NASA 气象数据库，并结合了全国 1200+ 个真实电站的运行数据进行校准。虽然天气不可预测，但长期的发电量预测误差控制在 ±8% 以内。',
            icon: Shield,
            action: '查看数据来源白皮书',
            color: 'text-indigo-500',
            bg: 'bg-indigo-50',
        },
        {
            fear: '安装商跑路怎么办？',
            relief: '平台认证的安装商都缴纳了质保金。我们提供"先装后付"的托管服务，只有当电站并在电网公司验收合格后，资金才会打给安装商。',
            icon: CheckCircle,
            action: '了解"无忧装"保障',
            color: 'text-emerald-500',
            bg: 'bg-emerald-50',
        },
        {
            fear: '几年后屋顶漏水？',
            relief: '这是最常见的施工问题。我们要求安装商必须采用"柔性防水"工艺，并提供 5 年的防水质保。合同中会明确约定漏水赔偿责任。',
            icon: AlertTriangle,
            action: '查看防水施工标准',
            color: 'text-amber-500',
            bg: 'bg-amber-50',
        },
    ];

    return (
        <div className="mt-12">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-100 rounded-xl">
                    <HelpCircle className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 text-lg">大家都在担心什么？</h3>
                    <p className="text-xs text-slate-500 font-medium">针对 30,000+ 用户做出的调研与解答</p>
                </div>
            </div>

            <div className="grid gap-4">
                {fears.map((item) => (
                    <div key={item.fear} className="group relative overflow-hidden bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
                        <div className="flex gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.bg}`}>
                                <item.icon className={`w-5 h-5 ${item.color}`} />
                            </div>
                            <div className="flex-1 space-y-2">
                                <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                    {item.fear}
                                </h4>
                                <p className="text-sm text-slate-600 leading-relaxed text-justify">
                                    {item.relief}
                                </p>
                                <button className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 mt-2 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                                    {item.action}
                                    <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
