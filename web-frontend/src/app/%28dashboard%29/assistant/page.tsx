'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { Sparkles, Send, Paperclip, Mic, Settings2, Copy, RefreshCw, Loader2, FileText, Image as ImageIcon, AlertCircle } from 'lucide-react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isStreaming?: boolean;
}

const quickPrompts = [
    { icon: '☀️', text: '分析我的光伏项目收益', category: '收益分析' },
    { icon: '🔋', text: '储能系统容量配置建议', category: '系统设计' },
    { icon: '🌍', text: '最新新能源政策解读', category: '政策咨询' },
    { icon: '📊', text: '对比不同组件的性价比', category: '设备选型' },
];

const knowledgeCards = [
    {
        title: 'LCOE',
        color: 'primary',
        desc: 'Levelized Cost of Energy (平准化度电成本)。是对项目生命周期内的总成本和总发电量进行折现后的比值。',
        trend: '-5.2% YoY'
    },
    {
        title: '双面组件',
        color: 'purple',
        desc: '利用背面接收地面反射光进行发电的光伏组件。在沙漠等高反射率场景下，发电增益可达 10%-25%。',
    },
    {
        title: '跟踪支架',
        color: 'orange',
        desc: '通过实时调整组件角度以追踪太阳位置，增加直射辐射接收量。可提升 15%-20% 发电量。',
    },
];

export default function AssistantPage() {
    const { data: session } = useSession() as any;
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: '您好！我是新能源智库 AI 专家 🌱\n\n我可以帮您：\n• 光伏/风电/储能项目收益测算\n• 技术方案对比与优化建议\n• 政策解读与补贴咨询\n• 设备选型与性价比分析\n\n请告诉我您的需求，或选择下方快捷问题开始对话。',
            timestamp: new Date(),
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (text?: string) => {
        const messageText = text || inputValue.trim();
        if (!messageText || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);
        setError(null);

        // 创建 AI 消息占位符
        const aiMessageId = (Date.now() + 1).toString();
        const aiMessage: Message = {
            id: aiMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isStreaming: true
        };
        setMessages(prev => [...prev, aiMessage]);

        try {
            abortControllerRef.current = new AbortController();

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    isAssistant: true
                }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) {
                throw new Error('AI 服务暂时不可用');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;

                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.type === 'content') {
                                    accumulatedContent += parsed.data;
                                    setMessages(prev => prev.map(m =>
                                        m.id === aiMessageId
                                            ? { ...m, content: accumulatedContent }
                                            : m
                                    ));
                                } else if (parsed.type === 'error') {
                                    throw new Error(parsed.data.message);
                                }
                            } catch (e) {
                                // 忽略解析错误
                            }
                        }
                    }
                }
            }

            // 完成流式传输
            setMessages(prev => prev.map(m =>
                m.id === aiMessageId
                    ? { ...m, isStreaming: false }
                    : m
            ));

        } catch (err: any) {
            if (err.name === 'AbortError') return;

            setError(err.message || 'AI 响应失败');
            setMessages(prev => prev.filter(m => m.id !== aiMessageId));
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content);
    };

    const handleRegenerate = () => {
        if (messages.length >= 2) {
            const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
            if (lastUserMessage) {
                setMessages(prev => prev.slice(0, -1));
                handleSend(lastUserMessage.content);
            }
        }
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background-dark text-white">
            {/* Left Sidebar: History & Attachments */}
            <aside className="w-80 bg-surface-dark border-r border-border-dark flex-col shrink-0 overflow-hidden hidden md:flex">
                {/* Upload Area */}
                <div className="p-4 border-b border-border-dark">
                    <div className="rounded-xl bg-background-dark border border-dashed border-border-dark p-4 group hover:border-primary/50 transition-colors cursor-pointer">
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="w-10 h-10 rounded-full bg-surface-dark flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Paperclip className="w-5 h-5 text-text-secondary group-hover:text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">上传文件</p>
                                <p className="text-xs text-text-secondary mt-1">支持 PDF / Excel / 图片</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* History List */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">最近对话</p>
                    </div>
                    <div className="space-y-2">
                        <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                            <p className="text-sm font-medium text-white truncate">当前对话</p>
                            <p className="text-xs text-text-secondary mt-1">刚刚</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Chat Interface */}
            <main className="flex-1 flex flex-col bg-background-dark relative min-w-0">
                {/* Header */}
                <div className="border-b border-border-dark px-6 py-4 bg-surface-dark/50 backdrop-blur">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-white">AI 能源专家</h1>
                                <p className="text-xs text-text-secondary">专业的新能源项目分析助手</p>
                            </div>
                        </div>
                        <button className="p-2 rounded-lg hover:bg-surface-dark transition-colors">
                            <Settings2 className="w-5 h-5 text-text-secondary" />
                        </button>
                    </div>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-32">
                    {messages.length === 1 && (
                        <div className="max-w-3xl mx-auto">
                            <div className="grid grid-cols-2 gap-3 mb-8">
                                {quickPrompts.map((prompt, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSend(prompt.text)}
                                        className="p-4 rounded-2xl bg-surface-dark border border-border-dark hover:border-primary/50 text-left transition-all group"
                                    >
                                        <div className="text-2xl mb-2">{prompt.icon}</div>
                                        <p className="text-sm font-medium text-white group-hover:text-primary transition-colors">{prompt.text}</p>
                                        <p className="text-xs text-text-secondary mt-1">{prompt.category}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <div key={msg.id} className={cn("flex gap-4 max-w-4xl", msg.role === 'user' ? "ml-auto" : "mr-auto")}>
                            {/* Avatar */}
                            <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                msg.role === 'user'
                                    ? "bg-primary text-white font-bold order-2"
                                    : "bg-surface-dark border border-border-dark text-primary"
                            )}>
                                {msg.role === 'user' ? (
                                    <span>{session?.user?.name?.[0] || 'U'}</span>
                                ) : (
                                    <Sparkles className="w-5 h-5" />
                                )}
                            </div>

                            {/* Content */}
                            <div className={cn("flex flex-col gap-2 flex-1", msg.role === 'user' ? "items-end" : "items-start")}>
                                {msg.role === 'assistant' && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-white">AI 专家</span>
                                        <span className="text-xs text-text-secondary bg-surface-dark px-2 py-0.5 rounded">智能分析</span>
                                    </div>
                                )}
                                <div className={cn(
                                    "p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap max-w-2xl",
                                    msg.role === 'user'
                                        ? "bg-primary text-white rounded-tr-sm"
                                        : "bg-surface-dark border border-border-dark text-white rounded-tl-sm"
                                )}>
                                    {msg.content}
                                    {msg.isStreaming && (
                                        <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
                                    )}
                                </div>

                                {/* Action Buttons */}
                                {msg.role === 'assistant' && !msg.isStreaming && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleCopy(msg.content)}
                                            className="p-2 rounded-lg bg-surface-dark border border-border-dark hover:border-primary/50 transition-colors"
                                        >
                                            <Copy className="w-4 h-4 text-text-secondary" />
                                        </button>
                                        <button
                                            onClick={handleRegenerate}
                                            className="p-2 rounded-lg bg-surface-dark border border-border-dark hover:border-primary/50 transition-colors"
                                        >
                                            <RefreshCw className="w-4 h-4 text-text-secondary" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {error && (
                        <div className="max-w-4xl mx-auto p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-red-400" />
                            <p className="text-sm text-red-300">{error}</p>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background-dark via-background-dark to-transparent">
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-surface-dark/90 backdrop-blur-md border border-border-dark rounded-2xl p-2 shadow-2xl">
                            <textarea
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                className="w-full bg-transparent border-none text-white placeholder-text-secondary focus:ring-0 resize-none py-3 px-4 min-h-[52px] outline-none"
                                placeholder="输入您的问题，或描述分析需求..."
                                rows={1}
                                disabled={isLoading}
                            />
                            <div className="flex items-center justify-between px-2 pb-1">
                                <div className="flex items-center gap-1">
                                    <button className="p-2 rounded-lg text-text-secondary hover:bg-background-dark hover:text-primary transition-colors">
                                        <Paperclip className="w-5 h-5" />
                                    </button>
                                    <button className="p-2 rounded-lg text-text-secondary hover:bg-background-dark hover:text-primary transition-colors">
                                        <Mic className="w-5 h-5" />
                                    </button>
                                </div>
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!inputValue.trim() || isLoading}
                                    className={cn(
                                        "px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all",
                                        inputValue.trim() && !isLoading
                                            ? "bg-primary hover:bg-primary-600 text-white shadow-lg shadow-primary/20"
                                            : "bg-surface-dark text-text-secondary cursor-not-allowed"
                                    )}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            思考中
                                        </>
                                    ) : (
                                        <>
                                            发送
                                            <Send className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Right Sidebar: Knowledge Graph */}
            <aside className="w-80 bg-surface-dark border-l border-border-dark flex-col shrink-0 hidden xl:flex">
                <div className="p-4 border-b border-border-dark">
                    <h3 className="text-white text-base font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        知识图谱
                    </h3>
                    <p className="text-xs text-text-secondary mt-1">实时关联技术概念</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {knowledgeCards.map((card, i) => (
                        <div key={i} className="bg-background-dark rounded-xl border border-border-dark p-4 hover:border-primary/30 transition-colors">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className={cn(
                                        "w-1 h-4 rounded-full",
                                        card.color === 'primary' ? 'bg-primary' :
                                            card.color === 'purple' ? 'bg-purple-500' : 'bg-orange-500'
                                    )} />
                                    <h4 className="text-white font-bold text-sm">{card.title}</h4>
                                </div>
                            </div>
                            <p className="text-xs text-text-secondary leading-relaxed mb-3">
                                {card.desc}
                            </p>
                            {card.trend && (
                                <div className="bg-surface-dark rounded border border-border-dark p-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-text-secondary">行业趋势</span>
                                        <span className="text-xs text-green-400 font-mono">{card.trend}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </aside>
        </div>
    );
}
