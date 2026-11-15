'use client';

import Link from 'next/link';

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
    <div className="min-w-0 text-[var(--ink)]">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-2 pb-16 pt-4 sm:px-4">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-blue-600/10 blur-[120px] rounded-full" />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <div className="ei-badge mb-6">
              <Zap className="w-4 h-4" />
              <span>初步测算</span>
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-[var(--navy)] md:text-5xl">
              按公开数据估算<br />
              <span className="text-[var(--teal)]">
                发电量与成本
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-[var(--ink-soft)]">
              基于公开气象数据与省级参考电价表（标注来源与数据截至日期）做初步测算，结果仅供参考，不构成投资建议。
            </p>
          </div>

          {/* Calculator Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            {engines.map((engine) => (
              <div
                key={engine.id}
                onClick={() => router.push(engine.path)}
                className="ei-panel group relative cursor-pointer p-8 transition-shadow hover:shadow-md"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${engine.color} opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl`} />

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3">
                      {engine.icon}
                    </div>
                    <span className="ei-badge">
                      {engine.tag}
                    </span>
                  </div>

                  <h3 className="mb-3 flex items-center gap-2 text-2xl font-bold text-[var(--navy)]">
                    {engine.title}
                    <ArrowRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-blue-400" />
                  </h3>
                  <p className="mb-8 text-sm leading-relaxed text-[var(--ink-soft)]">
                    {engine.description}
                  </p>

                  <div className="grid grid-cols-2 gap-4 border-t border-[var(--line)] pt-6">
                    <div>
                      <div className="mb-1 text-xs font-bold text-[var(--ink-soft)]">内部收益率</div>
                      <div className="text-lg font-bold tabular-nums text-[var(--ink)]">{engine.stats.irr}</div>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-bold text-[var(--ink-soft)]">回收期</div>
                      <div className="text-lg font-bold tabular-nums text-[var(--ink)]">{engine.stats.payback}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Features / Social Proof */}
          <div className="grid grid-cols-1 gap-6 border-y border-[var(--line)] py-12 md:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: <TrendingUp className="w-5 h-5" />, title: '动态政策库', desc: '电价标注来源与数据截至日期' },
              { icon: <ShieldCheck className="w-5 h-5" />, title: '假设透明', desc: '损耗、衰减、折现率等假设逐项列出' },
              { icon: <FileText className="w-5 h-5" />, title: '专业报告', desc: '导出 PDF / Word 测算报告（Word 需专业版及以上）' },
              { icon: <Share2 className="w-5 h-5" />, title: '项目对比', desc: '保存为项目后可对比不同方案' }
            ].map((feature, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="text-blue-400 mt-1">{feature.icon}</div>
                <div>
                  <h4 className="mb-1 text-sm font-semibold text-[var(--ink)]">{feature.title}</h4>
                  <p className="text-xs text-[var(--ink-soft)]">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 原来这里是写死的「最近的项目测算」表（河北保定光伏 IRR 18.5%、山东德州风电、江苏盐城储能），
              每个用户看到的都是同样的虚构项目，已删除；用户自己的项目在「我的项目」页。 */}
          <div className="mt-12 text-center">
            <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-[var(--teal)]">
              查看我的项目 <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
