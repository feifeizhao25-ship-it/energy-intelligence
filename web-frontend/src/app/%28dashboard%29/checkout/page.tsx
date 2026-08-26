'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck,
    CreditCard,
    CheckCircle2,
    Loader2,
    ArrowLeft,
    ChevronRight,
    Info,
    Zap,
    Lock
} from 'lucide-react';
import Image from 'next/image';

const PLANS_DATA = {
    PRO: { name: '专业版', monthly: 99, yearly: 999, originalYearly: 1188 },
    MAINTENANCE: { name: '运维版', monthly: 199, yearly: 1999, originalYearly: 2388 },
    FULL: { name: '全能版', monthly: 299, yearly: 2999, originalYearly: 3588 },
};

export default function CheckoutPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const planId = searchParams.get('plan') as keyof typeof PLANS_DATA;
    const billing = searchParams.get('billing') || 'yearly';

    const [method, setMethod] = useState<'wechat' | 'alipay'>('wechat');
    const [isProcessing, setIsProcessing] = useState(false);
    const [step, setStep] = useState(1); // 1: confirm, 2: scan, 3: success

    const plan = PLANS_DATA[planId] || PLANS_DATA.PRO;
    const price = billing === 'yearly' ? plan.yearly : plan.monthly;
    const originalPrice = billing === 'yearly' ? plan.originalYearly : null;

    const handlePay = () => {
        setIsProcessing(true);
        setTimeout(() => {
            setIsProcessing(false);
            setStep(2);
        }, 1500);
    };

    const handleComplete = () => {
        setStep(3);
        setTimeout(() => {
            router.push('/dashboard');
        }, 3000);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
            {/* Top Nav */}
            <nav className="bg-white border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
                    <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold">
                        <ArrowLeft className="w-5 h-5" />
                        返回
                    </button>
                    <div className="flex items-center gap-2">
                        <Zap className="w-6 h-6 text-blue-600" />
                        <span className="font-black text-xl tracking-tight">结算中心</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                        <Lock className="w-3.5 h-3.5" />
                        SSL 加密安全支付
                    </div>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Left: Summary & Payment (Col 1-2) */}
                <div className="lg:col-span-2 space-y-8">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-8"
                            >
                                {/* Plan Selection Card */}
                                <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                                    <h2 className="text-xl font-black mb-6 flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</span>
                                        确认订阅方案
                                    </h2>
                                    <div className="flex items-center justify-between p-6 rounded-2xl bg-slate-50 border border-slate-100">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                                                <Zap className="w-8 h-8 text-white" />
                                            </div>
                                            <div>
                                                <div className="text-lg font-black">{plan.name}</div>
                                                <div className="text-slate-500 text-sm">{billing === 'yearly' ? '按年订阅 (最具性价比)' : '按月计费'}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-black text-blue-600">¥{price}</div>
                                            {originalPrice && (
                                                <div className="text-slate-400 text-sm line-through">¥{originalPrice}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Method */}
                                <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                                    <h2 className="text-xl font-black mb-6 flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">2</span>
                                        选择支付方式
                                    </h2>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setMethod('wechat')}
                                            className={`relative p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${method === 'wechat' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-100 hover:border-slate-200'
                                                }`}
                                        >
                                            <Image src="https://img.icons8.com/color/96/weixing.png" width={40} height={40} alt="WeChat" />
                                            <span className="font-bold text-slate-700">微信支付</span>
                                            {method === 'wechat' && (
                                                <div className="absolute top-3 right-3 text-blue-600">
                                                    <CheckCircle2 className="w-5 h-5 fill-current text-white bg-blue-600 rounded-full" />
                                                </div>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setMethod('alipay')}
                                            className={`relative p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${method === 'alipay' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-100 hover:border-slate-200'
                                                }`}
                                        >
                                            <Image src="https://img.icons8.com/color/96/alipay.png" width={40} height={40} alt="Alipay" />
                                            <span className="font-bold text-slate-700">支付宝</span>
                                            {method === 'alipay' && (
                                                <div className="absolute top-3 right-3 text-blue-600">
                                                    <CheckCircle2 className="w-5 h-5 fill-current text-white bg-blue-600 rounded-full" />
                                                </div>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex gap-4 p-5 rounded-2xl bg-amber-50 border border-amber-100">
                                    <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-amber-800 text-sm leading-relaxed">
                                        本系统目前处于生产演练阶段，点击支付将进行<b>模拟支付流程</b>。不会产生真实费用。
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white rounded-[2rem] border border-slate-200 p-12 text-center shadow-lg"
                            >
                                <div className="space-y-6">
                                    <div className="text-lg font-bold">请使用{method === 'wechat' ? '微信' : '支付宝'}扫码支付</div>
                                    <div className="w-64 h-64 bg-slate-100 mx-auto rounded-3xl flex items-center justify-center border-4 border-slate-50 relative overflow-hidden group">
                                        {/* Placeholder for QR Code */}
                                        <div className="absolute inset-0 bg-blue-600/5 group-hover:bg-transparent transition-colors"></div>
                                        <Image
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=MOCK_PAY_${Date.now()}`}
                                            width={200}
                                            height={200}
                                            alt="QR Code"
                                            className="relative z-10"
                                        />
                                    </div>
                                    <div className="text-3xl font-black text-blue-600">¥{price}.00</div>
                                    <div className="text-slate-400 text-sm flex items-center justify-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        正在等待支付结果反馈...
                                    </div>
                                    <button
                                        onClick={handleComplete}
                                        className="mt-8 px-10 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                                    >
                                        模拟支付成功
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white rounded-[2rem] border border-slate-200 p-20 text-center shadow-xl space-y-6"
                            >
                                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                                    <CheckCircle2 className="w-12 h-12" />
                                </div>
                                <h2 className="text-4xl font-black">支付成功！</h2>
                                <p className="text-lg text-slate-500 max-w-sm mx-auto">
                                    欢迎您的加入。您的 {plan.name} 已立即生效，现在即可使用全部高级功能。
                                </p>
                                <div className="pt-8 text-slate-400 text-sm">
                                    正在为您跳转至仪表板...
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Right: Order Summary */}
                <div className="space-y-8">
                    <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm sticky top-28">
                        <h3 className="font-black text-lg mb-6">订单小计</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between text-slate-600">
                                <span>{plan.name} - {billing === 'yearly' ? '年度' : '月度'}方案</span>
                                <span>¥{originalPrice || price}</span>
                            </div>
                            {originalPrice && (
                                <div className="flex justify-between text-emerald-600">
                                    <span>年度优惠 (17% OFF)</span>
                                    <span>-¥{originalPrice - price}</span>
                                </div>
                            )}
                            <div className="h-px bg-slate-100 my-4"></div>
                            <div className="flex justify-between items-end">
                                <span className="font-black text-lg">应付总额</span>
                                <span className="text-3xl font-black text-blue-600">¥{price}</span>
                            </div>
                        </div>

                        <button
                            onClick={handlePay}
                            disabled={isProcessing || step !== 1}
                            className="w-full mt-8 bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-200 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                <>
                                    立即支付
                                    <ChevronRight className="w-5 h-5" />
                                </>
                            )}
                        </button>

                        <div className="mt-8 space-y-4">
                            <div className="flex items-center gap-3 text-slate-500 text-xs font-bold uppercase tracking-widest leading-loose">
                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                7天无理由退款保障
                            </div>
                            <div className="flex items-center gap-3 text-slate-500 text-xs font-bold uppercase tracking-widest leading-loose">
                                <CreditCard className="w-4 h-4 text-blue-500" />
                                开具增值税普票/专票
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
