/**
 * 资产健康度评分组件
 * 显示投资等级评定（AAA~D）
 */

'use client';

interface HealthScoreProps {
    score: number;
    grade: string;
    trend: string;
}

export default function HealthScore({ score, grade, trend }: HealthScoreProps) {
    const getGradeColor = (grade: string) => {
        if (grade.startsWith('AA')) return { bg: 'from-green-500 to-emerald-600', text: 'text-green-600 dark:text-green-400', ring: 'ring-green-500' };
        if (grade.startsWith('A')) return { bg: 'from-blue-500 to-indigo-600', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-500' };
        if (grade.startsWith('BB')) return { bg: 'from-yellow-500 to-amber-600', text: 'text-yellow-600 dark:text-yellow-400', ring: 'ring-yellow-500' };
        if (grade.startsWith('B')) return { bg: 'from-orange-500 to-red-600', text: 'text-orange-600 dark:text-orange-400', ring: 'ring-orange-500' };
        return { bg: 'from-gray-500 to-gray-600', text: 'text-gray600 dark:text-gray-400', ring: 'ring-gray-500' };
    };

    const getTrendIcon = () => {
        switch (trend) {
            case 'IMPROVING':
                return (
                    <div className="flex items-center gap-1 text-green-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="text-sm">改善中</span>
                    </div>
                );
            case 'DEGRADING':
                return (
                    <div className="flex items-center gap-1 text-red-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                        </svg>
                        <span className="text-sm">下降中</span>
                    </div>
                );
            default:
                return (
                    <div className="flex items-center gap-1 text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                        </svg>
                        <span className="text-sm">稳定</span>
                    </div>
                );
        }
    };

    const colors = getGradeColor(grade);
    const percentage = (score / 100) * 360;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">资产健康度评分</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">投资等级评定（对标穆迪/标普）</p>
                    </div>
                    {getTrendIcon()}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* 圆形评分图 */}
                    <div className="flex items-center justify-center">
                        <div className="relative w-48 h-48">
                            {/* 背景圆环 */}
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="96"
                                    cy="96"
                                    r="88"
                                    stroke="currentColor"
                                    strokeWidth="12"
                                    fill="none"
                                    className="text-gray-200 dark:text-gray-700"
                                />
                                {/* 进度圆环 */}
                                <circle
                                    cx="96"
                                    cy="96"
                                    r="88"
                                    stroke="url(#gradient)"
                                    strokeWidth="12"
                                    fill="none"
                                    strokeDasharray={`${percentage * 1.54} 999`}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000 ease-out"
                                />
                                <defs>
                                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" className={colors.bg.split(' ')[0].replace('from-', 'text-')} stopColor="currentColor" />
                                        <stop offset="100%" className={colors.bg.split(' ')[1].replace('to-', 'text-')} stopColor="currentColor" />
                                    </linearGradient>
                                </defs>
                            </svg>

                            {/* 中心内容 */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <div className={`text-5xl font-bold ${colors.text}`}>
                                    {score}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">/ 100</div>
                            </div>
                        </div>
                    </div>

                    {/* 投资等级 */}
                    <div className="flex flex-col justify-center">
                        <div className="space-y-4">
                            <div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">投资等级</div>
                                <div className={`inline-flex items-center px-6 py-3 bg-gradient-to-r ${colors.bg} rounded-xl shadow-lg ring-4 ${colors.ring} ring-opacity-20`}>
                                    <span className="text-4xl font-bold text-white">{grade}</span>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">评级说明</div>
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                    {getGradeDescription(grade)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 评级标准 */}
                    <div className="flex flex-col justify-center">
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-gray-900 dark:text-white mb-3">评级标准</div>

                            {[
                                { grade: 'AAA', range: '95-100', color: 'bg-green-500', label: '优异' },
                                { grade: 'AA', range: '90-94', color: 'bg-green-400', label: '优秀' },
                                { grade: 'A', range: '85-89', color: 'bg-blue-500', label: '良好' },
                                { grade: 'BBB', range: '80-84', color: 'bg-yellow-500', label: '一般' },
                                { grade: 'BB', range: '75-79', color: 'bg-orange-500', label: '关注' },
                                { grade: 'B', range: '70-74', color: 'bg-red-500', label: '较差' },
                                { grade: 'C', range: '60-69', color: 'bg-red-600', label: '差' },
                                { grade: 'D', range: '<60', color: 'bg-gray-500', label: '极差' },
                            ].map((item) => (
                                <div
                                    key={item.grade}
                                    className={`flex items-center justify-between p-2 rounded-lg transition-all ${grade === item.grade
                                            ? 'bg-gray-100 dark:bg-gray-700 ring-2 ring-green-500'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                                        <span className={`text-sm font-medium ${grade === item.grade ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                            {item.grade}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">{item.range}</span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">{item.label}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 底部提示 */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                            <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                资产健康度评分用途
                            </div>
                            <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                此评分可用于银行融资、资产交易、投资决策等场景。评级越高，资产质量越好，融资成本越低。
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getGradeDescription(grade: string): string {
    const descriptions: Record<string, string> = {
        'AAA': '资产表现优异，各项指标远超行业标准，投资风险极低',
        'AA': '资产表现优秀，运营稳定，具有很高的投资价值',
        'A': '资产表现良好，运营正常，投资风险较低',
        'BBB': '资产表现一般，部分指标需要改进',
        'BB': '资产表现需要关注，存在一定的运营风险',
        'B': '资产表现较差，需要尽快采取改进措施',
        'C': '资产表现差，存在严重的运营问题',
        'D': '资产表现极差，可能需要大规模整改或停运'
    };

    return descriptions[grade] || '无评级说明';
}
