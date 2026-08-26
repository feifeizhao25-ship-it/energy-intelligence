'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Activity, BarChart3, FileText, AlertTriangle, Milestone,
    ChevronRight, Filter, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * 项目时间线组件
 * 护城河：沉淀用户数据资产
 */

interface TimelineEvent {
    id: string;
    type: string;
    title: string;
    description: string;
    data?: Record<string, unknown>;
    auditId?: string;
    tags?: string[];
    isMilestone?: boolean;
    createdAt: string;
}

interface TimelineProps {
    projectId: string;
    events?: TimelineEvent[];
    summary?: {
        totalEvents: number;
        totalCalculations: number;
        totalDiagnoses: number;
        totalReports: number;
        daysActive: number;
    };
}

const eventTypeConfig: Record<string, { icon: any; color: string; bg: string }> = {
    PROJECT_CREATED: { icon: Milestone, color: 'text-blue-600', bg: 'bg-blue-100' },
    CALCULATION_DONE: { icon: BarChart3, color: 'text-green-600', bg: 'bg-green-100' },
    DIAGNOSIS_DONE: { icon: Activity, color: 'text-purple-600', bg: 'bg-purple-100' },
    REPORT_GENERATED: { icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    ALERT_TRIGGERED: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
    STAGE_CHANGED: { icon: Milestone, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    default: { icon: Activity, color: 'text-gray-600', bg: 'bg-gray-100' },
};

export function ProjectTimeline({ projectId, events: initialEvents, summary: initialSummary }: TimelineProps) {
    const [events, setEvents] = useState<TimelineEvent[]>(initialEvents || []);
    const [summary, setSummary] = useState(initialSummary);
    const [loading, setLoading] = useState(!initialEvents);
    const [filter, setFilter] = useState<string | null>(null);

    const fetchTimeline = useCallback(async () => {
        try {
            const res = await fetch(`/api/projects/${projectId}/timeline?limit=50`);
            if (res.ok) {
                const data = await res.json();
                setEvents(data.events || []);
                setSummary(data.summary);
            }
        } catch (error) {
            console.error('Failed to fetch timeline:', error);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        if (initialEvents) {
            setEvents(initialEvents);
            setSummary(initialSummary);
            setLoading(false);
            return;
        }
        void fetchTimeline();
    }, [fetchTimeline, initialEvents, initialSummary]);

    const filteredEvents = filter
        ? events.filter(e => e.type === filter)
        : events;

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (24 * 3600 * 1000));

        if (diffDays === 0) {
            return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return '昨天';
        } else if (diffDays < 7) {
            return `${diffDays}天前`;
        } else {
            return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex gap-4">
                            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                            <div className="flex-1">
                                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* 头部 */}
            <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">项目时间线</h3>
                    <div className="flex items-center gap-2">
                        {summary && (
                            <div className="flex items-center gap-4 text-xs text-gray-500 mr-4">
                                <span>{summary.totalEvents} 事件</span>
                                <span>|</span>
                                <span>{summary.daysActive} 天活跃</span>
                            </div>
                        )}
                        <Button variant="outline" size="sm" className="gap-1">
                            <Filter className="w-4 h-4" />
                            筛选
                        </Button>
                    </div>
                </div>

                {/* 快速筛选 */}
                <div className="flex items-center gap-2 mt-3">
                    {['all', 'CALCULATION_DONE', 'DIAGNOSIS_DONE', 'REPORT_GENERATED'].map(type => (
                        <button
                            key={type}
                            onClick={() => setFilter(type === 'all' ? null : type)}
                            className={`px-3 py-1 rounded-full text-xs transition-colors ${(type === 'all' && !filter) || filter === type
                                    ? 'bg-primary-100 text-primary-700'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {type === 'all' ? '全部' :
                                type === 'CALCULATION_DONE' ? '计算' :
                                    type === 'DIAGNOSIS_DONE' ? '诊断' : '报告'}
                        </button>
                    ))}
                </div>
            </div>

            {/* 时间线 */}
            <div className="p-6 max-h-[500px] overflow-y-auto">
                {filteredEvents.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        暂无时间线记录
                    </div>
                ) : (
                    <div className="relative">
                        {/* 时间线 */}
                        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                        <div className="space-y-4">
                            {filteredEvents.map((event, index) => {
                                const config = eventTypeConfig[event.type] || eventTypeConfig.default;
                                const Icon = config.icon;

                                return (
                                    <motion.div
                                        key={event.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="relative flex gap-4"
                                    >
                                        {/* 图标 */}
                                        <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center z-10 ${event.isMilestone ? 'ring-2 ring-yellow-400' : ''
                                            }`}>
                                            <Icon className={`w-5 h-5 ${config.color}`} />
                                        </div>

                                        {/* 内容 */}
                                        <div className="flex-1 bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors cursor-pointer">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-medium text-gray-900">{event.title}</h4>
                                                        {event.isMilestone && (
                                                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
                                                                里程碑
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                                                    {event.tags && event.tags.length > 0 && (
                                                        <div className="flex gap-1 mt-2">
                                                            {event.tags.map(tag => (
                                                                <span key={tag} className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-400">
                                                        {formatDate(event.createdAt)}
                                                    </span>
                                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* 底部统计 */}
            {summary && (
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
                    <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                            <div className="text-xl font-bold text-gray-900">{summary.totalCalculations}</div>
                            <div className="text-xs text-gray-500">收益测算</div>
                        </div>
                        <div>
                            <div className="text-xl font-bold text-gray-900">{summary.totalDiagnoses}</div>
                            <div className="text-xs text-gray-500">诊断分析</div>
                        </div>
                        <div>
                            <div className="text-xl font-bold text-gray-900">{summary.totalReports}</div>
                            <div className="text-xs text-gray-500">报告生成</div>
                        </div>
                        <div>
                            <div className="text-xl font-bold text-gray-900">{summary.daysActive}</div>
                            <div className="text-xs text-gray-500">使用天数</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProjectTimeline;
