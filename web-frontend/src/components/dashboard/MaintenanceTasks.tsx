/**
 * 运维任务组件
 * 显示本周自动生成的运维建议（ROI驱动）
 */

'use client';

interface MaintenanceTask {
    priority: string;
    action: string;
    reason: string;
    estimatedCost: number;
    estimatedGain: number;
    roi: string;
    recommendedDate: string;
    completed: boolean;
}

interface MaintenanceTasksProps {
    weekOf: string;
    tasks: MaintenanceTask[];
}

export default function MaintenanceTasks({ weekOf, tasks }: MaintenanceTasksProps) {
    const getPriorityConfig = (priority: string) => {
        switch (priority) {
            case 'CRITICAL':
                return {
                    icon: '🔴',
                    color: 'text-red-600 dark:text-red-400',
                    bgColor: 'bg-red-50 dark:bg-red-900/20',
                    borderColor: 'border-red-200 dark:border-red-800',
                    label: '紧急'
                };
            case 'HIGH':
                return {
                    icon: '🟠',
                    color: 'text-orange-600 dark:text-orange-400',
                    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
                    borderColor: 'border-orange-200 dark:border-orange-800',
                    label: '高优先级'
                };
            case 'MEDIUM':
                return {
                    icon: '🟡',
                    color: 'text-yellow-600 dark:text-yellow-400',
                    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
                    borderColor: 'border-yellow-200 dark:border-yellow-800',
                    label: '中优先级'
                };
            default:
                return {
                    icon: '🟢',
                    color: 'text-green-600 dark:text-green-400',
                    bgColor: 'bg-green-50 dark:bg-green-900/20',
                    borderColor: 'border-green-200 dark:border-green-800',
                    label: '低优先级'
                };
        }
    };

    const getRecommendedDateText = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return '今天';
        if (diffDays === 1) return '明天';
        if (diffDays === -1) return '昨天';
        if (diffDays > 0) return `${diffDays}天后`;
        return `${Math.abs(diffDays)}天前`;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        <h3 className="text-lg font-semibold">本周运维计划</h3>
                    </div>
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                        {tasks.filter(t => !t.completed).length} 待完成
                    </span>
                </div>
                <p className="text-sm text-green-100 mt-1">
                    本周: {new Date(weekOf).toLocaleDateString('zh-CN')}
                </p>
            </div>

            {/* Content */}
            <div className="p-6">
                {tasks.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">🎉</div>
                        <div className="text-lg font-medium text-gray-900 dark:text-white">
                            本周无需运维
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            项目运行良好，暂时不需要额外维护
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {tasks.map((task, index) => {
                            const config = getPriorityConfig(task.priority);

                            return (
                                <div
                                    key={index}
                                    className={`relative p-4 rounded-lg border-l-4 ${config.bgColor} ${config.borderColor} ${task.completed ? 'opacity-60' : ''
                                        } hover:shadow-md transition-all`}
                                >
                                    {/* Completed Badge */}
                                    {task.completed && (
                                        <div className="absolute top-2 right-2">
                                            <span className="inline-flex items-center px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                已完成
                                            </span>
                                        </div>
                                    )}

                                    {/* Header */}
                                    <div className="flex items-start gap-3 mb-3">
                                        <span className="text-2xl">{config.icon}</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color} bg-white dark:bg-gray-700`}>
                                                    {config.label}
                                                </span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    建议日期: {getRecommendedDateText(task.recommendedDate)}
                                                </span>
                                            </div>
                                            <h4 className="font-semibold text-gray-900 dark:text-white text-lg">
                                                {task.action}
                                            </h4>
                                        </div>
                                    </div>

                                    {/* Reason */}
                                    <div className="mb-4">
                                        <div className="text-sm text-gray-700 dark:text-gray-300">
                                            <span className="font-medium text-gray-600 dark:text-gray-400">原因：</span>
                                            {task.reason}
                                        </div>
                                    </div>

                                    {/* ROI Analysis */}
                                    <div className="grid grid-cols-3 gap-4 mb-4">
                                        <div className="p-3 bg-white/50 dark:bg-gray-700/30 rounded-lg">
                                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">成本</div>
                                            <div className="text-lg font-bold text-red-600 dark:text-red-400">
                                                ¥{task.estimatedCost.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-white/50 dark:bg-gray-700/30 rounded-lg">
                                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">收益</div>
                                            <div className="text-lg font-bold text-green-600 dark:text-green-400">
                                                ¥{task.estimatedGain.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg">
                                            <div className="text-xs text-green-100 mb-1">ROI</div>
                                            <div className="text-lg font-bold text-white">
                                                {task.roi}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {!task.completed && (
                                        <div className="flex items-center gap-2">
                                            <button className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                标记完成
                                            </button>
                                            <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                                                创建工单
                                            </button>
                                            <button className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
                                                延后
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Bottom Tip */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                            <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                智能运维建议
                            </div>
                            <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                运维计划基于实时数据自动生成，优先显示ROI高的任务。及时执行可以有效减少损失、提高收益。
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
