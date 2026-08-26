/**
 * 告警列表组件
 * 显示实时异常告警
 */

'use client';

interface Alert {
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    recommendation: string;
    createdAt: string;
    status: string;
}

interface AlertListProps {
    alerts: Alert[];
}

export default function AlertList({ alerts }: AlertListProps) {
    const getSeverityConfig = (severity: string) => {
        switch (severity) {
            case 'CRITICAL':
                return {
                    icon: '🔴',
                    bgColor: 'bg-red-50 dark:bg-red-900/20',
                    borderColor: 'border-red-200 dark:border-red-800',
                    textColor: 'text-red-700 dark:text-red-300',
                    badgeColor: 'bg-red-500 text-white'
                };
            case 'HIGH':
                return {
                    icon: '🟠',
                    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
                    borderColor: 'border-orange-200 dark:border-orange-800',
                    textColor: 'text-orange-700 dark:text-orange-300',
                    badgeColor: 'bg-orange-500 text-white'
                };
            case 'MEDIUM':
                return {
                    icon: '🟡',
                    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
                    borderColor: 'border-yellow-200 dark:border-yellow-800',
                    textColor: 'text-yellow-700 dark:text-yellow-300',
                    badgeColor: 'bg-yellow-500 text-white'
                };
            default:
                return {
                    icon: '🔵',
                    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
                    borderColor: 'border-blue-200 dark:border-blue-800',
                    textColor: 'text-blue-700 dark:text-blue-300',
                    badgeColor: 'bg-blue-500 text-white'
                };
        }
    };

    const getTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        if (diffHours > 24) {
            const days = Math.floor(diffHours / 24);
            return `${days}天前`;
        } else if (diffHours > 0) {
            return `${diffHours}小时前`;
        } else {
            return `${diffMinutes}分钟前`;
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-red-500 to-orange-600 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h3 className="text-lg font-semibold">异常告警</h3>
                    </div>
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                        {alerts.filter(a => a.status === 'ACTIVE').length} 条活跃
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                {alerts.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">✅</div>
                        <div className="text-lg font-medium text-gray-900 dark:text-white">一切正常</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            当前没有异常告警
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {alerts.map((alert) => {
                            const config = getSeverityConfig(alert.severity);

                            return (
                                <div
                                    key={alert.id}
                                    className={`p-4 rounded-lg border-l-4 ${config.bgColor} ${config.borderColor} hover:shadow-md transition-shadow`}
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">{config.icon}</span>
                                            <div>
                                                <h4 className="font-semibold text-gray-900 dark:text-white">
                                                    {alert.title}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.badgeColor}`}>
                                                        {alert.severity}
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        {getTimeAgo(alert.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Description */}
                                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                                        {alert.description}
                                    </p>

                                    {/* Recommendation */}
                                    {alert.recommendation && (
                                        <div className="p-3 bg-white/50 dark:bg-gray-700/30 rounded-md border border-gray-200 dark:border-gray-600">
                                            <div className="flex items-start gap-2">
                                                <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <div className="flex-1">
                                                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                        建议措施
                                                    </div>
                                                    <div className="text-sm text-gray-700 dark:text-gray-300">
                                                        {alert.recommendation}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 mt-3">
                                        <button className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors">
                                            标记已处理
                                        </button>
                                        <button className="px-3 py-1.5 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition-colors">
                                            创建工单
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
