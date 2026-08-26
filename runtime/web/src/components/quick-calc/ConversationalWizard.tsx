'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Zap,
    Wind,
    Battery,
    ArrowLeft,
    Sparkles,
    Check,
    ArrowRight,
    RefreshCw,
    Home,
    Factory,
    Sprout,
    ParkingCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceInput } from '../input/VoiceInput';

interface Message {
    id: string;
    type: 'bot' | 'user';
    content: string | React.ReactNode;
    delay?: number;
}

interface Option {
    id: string;
    label: string;
    value: string;
    icon?: any;
    hint?: string;
}

interface ConversationalWizardProps {
    type: 'solar' | 'wind' | 'storage';
    config: {
        title: string;
        questions: {
            id: string;
            botMessage: string;
            options?: Option[];
            inputType?: 'number' | 'text';
            placeholder?: string;
            unit?: string;
            hint?: string;
        }[];
    };
}

export default function ConversationalWizard({ type, config }: ConversationalWizardProps) {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [isTyping, setIsTyping] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    useEffect(() => {
        // Start initial conversation
        startQuestion(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startQuestion = async (index: number) => {
        if (index >= config.questions.length) {
            // End conversation, go to results
            handleFinish();
            return;
        }

        setIsTyping(true);
        setShowOptions(false);

        const question = config.questions[index];

        // Simulate thinking
        await new Promise(r => setTimeout(r, 1000));

        const newBotMsg: Message = {
            id: `bot-${question.id}`,
            type: 'bot',
            content: question.botMessage
        };

        setMessages(prev => [...prev, newBotMsg]);
        setIsTyping(false);

        // Show options after message
        setTimeout(() => {
            setShowOptions(true);
        }, 500);
    };

    const handleSelect = (option: Option) => {
        const question = config.questions[currentQuestionIndex];

        // Add user message
        const newUserMsg: Message = {
            id: `user-${question.id}`,
            type: 'user',
            content: option.label
        };

        setMessages(prev => [...prev, newUserMsg]);
        setAnswers(prev => ({ ...prev, [question.id]: option.value }));

        // Move to next
        const nextIndex = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIndex);
        startQuestion(nextIndex);
    };

    const handleInputSubmit = (value: string) => {
        const question = config.questions[currentQuestionIndex];

        const newUserMsg: Message = {
            id: `user-${question.id}`,
            type: 'user',
            content: `${value} ${question.unit || ''}`
        };

        setMessages(prev => [...prev, newUserMsg]);
        setAnswers(prev => ({ ...prev, [question.id]: value }));

        const nextIndex = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIndex);
        startQuestion(nextIndex);
    };

    const handleFinish = async () => {
        setIsTyping(true);
        await new Promise(r => setTimeout(r, 800));

        setMessages(prev => [...prev, {
            id: 'bot-final',
            type: 'bot',
            content: '太好了！我正在为您从 NASA 数据库调取 40 年间的历史气象数据，并计算最优方案...'
        }]);

        await new Promise(r => setTimeout(r, 2000));

        // Build calculation data based on answers
        const area = parseFloat(answers.area) || 100;
        const capacity = Math.round(area * 0.15); // ~150W per sqm
        const selfUseRatio = answers.mode === 'self-use' ? 70 : 0;

        // Create calculation request
        const calculationData = {
            lat: 39.9042,
            lng: 116.4074,
            capacity: capacity,
            province: '北京',
            projectName: `${answers.type === 'home' ? '住宅' : answers.type === 'commercial' ? '工厂' : '地面'}光伏项目`,
            installationType: answers.type === 'home' ? 'roof' : answers.type === 'carport' ? 'carport' : 'ground',
            moduleType: 'standard',
            selfUseRatio: selfUseRatio,
            electricityPrice: 0.85, // Default Beijing price - will be updated by API
            feedInTariff: 0.65 // Default Beijing price - will be updated by API
        };

        // Call API to get real calculation
        try {
            const response = await fetch('/api/calculate/solar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(calculationData)
            });
            const result = await response.json();

            if (result.success) {
                const resultWithMeta = {
                    ...result.data,
                    metadata: {
                        projectName: calculationData.projectName,
                        province: result.pricing.province,
                        capacity: calculationData.capacity
                    }
                };
                // Redirect to dashboard calculator result page with data
                router.push(`/calculator/result?type=solar&data=${encodeURIComponent(JSON.stringify(resultWithMeta))}`);
            }
        } catch (error) {
            console.error('Calculation error:', error);
            // Fallback to old result page
            router.push(`/quick-calc/result/${type}?${new URLSearchParams(answers).toString()}`);
        }
    };

    const themeColor = {
        solar: 'bg-amber-500',
        wind: 'bg-blue-500',
        storage: 'bg-emerald-500'
    }[type];

    const themeText = {
        solar: 'text-amber-500',
        wind: 'text-blue-500',
        storage: 'text-emerald-500'
    }[type];

    return (
        <div className="flex flex-col h-screen bg-[#F8FAFC]">
            {/* Header */}
            <header className="bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center justify-between px-6 py-5">
                    <button
                        onClick={() => router.push('/calculator')}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-bold text-sm tracking-tight">返回选择</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className={cn("p-1.5 rounded-lg shadow-sm", themeColor)}>
                            {type === 'solar' && <Zap className="text-white w-4 h-4" />}
                            {type === 'wind' && <Wind className="text-white w-4 h-4" />}
                            {type === 'storage' && <Battery className="text-white w-4 h-4" />}
                        </div>
                        <span className="font-black text-slate-900 tracking-tighter">{config.title}</span>
                    </div>

                    <div className="w-20 text-right text-sm font-bold text-slate-400">
                        {currentQuestionIndex < config.questions.length
                            ? `${currentQuestionIndex + 1}/${config.questions.length}`
                            : '完成'}
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1 bg-slate-100">
                    <div
                        className={cn("h-full transition-all duration-500 ease-out", themeColor)}
                        style={{
                            width: `${currentQuestionIndex >= config.questions.length
                                ? 100
                                : (currentQuestionIndex / config.questions.length) * 100}%`
                        }}
                    />
                </div>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto px-6 py-12">
                <div className="max-w-2xl mx-auto space-y-10">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex items-end gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500",
                                msg.type === 'user' ? "flex-row-reverse" : ""
                            )}
                        >
                            {/* Avatar */}
                            {msg.type === 'bot' && (
                                <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg", themeColor)}>
                                    <Sparkles className="text-white w-5 h-5" />
                                </div>
                            )}

                            {/* Message Bubble */}
                            <div className={cn(
                                "max-w-[85%] p-6 rounded-[32px] font-medium leading-relaxed shadow-sm",
                                msg.type === 'bot'
                                    ? "bg-white text-slate-800 border border-slate-50 rounded-bl-none"
                                    : "bg-slate-900 text-white rounded-br-none"
                            )}>
                                {msg.content}
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex items-end gap-3 animate-pulse">
                            <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0", themeColor)}>
                                <Sparkles className="text-white w-5 h-5" />
                            </div>
                            <div className="bg-white border border-slate-50 px-6 py-4 rounded-[24px] rounded-bl-none flex gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200 animate-bounce"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200 animate-bounce [animation-delay:0.2s]"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200 animate-bounce [animation-delay:0.4s]"></div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input/Action Area */}
            <div className="bg-white border-t border-slate-100 p-8 shrink-0 relative">
                <div className="absolute top-4 right-4 z-10">
                    <VoiceInput onTranscript={(text) => handleInputSubmit(text)} />
                </div>
                <div className="max-w-2xl mx-auto">
                    {showOptions && currentQuestionIndex < config.questions.length && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                            {/* Options Selection */}
                            {config.questions[currentQuestionIndex].options && (
                                <div className="grid grid-cols-2 gap-4">
                                    {config.questions[currentQuestionIndex].options?.map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => handleSelect(opt)}
                                            className="group flex flex-col items-start p-6 rounded-[32px] border-2 border-slate-50 hover:border-green-500 hover:bg-green-50/10 transition-all text-left bg-white shadow-sm"
                                        >
                                            <div className="flex items-center justify-between w-full mb-3">
                                                {opt.icon && (
                                                    <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-green-500 group-hover:text-white transition-colors">
                                                        <opt.icon className="w-5 h-5" />
                                                    </div>
                                                )}
                                                <Check className="w-5 h-5 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <span className="font-black text-slate-900 group-hover:text-green-600 transition-colors tracking-tight">
                                                {opt.label}
                                            </span>
                                            {opt.hint && (
                                                <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                                                    {opt.hint}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Number Input Selection */}
                            {config.questions[currentQuestionIndex].inputType === 'number' && (
                                <div className="space-y-6">
                                    <div className="flex flex-wrap gap-2">
                                        {[50, 80, 100, 150, 200, 500].map(val => (
                                            <button
                                                key={val}
                                                onClick={() => handleInputSubmit(String(val))}
                                                className="px-6 py-3 rounded-full bg-slate-50 hover:bg-slate-900 hover:text-white font-bold transition-all border border-slate-100"
                                            >
                                                {val} {config.questions[currentQuestionIndex].unit}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="relative group">
                                        <input
                                            type="number"
                                            placeholder={config.questions[currentQuestionIndex].placeholder || '输入具体数值...'}
                                            className="w-full bg-slate-50 p-6 rounded-[32px] border-2 border-transparent focus:border-green-500 focus:bg-white outline-none font-black text-xl transition-all"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleInputSubmit((e.target as HTMLInputElement).value);
                                            }}
                                            autoFocus
                                        />
                                        <button
                                            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white hover:bg-green-600 transition-all"
                                            onClick={(e) => {
                                                const input = (e.currentTarget.previousSibling as HTMLInputElement);
                                                if (input.value) handleInputSubmit(input.value);
                                            }}
                                        >
                                            <ArrowRight className="w-6 h-6" />
                                        </button>
                                    </div>

                                    {config.questions[currentQuestionIndex].hint && (
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <Sparkles className="w-4 h-4 text-amber-500" />
                                            <span className="text-xs font-medium">{config.questions[currentQuestionIndex].hint}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {!showOptions && currentQuestionIndex < config.questions.length && (
                        <div className="h-20 flex items-center justify-center">
                            <RefreshCw className="w-6 h-6 text-slate-100 animate-spin" />
                        </div>
                    )}

                    {currentQuestionIndex >= config.questions.length && (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <div className="relative w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="absolute top-0 left-0 h-full bg-green-500 animate-[loading_3s_ease-in-out_infinite]" style={{ width: '40%' }}></div>
                            </div>
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">
                                Analyzing Energy Potential...
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
        </div>
    );
}
