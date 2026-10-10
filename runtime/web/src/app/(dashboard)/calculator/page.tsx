'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Sun,
  Wind,
  Battery,
  TrendingUp,
  FileText,
  Share2,
  ArrowRight,
  ShieldCheck,
  Zap,
  ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function CalculatorHomePage() {
  const router = useRouter();

  const engines = [
    {
      id: 'solar',
      title: '分布式光伏',
      description: '基于上一完整年的历史辐照与您填写的成本、电价，提供可核对的初步估算。',
      icon: <Sun className="w-8 h-8 text-orange-400" />,
      color: 'from-orange-500/20 to-orange-400/5',
      borderColor: 'group-hover:border-orange-500/50',
      tag: '初步估算',
      stats: { irr: '需输入后计算', payback: '需输入后计算' },
      path: '/calculator/solar'
    },
    {
      id: 'wind',
      title: '分散式风电',
      description: '按历史风速外推到轮毂高度，估算发电量、收益与度电成本；上网电价可按省级电价表或自行填写。',
      icon: <Wind className="w-8 h-8 text-blue-400" />,
      color: 'from-blue-500/20 to-blue-400/5',
      borderColor: 'group-hover:border-blue-500/50',
      tag: '初步估算',
      stats: { irr: '需输入后计算', payback: '需输入后计算' },
      path: '/calculator/wind'
    },
    {
      id: 'storage',
      title: '能源存储系统',
      description: '按省级分时电价（可自行修改）估算峰谷套利收益与度电储能成本。',
      icon: <Battery className="w-8 h-8 text-emerald-400" />,
      color: 'from-emerald-500/20 to-emerald-400/5',
      borderColor: 'group-hover:border-emerald-500/50',
      tag: '初步估算',
      stats: { irr: '需输入后计算', payback: '需输入后计算' },
      path: '/calculator/storage'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200">
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-blue-600/10 blur-[120px] rounded-full" />

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              <span>智能收益测算引擎 2.0</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
              让每一个瓦特<br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                都产生明确价值
              </span>
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              基于公开气象数据与省级参考电价表（标注来源与数据截至日期）做初步测算，结果仅供参考，不构成投资建议。
            </p>
          </motion.div>

          {/* Calculator Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            {engines.map((engine, index) => (
              <motion.div
                key={engine.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => router.push(engine.path)}
                className={`group relative p-8 rounded-3xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/60 transition-all cursor-pointer ${engine.borderColor}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${engine.color} opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl`} />

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 rounded-2xl bg-slate-900/50 border border-slate-700/50">
                      {engine.icon}
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold tracking-widest uppercase text-white/50">
                      {engine.tag}
                    </span>
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                    {engine.title}
                    <ArrowRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-blue-400" />
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-8">
                    {engine.description}
                  </p>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-700/50 pt-6">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">平均收益率</div>
                      <div className="text-lg font-bold text-white">{engine.stats.irr}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">平均回收期</div>
                      <div className="text-lg font-bold text-white">{engine.stats.payback}</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Features / Social Proof */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 py-12 border-y border-slate-800/50">
            {[
              { icon: <TrendingUp className="w-5 h-5" />, title: '动态政策库', desc: '电价标注来源与数据截至日期' },
              { icon: <ShieldCheck className="w-5 h-5" />, title: '假设透明', desc: '损耗、衰减、折现率等假设逐项列出' },
              { icon: <FileText className="w-5 h-5" />, title: '专业报告', desc: '导出 PDF / Word 测算报告（Word 需专业版及以上）' },
              { icon: <Share2 className="w-5 h-5" />, title: '项目对比', desc: '保存为项目后可对比不同方案' }
            ].map((feature, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="text-blue-400 mt-1">{feature.icon}</div>
                <div>
                  <h4 className="text-white font-semibold mb-1 text-sm">{feature.title}</h4>
                  <p className="text-slate-500 text-xs">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Recent Section */}
          <div className="mt-20">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-white">最近的项目测算</h2>
              <button className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1">
                查看全部项目 <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-800/30 rounded-3xl border border-slate-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase">项目名称</th>
                      <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase">类型</th>
                      <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase">IRR</th>
                      <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase">回收期</th>
                      <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase">日期</th>
                      <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {[
                      { name: '河北保定分布式光伏 1MW', type: '光伏', irr: '18.5%', pb: '4.8年', date: '2024-01-05' },
                      { name: '山东德州分散式风电 5MW', type: '风电', irr: '12.3%', pb: '7.2年', date: '2024-01-03' },
                      { name: '江苏盐城储能电站 10MWh', type: '储能', irr: '9.2%', pb: '6.5年', date: '2024-01-01' }
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-8 py-6 font-medium text-white">{row.name}</td>
                        <td className="px-8 py-6 text-slate-400">{row.type}</td>
                        <td className="px-8 py-6">
                          <span className="text-emerald-400 font-bold">{row.irr}</span>
                        </td>
                        <td className="px-8 py-6 text-slate-300">{row.pb}</td>
                        <td className="px-8 py-6 text-slate-500">{row.date}</td>
                        <td className="px-8 py-6">
                          <button className="p-2 rounded-lg bg-slate-700/50 hover:bg-blue-600 transition-all text-white">
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
