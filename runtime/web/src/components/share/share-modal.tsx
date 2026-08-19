'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Share2,
    Copy,
    Check,
    MessageCircle,
    Download,
    QrCode,
    Link2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShareModalProps {
    open: boolean;
    onClose: () => void;
    result?: {
        totalRevenue: number;
        investment: number;
        paybackYears: number;
        netProfit: number;
        annualGeneration: number;
        capacity: number;
        location?: { city: string };
    };
    shareUrl?: string;
    title?: string;
}

/**
 * ShareModal 组件
 * 分享弹窗，支持复制链接、生成海报、微信分享等
 */
export function ShareModal({
    open,
    onClose,
    result,
    shareUrl = typeof window !== 'undefined' ? window.location.href : '',
    title = '我的光伏收益测算结果',
}: ShareModalProps) {
    const [copied, setCopied] = useState(false);
    const [generating, setGenerating] = useState(false);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    const handleGeneratePoster = async () => {
        setGenerating(true);
        try {
            // TODO: 实现海报生成逻辑
            await new Promise(resolve => setTimeout(resolve, 1000));
            // 生成完成后下载
        } catch (error) {
            console.error('Failed to generate poster:', error);
        } finally {
            setGenerating(false);
        }
    };

    const handleWechatShare = () => {
        // 微信分享需要通过微信JS-SDK
        // 这里提供一个提示
        alert('请使用微信扫描二维码分享');
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* 背景遮罩 */}
                    <motion.div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* 弹窗内容 */}
                    <motion.div
                        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto"
                        initial={{ opacity: 0, scale: 0.95, y: '-45%' }}
                        animate={{ opacity: 1, scale: 1, y: '-50%' }}
                        exit={{ opacity: 0, scale: 0.95, y: '-45%' }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                            {/* 头部 */}
                            <div className="relative p-4 border-b border-gray-100">
                                <h2 className="text-lg font-semibold text-center text-gray-900">
                                    分享测算结果
                                </h2>
                                <button
                                    onClick={onClose}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            {/* 预览卡片 */}
                            {result && (
                                <div className="p-4 bg-gradient-to-br from-primary-500 to-primary-600 mx-4 mt-4 rounded-xl text-white">
                                    <p className="text-primary-100 text-sm mb-1">
                                        📍 {result.location?.city || '计算结果'} · {result.capacity}kW
                                    </p>
                                    <p className="text-2xl font-bold mb-2">
                                        25年预计收益 ¥{(result.totalRevenue / 10000).toFixed(1)}万
                                    </p>
                                    <div className="flex items-center gap-4 text-sm text-primary-100">
                                        <span>投资 ¥{(result.investment / 10000).toFixed(1)}万</span>
                                        <span>·</span>
                                        <span>{result.paybackYears}年回本</span>
                                        <span>·</span>
                                        <span>净赚 ¥{(result.netProfit / 10000).toFixed(0)}万</span>
                                    </div>
                                </div>
                            )}

                            {/* 分享方式 */}
                            <div className="p-4 space-y-3">
                                {/* 复制链接 */}
                                <button
                                    onClick={handleCopyLink}
                                    className={cn(
                                        'w-full flex items-center gap-3 p-3 rounded-xl border transition-all',
                                        copied
                                            ? 'bg-green-50 border-green-200 text-green-700'
                                            : 'bg-gray-50 border-gray-100 text-gray-700 hover:bg-gray-100'
                                    )}
                                >
                                    <div className={cn(
                                        'w-10 h-10 rounded-xl flex items-center justify-center',
                                        copied ? 'bg-green-100' : 'bg-white'
                                    )}>
                                        {copied ? (
                                            <Check className="w-5 h-5 text-green-600" />
                                        ) : (
                                            <Link2 className="w-5 h-5 text-gray-600" />
                                        )}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="font-medium">
                                            {copied ? '已复制!' : '复制链接'}
                                        </p>
                                        <p className="text-xs text-gray-500 truncate max-w-[200px]">
                                            {shareUrl}
                                        </p>
                                    </div>
                                    <Copy className="w-4 h-4 text-gray-400" />
                                </button>

                                {/* 生成海报 */}
                                <button
                                    onClick={handleGeneratePoster}
                                    disabled={generating}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-all disabled:opacity-50"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
                                        {generating ? (
                                            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Download className="w-5 h-5 text-gray-600" />
                                        )}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="font-medium">
                                            {generating ? '生成中...' : '保存为图片'}
                                        </p>
                                        <p className="text-xs text-gray-500">生成精美分享海报</p>
                                    </div>
                                </button>

                                {/* 微信分享 */}
                                <button
                                    onClick={handleWechatShare}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-all"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
                                        <MessageCircle className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="font-medium">分享到微信</p>
                                        <p className="text-xs text-gray-500">发送给微信好友</p>
                                    </div>
                                </button>
                            </div>

                            {/* 底部提示 */}
                            <div className="p-4 pt-0 text-center">
                                <p className="text-xs text-gray-400">
                                    分享给好友，一起了解新能源收益
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

/**
 * ShareButton 组件
 * 分享按钮触发器
 */
export function ShareButton({
    onClick,
    className,
}: {
    onClick: () => void;
    className?: string;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex items-center gap-2 px-4 py-2',
                'bg-primary-500 text-white rounded-full',
                'hover:bg-primary-600 transition-colors',
                className
            )}
        >
            <Share2 className="w-4 h-4" />
            <span>分享结果</span>
        </button>
    );
}
