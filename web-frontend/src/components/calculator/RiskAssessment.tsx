'use client';

import { AlertTriangle, XCircle } from 'lucide-react';

interface RiskAssessmentProps {
    result: {
        irr: number;
        paybackYears: number;
        roofCondition?: string;
        shadingFactor?: number;
        electricityPrice?: number;
    };
}

// 风险评估组件 - 在结果页显示
export function RiskAssessment({ result }: RiskAssessmentProps) {
    const risks: { level: 'warning' | 'danger'; message: string; suggestion: string }[] = [];

    // 回本年限过长
    if (result.paybackYears > 8) {
        risks.push({
            level: 'warning',
            message: `回本年限${result.paybackYears}年，较长`,
            suggestion: '建议与银行理财对比，或等待组件价格下降',
        });
    }

    // IRR过低
    if (result.irr < 10) {
        risks.push({
            level: 'danger',
            message: `投资回报率仅${result.irr}%，偏低`,
            suggestion: '当前条件下安装光伏可能不划算，建议暂缓',
        });
    }

    // 遮挡严重
    if (result.shadingFactor && result.shadingFactor > 0.2) {
        risks.push({
            level: 'warning',
            message: '屋顶存在较多遮挡',
            suggestion: '建议先清除遮挡物，或选择微型逆变器方案',
        });
    }

    // 电价过低
    if (result.electricityPrice && result.electricityPrice < 0.35) {
        risks.push({
            level: 'warning',
            message: '当地电价较低，收益受限',
            suggestion: '自用比例越高越划算，建议白天多用电',
        });
    }

    if (risks.length === 0) return null;

    const hasDanger = risks.some(r => r.level === 'danger');

    return (
        <div className={`relative overflow-hidden rounded-2xl p-6 mt-8 transition-all duration-500 shadow-sm hover:shadow-md ${hasDanger ? 'bg-red-50/50 border border-red-100' : 'bg-amber-50/50 border border-amber-100'}`}>
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-current opacity-[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="relative">
                <h3 className={`font-bold text-lg mb-4 flex items-center gap-2.5 ${hasDanger ? 'text-red-900' : 'text-amber-900'}`}>
                    <div className={`p-2 rounded-xl ${hasDanger ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    {hasDanger ? '风险评估报告' : '投资评估建议'}
                </h3>

                <div className="space-y-3">
                    {risks.map((risk, index) => (
                        <div key={index} className="group flex items-start gap-3 p-3 rounded-xl bg-white/60 hover:bg-white border border-transparent hover:border-white/50 transition-all">
                            {risk.level === 'danger' ? (
                                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            ) : (
                                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                                <p className={`text-sm font-bold mb-0.5 ${risk.level === 'danger' ? 'text-red-900' : 'text-amber-900'}`}>
                                    {risk.message}
                                </p>
                                <p className={`text-xs leading-relaxed ${risk.level === 'danger' ? 'text-red-600' : 'text-amber-700/80'}`}>
                                    {risk.suggestion}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {hasDanger && (
                    <div className="mt-5 pt-4 border-t border-red-100/50">
                        <div className="flex gap-3">
                            <div className="w-1 h-full bg-red-400 rounded-full py-6 opacity-30"></div>
                            <p className="text-xs text-red-800/80 leading-relaxed font-medium">
                                <strong className="text-red-900">专家建议：</strong>
                                当前项目存在较高风险，建议您暂缓决策。不仅是经济回报偏低，可能还存在长期的维护隐患。建议咨询第三方监理或重新评估选址。
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
