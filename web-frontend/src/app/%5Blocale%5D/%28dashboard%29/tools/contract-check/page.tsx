'use client';

import { ContractChecker } from "@/components/tools/ContractChecker";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ContractCheckPage() {
    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-8 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    返回控制台
                </Link>

                <div className="mb-8">
                    <span className="text-indigo-600 font-bold tracking-wider text-xs uppercase mb-2 block">AI Tools</span>
                    <h1 className="text-3xl font-black text-slate-900">合同避坑助手</h1>
                    <p className="text-slate-500 mt-2">不要让文字游戏偷走你的阳光收益</p>
                </div>

                <ContractChecker />

                <div className="mt-12 text-center text-slate-400 text-xs max-w-lg mx-auto leading-relaxed">
                    <p>免责声明：AI 分析结果仅供参考，不构成法律意见。重大合同签署前建议咨询专业律师或当地能源局。</p>
                </div>
            </div>
        </div>
    );
}
