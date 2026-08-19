'use client';

import { motion } from 'framer-motion';
import { MessageCircle, Sparkles, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const quickQuestions = [
    '这个收益靠谱吗？',
    '贷款划算还是全款？',
    '找谁安装比较好？',
    '现在还有补贴吗？',
    '光伏板能用多少年？',
    '阴天还能发电吗？',
];

interface AIAssistantTeaserProps {
    className?: string;
    showTitle?: boolean;
    maxQuestions?: number;
}

/**
 * AIAssistantTeaser 组件
 * AI助手入口，展示常见问题快捷入口
 */
export function AIAssistantTeaser({
    className,
    showTitle = true,
    maxQuestions = 4,
}: AIAssistantTeaserProps) {
    const router = useRouter();

    const handleQuestionClick = (question: string) => {
        router.push(`/assistant?q=${encodeURIComponent(question)}`);
    };

    return (
        <motion.section
            className={cn('py-12 px-4', className)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
        >
            <div className="max-w-2xl mx-auto">
                {showTitle && (
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-100 rounded-full text-sm text-primary-700 mb-3">
                            <Sparkles className="w-4 h-4" />
                            <span>AI智能问答</span>
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                            有问题？问AI助手
                        </h2>
                        <p className="text-gray-500">
                            新能源领域专家，24小时在线解答
                        </p>
                    </div>
                )}

                {/* 问题快捷入口 */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-green-500 flex items-center justify-center">
                            <MessageCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-900">新能源智库AI助手</p>
                            <p className="text-xs text-gray-500">基于专业知识库，精准回答</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                        {quickQuestions.slice(0, maxQuestions).map((question) => (
                            <motion.button
                                key={question}
                                onClick={() => handleQuestionClick(question)}
                                className={cn(
                                    'px-3 py-2 bg-gray-50 hover:bg-gray-100',
                                    'rounded-full text-sm text-gray-600 hover:text-gray-900',
                                    'transition-colors duration-200'
                                )}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                {question}
                            </motion.button>
                        ))}
                    </div>

                    <button
                        onClick={() => router.push('/assistant')}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium transition-colors"
                    >
                        <span>开始对话</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </motion.section>
    );
}

/**
 * AIQuickAsk 组件
 * 嵌入式快速提问入口
 */
export function AIQuickAsk({ className }: { className?: string }) {
    const router = useRouter();

    return (
        <motion.div
            className={cn(
                'flex items-center gap-2 p-3 bg-gradient-to-r from-primary-50 to-green-50',
                'rounded-xl border border-primary-100 cursor-pointer',
                'hover:border-primary-200 transition-all duration-200',
                className
            )}
            whileHover={{ scale: 1.01 }}
            onClick={() => router.push('/assistant')}
        >
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                    有疑问？问AI助手
                </p>
                <p className="text-xs text-gray-500 truncate">
                    点击开始智能对话
                </p>
            </div>
            <ArrowRight className="w-4 h-4 text-primary-500 flex-shrink-0" />
        </motion.div>
    );
}
