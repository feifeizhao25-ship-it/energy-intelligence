/**
 * 🏰 护城河系统：开发者看板 (Developer Portal)
 * 核心：管理 API Key，监控生态调用，建立开发者社区感
 */

import React from 'react';
import {
    Key, Activity, Cpu, Code,
    Copy, RefreshCcw, ShieldCheck,
    ExternalLink, Zap, Terminal
} from 'lucide-react';

export default function DeveloperPage() {
    const apiKeys = [
        { name: "OpenClaw Plugin", key: "sk_live_51P...kx8", status: "Active", lastUsed: "2分钟前" },
        { name: "My Python Script", key: "sk_live_94X...q2p", status: "Active", lastUsed: "3天前" }
    ];

    return (
        <div className="min-h-screen bg-gray-50/50 py-12">
            <div className="max-w-6xl mx-auto px-6">

                <div className="flex items-center gap-4 mb-10">
                    <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
                        <Cpu size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">开发者控制台</h1>
                        <p className="text-gray-500">集成受审计的新能源计算核心到您的应用或 Agent 中</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* API Key 管理 */}
                    <div className="lg:col-span-2 space-y-6">
                        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                                <h2 className="font-bold text-lg flex items-center gap-2">
                                    <Key className="text-primary-500" />
                                    接口密钥 (API Keys)
                                </h2>
                                <button className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-primary-700">
                                    + 创建新密钥
                                </button>
                            </div>

                            <div className="divide-y divide-gray-50">
                                {apiKeys.map((k, i) => (
                                    <div key={i} className="p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                        <div>
                                            <div className="font-bold text-gray-800 mb-1">{k.name}</div>
                                            <div className="flex items-center gap-3">
                                                <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500 font-mono">
                                                    {k.key}
                                                </code>
                                                <span className="text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded uppercase">
                                                    {k.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-gray-400 mb-2">最后使用: {k.lastUsed}</div>
                                            <div className="flex gap-2">
                                                <button className="p-2 hover:bg-white rounded-lg border text-gray-400"><Copy size={16} /></button>
                                                <button className="p-2 hover:bg-white rounded-lg border text-gray-400"><RefreshCcw size={16} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* 调用示例 */}
                        <section className="bg-gray-900 rounded-3xl p-8 shadow-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2 text-white font-bold">
                                    <Terminal size={20} className="text-primary-500" />
                                    快速开始 (cURL)
                                </div>
                            </div>
                            <div className="bg-gray-800/50 rounded-xl p-4 font-mono text-sm text-primary-300 leading-relaxed overflow-x-auto">
                                <code>
                                    {`curl -X POST https://solarwind.pro/api/v1/calculate/solar \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "capacity": 100, "region": "Shanghai" }'`}
                                </code>
                            </div>
                        </section>
                    </div>

                    {/* 右侧：统计与生态 */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                            <div className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                                <Activity size={14} className="text-primary-500" />
                                今日调用量
                            </div>
                            <div className="text-4xl font-bold text-gray-900 mb-2">1,284</div>
                            <div className="text-xs text-green-600 font-bold flex items-center gap-1">
                                <Zap size={10} />
                                +24% 较昨日上升
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-6 text-white">
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <ShieldCheck size={18} className="text-primary-400" />
                                审计引擎优势
                            </h3>
                            <ul className="space-y-3 text-sm text-gray-400">
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-primary-400" />
                                    每次调用自动生成不可篡改审计快照
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-primary-400" />
                                    引用 2026-Q1 行业标准计算口径
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-primary-400" />
                                    支持多 Agent 协同数据校验
                                </li>
                            </ul>
                            <button className="w-full mt-6 py-3 bg-white text-gray-900 rounded-2xl text-xs font-bold flex items-center justify-center gap-2">
                                查看开发者文档
                                <ExternalLink size={14} />
                            </button>
                        </div>

                        <div className="bg-blue-50 rounded-3xl p-6 border border-blue-100">
                            <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2 text-sm">
                                <Code size={18} />
                                SDK & 插件
                            </h3>
                            <p className="text-xs text-blue-600 leading-relaxed mb-4">
                                下载官方 OpenClaw Skill 插件定义，让您的 Agent 瞬间具备专业新能源分析能力。
                            </p>
                            <button className="text-xs font-bold text-blue-700 hover:underline">
                                下载 openclaw-skill.json
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
