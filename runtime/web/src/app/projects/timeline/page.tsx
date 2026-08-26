/**
 * 🏰 护城河系统：项目时间线工作台 (Workflows OS)
 * 让用户的所有新能源项目都能全生命周期管理，形成无法移除的数据资产
 */

import React from 'react';
import {
    Zap, Clock, FileText, ChevronRight,
    MapPin, BarChart2, CheckCircle2, AlertTriangle,
    Plus, Download, Share2
} from 'lucide-react';

export default function ProjectTimelinePage() {
    const project = {
        name: "上海崇明 5MW 分布式光伏项目",
        location: "上海市崇明区",
        capacity: "5.0 MWp",
        status: "可行性研究阶段",
        progress: 35
    };

    const timeline = [
        { date: "2026-02-03", title: "生成 PR 诊断快照", type: "DIAGNOSIS", user: "AI Assistant", importance: "NORMAL" },
        { date: "2026-02-01", title: "完成第一版收益测算", type: "CALCULATION", user: "张伟", importance: "HIGH", snapshotId: "snap_123" },
        { date: "2026-01-28", title: "导入 2025 年气象实测数据", type: "DATA", user: "系统", importance: "NORMAL" },
        { date: "2026-01-25", title: "项目正式建立", type: "SYSTEM", user: "张伟", importance: "LOW" }
    ];

    return (
        <div className="min-h-screen bg-gray-50/50">
            <div className="max-w-7xl mx-auto px-6 py-10">
                {/* 项目头部看板 */}
                <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm mb-8">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 text-primary-600 font-bold text-sm mb-2">
                                <MapPin size={16} />
                                {project.location}
                            </div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-4">{project.name}</h1>
                            <div className="flex gap-4">
                                <Badge icon={<FileText size={14} />} text={project.status} color="blue" />
                                <Badge icon={<Zap size={14} />} text={project.capacity} color="green" />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button className="flex items-center gap-2 px-4 py-2 border rounded-xl hover:bg-gray-50 text-sm font-medium">
                                <Share2 size={16} />
                                分享
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 text-sm font-bold shadow-lg shadow-primary-200">
                                <Plus size={16} />
                                记录工作
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatsCard label="累计发电量" value="524.2 万度" trend="+12.5%" />
                        <StatsCard label="累计收益" value="¥215.8 万" trend="+8.2%" />
                        <StatsCard label="平均 PR 值" value="82.4%" trend="-0.5%" warning />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* 左侧：时间线 (The Moat of Data) */}
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Clock className="text-primary-500" />
                                项目全生命周期时间线
                            </h2>
                        </div>

                        <div className="relative pl-8">
                            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                            <div className="space-y-8">
                                {timeline.map((event, i) => (
                                    <div key={i} className="relative">
                                        <div className="absolute -left-[24px] w-4 h-4 rounded-full bg-white border-2 border-primary-500 flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                                        </div>
                                        <div className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-all group">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="text-xs font-bold text-gray-400 mb-1">{event.date}</div>
                                                    <div className="font-bold text-gray-800 text-lg group-hover:text-primary-600 transition-colors">
                                                        {event.title}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="text-xs bg-gray-50 px-2 py-0.5 rounded-full text-gray-500">
                                                            操作员：{event.user}
                                                        </span>
                                                    </div>
                                                </div>
                                                {event.snapshotId && (
                                                    <a href={`/audit/${event.snapshotId}`} className="text-sm font-bold text-primary-600 hover:underline flex items-center gap-1">
                                                        查看审计
                                                        <ChevronRight size={14} />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 右侧：工作流 OS (The Moat of Workflow) */}
                    <div className="space-y-8">
                        <section>
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <BarChart2 className="text-primary-500" />
                                智能下一步 (AI OS)
                            </h3>
                            <div className="space-y-3">
                                <RecommendationItem
                                    title="生成可研分析报告"
                                    desc="计算已完成，建议立即导出 PDF 用于政府审批申请。"
                                    icon={<FileText size={18} />}
                                    priority="High"
                                />
                                <RecommendationItem
                                    title="对比历史收益方案"
                                    desc="发现新的电价政策，建议将原方案与 2026Q1 新政策做对比。"
                                    icon={<BarChart2 size={18} />}
                                    priority="Normal"
                                />
                            </div>
                        </section>

                        <section>
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800">
                                <Download className="text-primary-500" />
                                标准化交付件
                            </h3>
                            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                                <FileItem name="2026_崇明项目_可研报告.pdf" size="1.2 MB" />
                                <FileItem name="项目测算假设集_Q1.xlsx" size="450 KB" />
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Badge({ icon, text, color }: { icon: any, text: string, color: string }) {
    const colors: any = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        green: 'bg-green-50 text-green-600 border-green-100'
    };
    return (
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${colors[color]}`}>
            {icon}
            {text}
        </div>
    );
}

function StatsCard({ label, value, trend, warning }: any) {
    return (
        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
            <div className="text-xs font-bold text-gray-400 uppercase mb-2">{label}</div>
            <div className="flex items-end justify-between">
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className={`text-xs font-bold ${warning ? 'text-red-500' : 'text-green-600'}`}>
                    {trend}
                </div>
            </div>
        </div>
    );
}

function RecommendationItem({ title, desc, icon, priority }: any) {
    return (
        <div className="bg-white p-5 rounded-2xl border border-primary-50 border-l-4 border-l-primary-500 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                    {icon}
                </div>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${priority === 'High' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
                    {priority}
                </span>
            </div>
            <div className="font-bold text-gray-800 mb-1">{title}</div>
            <div className="text-xs text-gray-500 leading-relaxed mb-4">{desc}</div>
            <button className="w-full py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors">
                立即执行
            </button>
        </div>
    );
}

function FileItem({ name, size }: any) {
    return (
        <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
                <div className="text-gray-400 group-hover:text-primary-500">
                    <FileText size={20} />
                </div>
                <div>
                    <div className="text-sm font-bold text-gray-800">{name}</div>
                    <div className="text-[10px] text-gray-400">{size}</div>
                </div>
            </div>
            <Download size={16} className="text-gray-300 group-hover:text-gray-600" />
        </div>
    );
}
