'use client';

// NextStepsPanel - 下一步推荐面板
// 显示当前阶段、推荐动作、任务清单

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronRight,
    ChevronDown,
    Check,
    Sparkles,
    ArrowRight,
    Lock,
    Loader2,
} from 'lucide-react';
import Link from 'next/link';
import type { OrchestratorResponse, ActionCard, ChecklistItem } from '@/lib/orchestrator/types';

interface NextStepsPanelProps {
    projectId: string;
    className?: string;
    compact?: boolean;
}

export function NextStepsPanel({ projectId, className = '', compact = false }: NextStepsPanelProps) {
    const [data, setData] = useState<OrchestratorResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showChecklist, setShowChecklist] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                const res = await fetch(`/api/orchestrator?projectId=${projectId}`);
                if (!res.ok) throw new Error('获取数据失败');
                const json = await res.json();
                setData(json);
            } catch (err) {
                setError(err instanceof Error ? err.message : '加载失败');
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [projectId]);

    if (loading) {
        return (
            <div className={`p-6 bg-white rounded-xl border border-gray-100 ${className}`}>
                <div className="flex items-center justify-center gap-2 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>分析中...</span>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className={`p-6 bg-white rounded-xl border border-gray-100 ${className}`}>
                <p className="text-gray-500 text-center">{error || '暂无数据'}</p>
            </div>
        );
    }

    const topActions = data.recommendedActions.slice(0, compact ? 2 : 3);

    return (
        <div className={`bg-white rounded-xl border border-gray-100 overflow-hidden ${className}`}>
            {/* 阶段标识 */}
            <div className="px-6 py-4 bg-gradient-to-r from-primary-50 to-white border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{data.stageMeta.icon}</span>
                        <div>
                            <h3 className="font-semibold text-gray-900">{data.stageMeta.name}</h3>
                            {data.stageConfidence < 0.8 && (
                                <p className="text-xs text-gray-500">可能处于此阶段</p>
                            )}
                        </div>
                    </div>
                    <StageBadge stage={data.stage} color={data.stageMeta.color} />
                </div>
            </div>

            {/* 推荐动作 */}
            <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>推荐下一步</span>
                </div>

                <AnimatePresence>
                    {topActions.map((action, index) => (
                        <ActionCardComponent
                            key={action.id}
                            action={action}
                            index={index}
                        />
                    ))}
                </AnimatePresence>

                {data.recommendedActions.length > (compact ? 2 : 3) && (
                    <Link
                        href={`/projects/${projectId}/next-steps`}
                        className="flex items-center justify-center gap-1 text-sm text-primary-600 hover:text-primary-700 py-2"
                    >
                        <span>查看全部 {data.recommendedActions.length} 项建议</span>
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                )}
            </div>

            {/* 任务清单（可折叠） */}
            {!compact && data.checklist.length > 0 && (
                <div className="border-t border-gray-100">
                    <button
                        onClick={() => setShowChecklist(!showChecklist)}
                        className="w-full px-6 py-3 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50"
                    >
                        <span>阶段任务清单 ({data.checklist.filter(i => i.done).length}/{data.checklist.length})</span>
                        {showChecklist ? (
                            <ChevronDown className="w-4 h-4" />
                        ) : (
                            <ChevronRight className="w-4 h-4" />
                        )}
                    </button>

                    <AnimatePresence>
                        {showChecklist && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="px-6 pb-4 space-y-2"
                            >
                                {data.checklist.map(item => (
                                    <ChecklistItemComponent key={item.key} item={item} />
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}

// 阶段标识组件
function StageBadge({ stage, color }: { stage: string; color: string }) {
    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-100 text-blue-700',
        green: 'bg-green-100 text-green-700',
        amber: 'bg-amber-100 text-amber-700',
        purple: 'bg-purple-100 text-purple-700',
        indigo: 'bg-indigo-100 text-indigo-700',
        orange: 'bg-orange-100 text-orange-700',
        teal: 'bg-teal-100 text-teal-700',
        red: 'bg-red-100 text-red-700',
        slate: 'bg-slate-100 text-slate-700',
        cyan: 'bg-cyan-100 text-cyan-700',
    };

    return (
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${colorClasses[color] || colorClasses.blue}`}>
            {stage}
        </span>
    );
}

// 动作卡片组件
function ActionCardComponent({ action, index }: { action: ActionCard; index: number }) {
    const priorityColors = {
        1: 'border-l-primary-500 bg-primary-50/30',
        2: 'border-l-amber-500 bg-amber-50/30',
        3: 'border-l-gray-300 bg-gray-50/30',
    };

    const getHref = () => {
        if (action.cta.type === 'NAVIGATE') return action.cta.target;
        if (action.cta.type === 'OPEN_MODAL') return `?modal=${action.cta.target}`;
        return '#';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
        >
            <Link
                href={getHref()}
                className={`
          block p-4 rounded-lg border-l-4 transition-all
          hover:shadow-md hover:-translate-y-0.5
          ${priorityColors[action.priority]}
        `}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900 truncate">{action.title}</h4>
                            {action.requiresPlan && (
                                <Lock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                            {action.description}
                        </p>
                        {action.rationale && (
                            <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                {action.rationale.summary}
                            </p>
                        )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                </div>
            </Link>
        </motion.div>
    );
}

// 任务清单项组件
function ChecklistItemComponent({ item }: { item: ChecklistItem }) {
    const content = (
        <div className={`
      flex items-center gap-3 py-2 px-3 rounded-lg text-sm
      ${item.done
                ? 'text-gray-400 line-through'
                : item.recommended
                    ? 'text-gray-900 bg-amber-50'
                    : 'text-gray-600'
            }
    `}>
            <div className={`
        w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
        ${item.done
                    ? 'border-green-500 bg-green-500'
                    : 'border-gray-300'
                }
      `}>
                {item.done && <Check className="w-3 h-3 text-white" />}
            </div>
            <span>{item.label}</span>
            {item.recommended && !item.done && (
                <span className="ml-auto text-xs text-amber-600 font-medium">推荐</span>
            )}
        </div>
    );

    if (item.link && !item.done) {
        return <Link href={item.link}>{content}</Link>;
    }
    return content;
}

export default NextStepsPanel;
