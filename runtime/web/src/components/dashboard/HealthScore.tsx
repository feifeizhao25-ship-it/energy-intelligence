/**
 * 不评定投资等级。没有经过验证的评分规则时，只说明未接入。
 */

'use client';

interface HealthScoreProps {
    score: number | null;
    grade?: string | null;
    trend?: string | null;
}

export default function HealthScore({ score }: HealthScoreProps) {
    const hasScore = typeof score === 'number' && Number.isFinite(score);
    return (
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">运行读数</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                {hasScore
                    ? `已录入读数 ${score}。评分规则待核实，这里不换算成等级，也不对应融资或交易结论。`
                    : '没有经过验证的健康度规则，不显示分数或等级。'}
            </p>
        </section>
    );
}
