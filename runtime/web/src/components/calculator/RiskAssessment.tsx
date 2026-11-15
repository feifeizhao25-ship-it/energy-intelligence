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
            message: `静态回收期 ${result.paybackYears} 年。这是按当前输入算出的年数。`,
            suggestion: '对照电价、造价和发电量假设后重新计算。',
        });
    }

    // IRR过低
    if (result.irr < 10) {
        risks.push({
            level: 'danger',
            message: `内部收益率 ${result.irr}%。这是测算值，随电价与造价假设变化。`,
            suggestion: '可以改电价或造价后再次测算，结果仍不是承诺。',
        });
    }

    // 遮挡严重
    if (result.shadingFactor && result.shadingFactor > 0.2) {
        risks.push({
            level: 'warning',
            message: '屋顶存在较多遮挡',
            suggestion: '遮挡比例会改变倾斜面辐照，请把实测遮挡写入输入后重算。',
        });
    }

    // 电价过低
    if (result.electricityPrice && result.electricityPrice < 0.35) {
        risks.push({
            level: 'warning',
            message: '录入电价低于 0.35 元/千瓦时。',
            suggestion: '自用比例会改变测算结果，请按实际用电重算。',
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
                    {hasDanger ? '测算提示' : '假设核对'}
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
                                <strong className="text-red-900">核对：</strong>
                                当前输入下有多项测算提示。请核对遮挡、电价和回收期假设。结果不是决策指令。
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
