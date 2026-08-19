'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    FileText,
    Shield,
    CheckSquare,
    User,
    Calendar,
    MapPin,
    AlertTriangle,
    Printer,
    Share2,
    Loader2
} from 'lucide-react';

const TASK_TYPES = [
    { id: 'cleaning', label: '组件清洗作业', risk: 'low' },
    { id: 'inspection', label: '例行巡检', risk: 'low' },
    { id: 'repair_inverter', label: '逆变器故障检修', risk: 'high' },
    { id: 'replace_module', label: '组件更换', risk: 'medium' },
    { id: 'high_voltage', label: '高压侧倒闸操作', risk: 'critical' },
];

const PRESET_MEASURES: Record<string, string[]> = {
    cleaning: ['检查清洗机器人电量', '佩戴防滑手套', '禁止踩踏组件边缘', '注意湿滑表面'],
    inspection: ['携带红外热像仪', '记录异常点位坐标', '检查接线盒密封性'],
    repair_inverter: ['断开直流侧开关', '断开交流侧断路器', '挂"禁止合闸"标识牌', '验电并挂接地线', '等待电容放电完毕(5分钟)'],
    high_voltage: ['严格执行操作票制度', '穿戴绝缘靴/绝缘手套', '实行监护人制度', '确认断路器分合状态'],
};

export default function WorkPermitGeneratorView() {
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'form' | 'preview'>('form');
    const [formData, setFormData] = useState({
        taskType: 'repair_inverter',
        location: '',
        leader: '',
        members: '',
        startTime: '',
        endTime: '',
    });

    const handleGenerate = async () => {
        setLoading(true);
        // Simulate AI generation delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        setLoading(false);
        setStep('preview');
    };

    const currentMeasures = PRESET_MEASURES[formData.taskType] || [];

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-[24px] border border-slate-100 p-8">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">智能工作票生成</h2>
                        <p className="text-sm text-slate-500">AI 自动关联风险点分析与安全措施</p>
                    </div>
                </div>

                {step === 'form' ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="max-w-3xl mx-auto"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">作业类型</label>
                                    <select
                                        value={formData.taskType}
                                        onChange={e => setFormData({ ...formData, taskType: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                    >
                                        {TASK_TYPES.map(t => (
                                            <option key={t.id} value={t.id}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">作业地点</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="例如：1# 方阵 A05 汇流箱"
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                            value={formData.location}
                                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">计划时间</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="datetime-local"
                                            className="w-full px-3 py-3 rounded-xl border border-slate-200 font-medium text-xs"
                                            value={formData.startTime}
                                            onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                        />
                                        <input
                                            type="datetime-local"
                                            className="w-full px-3 py-3 rounded-xl border border-slate-200 font-medium text-xs"
                                            value={formData.endTime}
                                            onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">工作负责人</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="姓名"
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">作业班组成员</label>
                                    <textarea
                                        rows={4}
                                        placeholder="输入成员姓名，用逗号分隔..."
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="bg-slate-900 border border-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg flex items-center gap-2"
                            >
                                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                                {loading ? 'AI 生成中...' : '生成工作票'}
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-4xl mx-auto"
                    >
                        {/* Simulation of a Paper Ticket */}
                        <div className="bg-white border-2 border-slate-200 rounded-sm p-8 shadow-2xl mb-8 relative">
                            {/* Watermark */}
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] overflow-hidden">
                                <div className="text-[12rem] font-black transform -rotate-45 whitespace-nowrap">WORK PERMIT</div>
                            </div>

                            <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
                                <h1 className="text-2xl font-black text-slate-900 tracking-widest">电力安全工作票</h1>
                                <p className="text-sm font-bold text-slate-500 mt-1">编号: WP-{new Date().getFullYear()}-{Math.floor(Math.random() * 10000).toString().padStart(4, '0')}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-x-12 gap-y-4 mb-6 text-sm">
                                <div className="flex border-b border-slate-200 pb-2">
                                    <span className="font-bold text-slate-500 w-24">工作负责人:</span>
                                    <span className="font-mono font-bold text-slate-900">张工 (L3级认证)</span>
                                </div>
                                <div className="flex border-b border-slate-200 pb-2">
                                    <span className="font-bold text-slate-500 w-24">作业班组:</span>
                                    <span className="font-mono font-bold text-slate-900">检修一班 (3人)</span>
                                </div>
                                <div className="flex border-b border-slate-200 pb-2">
                                    <span className="font-bold text-slate-500 w-24">工作地点:</span>
                                    <span className="font-mono font-bold text-slate-900">{formData.location || '1# 升压站'}</span>
                                </div>
                                <div className="flex border-b border-slate-200 pb-2">
                                    <span className="font-bold text-slate-500 w-24">工作内容:</span>
                                    <span className="font-mono font-bold text-slate-900">{TASK_TYPES.find(t => t.id === formData.taskType)?.label}</span>
                                </div>
                            </div>

                            {/* Risk Level Badge */}
                            <div className="mb-6 bg-red-50 border border-red-100 p-4 rounded-lg flex items-center gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                                <div>
                                    <span className="font-bold text-red-900 text-sm">风险等级: 高风险 (III级)</span>
                                    <p className="text-xs text-red-700 mt-1">系统检测到该任务涉及高压操作，请务必严格执行监护制度。</p>
                                </div>
                            </div>

                            {/* Safety Measures */}
                            <div className="mb-8">
                                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-blue-600" />
                                    安全措施 (AI 自动生成)
                                </h3>
                                <div className="space-y-2">
                                    {currentMeasures.map((measure, index) => (
                                        <div key={index} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                                            <div className="w-5 h-5 border-2 border-slate-300 rounded flex items-center justify-center">
                                                <span className="text-transparent">✓</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">{index + 1}. {measure}</span>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-3 p-2 text-slate-400 italic">
                                        <div className="w-5 h-5 border-2 border-slate-200 border-dashed rounded" />
                                        <span className="text-sm">... (手写补充区域)</span>
                                    </div>
                                </div>
                            </div>

                            {/* Signatures */}
                            <div className="grid grid-cols-3 gap-8 mt-12 pt-8 border-t border-slate-200">
                                <div className="text-center">
                                    <p className="text-xs text-slate-400 mb-8">工作票签发人</p>
                                    <div className="h-px bg-slate-300 w-full" />
                                </div>
                                <div className="text-center">
                                    <p className="text-xs text-slate-400 mb-8">工作负责人</p>
                                    <div className="h-px bg-slate-300 w-full" />
                                </div>
                                <div className="text-center">
                                    <p className="text-xs text-slate-400 mb-8">工作许可人</p>
                                    <div className="h-px bg-slate-300 w-full" />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-center gap-4">
                            <button onClick={() => setStep('form')} className="px-6 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-all">
                                返回修改
                            </button>
                            <button className="px-6 py-2 rounded-xl font-bold bg-white border border-slate-200 hover:border-slate-300 transition-all flex items-center gap-2">
                                <Printer className="w-4 h-4" />
                                打印
                            </button>
                            <button className="px-6 py-2 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-500 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/30">
                                <Share2 className="w-4 h-4" />
                                发送至班组终端
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
