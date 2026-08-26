'use client';

import { useState } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';

interface Message {
    id: string;
    role: 'user' | 'bot' | 'agent';
    content: string;
    timestamp: Date;
}

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'bot',
            content: '你好！我是新能源智库助手，有什么可以帮你的吗？\n\n你可以直接问我：\n• 怎么测算光伏收益\n• 政策补贴问题\n• 安装相关问题\n• 其他任何问题',
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');

    const quickQuestions = [
        '怎么看我的测算结果',
        '如何联系安装商',
        '报告怎么下载',
        '转人工客服',
    ];

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');

        // 判断是否需要转人工
        if (input.includes('人工') || input.includes('客服')) {
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'bot',
                    content: '正在为你转接人工客服，请稍等...',
                    timestamp: new Date(),
                }]);

                // 模拟人工接入
                setTimeout(() => {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'agent',
                        content: '你好，我是客服小王，很高兴为你服务！请问有什么可以帮你的？',
                        timestamp: new Date(),
                    }]);
                }, 2000);
            }, 1000);
            return;
        }

        // AI回复 (Stub)
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'bot',
                content: `你刚才问了 "${input}"，这是AI的自动回复。实际业务中，我会根据你的问题调用知识库回答。`,
                timestamp: new Date(),
            }]);
        }, 1000);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors z-[100]"
            >
                <MessageCircle className="w-6 h-6" />
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-80 md:w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[100] border border-gray-100">
            {/* 头部 */}
            <div className="bg-indigo-600 text-white p-4 flex items-center justify-between">
                <div>
                    <h3 className="font-semibold">在线客服</h3>
                    <p className="text-xs text-indigo-100">通常1分钟内回复</p>
                </div>
                <button onClick={() => setIsOpen(false)} className="hover:bg-indigo-500 rounded p-1 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex items-start gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm flex-shrink-0 ${message.role === 'user' ? 'bg-indigo-600' :
                                message.role === 'agent' ? 'bg-green-500' : 'bg-gray-200'
                            }`}>
                            {message.role === 'user' ? (
                                <User className="w-4 h-4 text-white" />
                            ) : message.role === 'agent' ? (
                                <User className="w-4 h-4 text-white" />
                            ) : (
                                <Bot className="w-4 h-4 text-gray-600" />
                            )}
                        </div>
                        <div className={`max-w-[75%] p-3 rounded-xl shadow-sm ${message.role === 'user'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white text-gray-800'
                            }`}>
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* 快捷问题 */}
            <div className="px-4 py-2 flex gap-2 overflow-x-auto border-t bg-white scrollbar-hide">
                {quickQuestions.map((q) => (
                    <button
                        key={q}
                        onClick={() => setInput(q)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs whitespace-nowrap hover:bg-gray-200 transition-colors"
                    >
                        {q}
                    </button>
                ))}
            </div>

            {/* 输入框 */}
            <div className="p-3 border-t bg-white">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="输入你的问题..."
                        className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                    <button
                        onClick={handleSend}
                        className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
