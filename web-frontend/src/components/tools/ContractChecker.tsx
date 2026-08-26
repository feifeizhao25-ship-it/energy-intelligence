'use client';

import { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, Loader2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function ContractChecker() {
    const [status, setStatus] = useState<'idle' | 'analyzing' | 'done'>('idle');
    const [fileName, setFileName] = useState('');
    const [progress, setProgress] = useState(0);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setStatus('analyzing');

        // 模拟分析过程
        let p = 0;
        const interval = setInterval(() => {
            p += Math.random() * 10;
            if (p > 100) {
                p = 100;
                clearInterval(interval);
                setStatus('done');
            }
            setProgress(Math.min(p, 100));
        }, 300);
    };

    return (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">AI 合同智能审查</h2>
                <p className="text-slate-500">上传光伏安装合同，AI 帮你识别隐藏的风险条款</p>
            </div>

            {/* Upload Area */}
            {status === 'idle' && (
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-indigo-500 hover:bg-slate-50 transition-all cursor-pointer relative group">
                    <input
                        type="file"
                        accept=".pdf,.doc,.docx" // Mock file types
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h3 className="font-bold text-slate-900 mb-1">点击上传或者是拖拽文件到这里</h3>
                    <p className="text-xs text-slate-400">支持 PDF, Word 格式 (最大 20MB)</p>
                </div>
            )}

            {/* Analyzing State */}
            {status === 'analyzing' && (
                <div className="py-12 text-center">
                    <div className="relative w-24 h-24 mx-auto mb-6">
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                            <circle
                                className="text-slate-100 stroke-current"
                                strokeWidth="8"
                                cx="50"
                                cy="50"
                                r="40"
                                fill="none"
                            />
                            <circle
                                className="text-indigo-600 progress-ring__circle stroke-current transition-all duration-300 ease-in-out"
                                strokeWidth="8"
                                strokeLinecap="round"
                                cx="50"
                                cy="50"
                                r="40"
                                fill="none"
                                strokeDasharray={`${2 * Math.PI * 40}`}
                                strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                                transform="rotate(-90 50 50)"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xl font-bold text-indigo-600">{Math.round(progress)}%</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-indigo-600 font-medium animate-pulse">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        AI 正在深度解析合同条款...
                    </div>
                    <p className="text-sm text-slate-400 mt-2">正在通过 OCR 识别文字并比对法律风险库</p>
                </div>
            )}

            {/* Result State */}
            {status === 'done' && (
                <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <FileText className="w-10 h-10 text-slate-400" />
                        <div className="flex-1">
                            <h4 className="font-bold text-slate-900">{fileName}</h4>
                            <p className="text-xs text-slate-500">解析完成 • 发现 3 个潜在风险点</p>
                        </div>
                        <button
                            onClick={() => setStatus('idle')}
                            className="text-sm text-indigo-600 font-bold hover:underline"
                        >
                            重新上传
                        </button>
                    </div>

                    <div className="space-y-4">
                        <RiskItem
                            level="high"
                            title="所有权归属不明"
                            desc="第3.2条提到'运营期内设备归乙方所有'，这可能实际上是租赁模式而非购买模式。"
                        />
                        <RiskItem
                            level="medium"
                            title="违约责任不对等"
                            desc="合同规定甲方违约金为总价20%，而乙方违约金仅为总价1%。"
                        />
                        <RiskItem
                            level="warning"
                            title="隐形维护费用"
                            desc="附件中提到'每年收取0.05元/度作为运维费'，主合同中未明确提及。"
                        />
                    </div>

                    <button className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        咨询律师获取详细建议
                    </button>
                </div>
            )}
        </div>
    );
}

function RiskItem({ level, title, desc }: { level: 'high' | 'medium' | 'warning', title: string, desc: string }) {
    const colors = {
        high: 'bg-red-50 border-red-100 text-red-700',
        medium: 'bg-orange-50 border-orange-100 text-orange-700',
        warning: 'bg-yellow-50 border-yellow-100 text-yellow-700'
    };

    const icons = {
        high: <XCircle className="w-5 h-5 text-red-500" />,
        medium: <AlertTriangle className="w-5 h-5 text-orange-500" />,
        warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />
    };

    return (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${colors[level]}`}>
            <div className="mt-0.5">{icons[level]}</div>
            <div>
                <h4 className="font-bold mb-1">{title}</h4>
                <p className="text-sm opacity-90 leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}
