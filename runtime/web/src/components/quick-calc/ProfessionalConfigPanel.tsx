'use client';

import React from 'react';
import {
    Settings2,
    CloudRain,
    Zap,
    TrendingUp,
    ShieldCheck,
    ChevronRight,
    HelpCircle,
    Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfigSectionProps {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
}

const ConfigSection = ({ title, icon: Icon, children }: ConfigSectionProps) => (
    <div className="space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 bg-slate-50 rounded-xl text-slate-900">
                <Icon className="w-5 h-5" />
            </div>
            <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">{title}</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {children}
        </div>
    </div>
);

const InputField = ({ label, value, unit, hint }: { label: string, value: string, unit: string, hint?: string }) => (
    <div className="space-y-2 group">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span className="group-hover:text-slate-900 transition-colors">{label}</span>
        </div>
        <div className="relative">
            <span
                className="absolute -top-6 right-0 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-help"
                title={hint}
            >
                <HelpCircle className="w-3 h-3" />
            </span>
            <input
                type="text"
                defaultValue={value}
                className="w-full bg-slate-50 border-2 border-transparent focus:border-green-500 focus:bg-white p-4 rounded-2xl font-black text-slate-900 outline-none transition-all"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 pointer-events-none">
                {unit}
            </span>
        </div>
    </div>
);

export default function ProfessionalConfigPanel({ type }: { type: string }) {
    return (
        <div className="bg-white rounded-[48px] border-2 border-slate-900 p-8 md:p-12 shadow-2xl space-y-12 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">
                        专业工程参数 <span className="text-green-500">精细化配置</span>
                    </h3>
                    <p className="text-slate-400 font-bold text-sm">调整关键工程与财务假设，并保留参数版本供专业人员复核</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">
                    <ShieldCheck className="w-3 h-3 text-green-500" />
                    参数版本可追溯
                </div>
            </div>

            {/* Financial Parameters */}
            <ConfigSection title="财务与经济模型" icon={TrendingUp}>
                <InputField label="折现率 (Discount Rate)" value="8.0" unit="%" hint="用于计算 NPV 的加权平均资本成本" />
                <InputField label="贷款比例 (LTV)" value="70" unit="%" hint="项目融资贷款占比" />
                <InputField label="贷款利率" value="4.35" unit="%" hint="银行贷款年利率" />
                <InputField label="融资期限" value="15" unit="年" hint="还款周期设定" />
            </ConfigSection>

            {/* Meteorological Parameters */}
            <ConfigSection title="气象与环境损耗" icon={CloudRain}>
                <InputField label="年总辐射量" value="1450" unit="kWh/㎡" hint="基于 34 年历史气象站平均数据" />
                <InputField label="组件表面最高温度" value="65" unit="℃" />
                <InputField label="灰尘遮挡损失" value="3.0" unit="%" />
                <InputField label="积雪损失系数" value="0.5" unit="%" />
            </ConfigSection>

            {/* Technical Parameters */}
            <ConfigSection title="设备与工程性能" icon={Zap}>
                <InputField label="逆变器最高效率" value="98.7" unit="%" />
                <InputField label="系统容配比" value="1.2" unit="Ratio" hint="DC/AC 功率比" />
                <InputField label="组件首年衰减" value="2.0" unit="%" />
                <InputField label="逐年功率衰减" value="0.55" unit="%" />
            </ConfigSection>

            <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-2 text-slate-400 font-bold text-xs italic">
                    <Info className="w-4 h-4" />
                    注：修改后将实时重新运行 25 年现金流 Monte Carlo 模拟
                </div>
                <button className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-green-600 transition-all shadow-xl shadow-slate-200">
                    应用参数并重算 🚀
                </button>
            </div>
        </div>
    );
}
