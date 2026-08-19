'use client';

import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  Zap,
  Calculator,
  FileText,
  Map,
  Wrench,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  Trophy,
  History,
  Info,
  ChevronRight,
  Star
} from 'lucide-react';

// 模拟扩展仪表板数据
const dashboardData = {
  user: {
    name: '陈工程师',
    tier: 'FREE',
    usage: {
      aiCalls: { used: 3, total: 10 },
      calculations: { used: 1, total: 5 },
      reports: { used: 0, total: 2 }
    },
    achievements: [
      { id: 1, name: '初出茅庐', icon: '🌱', date: '2026-01-10' },
      { id: 2, name: '光伏达人', icon: '☀️', date: '2026-01-11' }
    ]
  },
  overview: {
    totalProjects: 3,
    totalCapacity: 350,
    totalRevenue: 45000,
    avgIRR: 12.5,
    totalReports: 4,
    activeAlerts: 2
  },
  recentProjects: [
    { id: 'p1', name: '廊坊屋顶光伏二期', type: 'solar', status: 'completed', time: '1小时前' },
    { id: 'p2', name: '张北风场运维诊断', type: 'wind', status: 'warning', time: '3小时前' },
    { id: 'p3', name: '上海工商业储能调优', type: 'storage', status: 'processing', time: '1天前' }
  ],
  monthlyData: [
    { month: '1月', solar: 45, wind: 30, storage: 15 },
    { month: '2月', solar: 52, wind: 35, storage: 18 },
    { month: '3月', solar: 48, wind: 28, storage: 20 },
    { month: '4月', solar: 55, wind: 40, storage: 22 },
    { month: '5月', solar: 60, wind: 45, storage: 25 },
    { month: '6月', solar: 58, wind: 42, storage: 28 }
  ],
  alerts: [
    {
      id: 1,
      type: 'warning',
      title: '逆变器效率异常',
      description: '河北光伏项目#2逆变器效率下降至92%，建议进行IV曲线扫描',
      time: '2小时前'
    },
    {
      id: 2,
      type: 'info',
      title: '新论文推荐',
      description: '系统为您推荐了3篇关于"TOPCon组件衰减"的最新研究',
      time: '1天前'
    }
  ]
};

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { X, Crown, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardPage() {
  const { data: session } = useSession() as any;
  const [showProfileTip, setShowProfileTip] = useState(false);

  useEffect(() => {
    if (session?.user && !session.user.profileCompleted) {
      setShowProfileTip(true);
    }
  }, [session]);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'info':
        return <FileText className="h-5 w-5 text-blue-500" />;
      default:
        return <Calculator className="h-5 w-5 text-slate-500" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'warning':
        return 'border-amber-500/10 bg-amber-500/5';
      case 'info':
        return 'border-blue-500/10 bg-blue-500/5';
      default:
        return 'border-slate-800 bg-slate-900/50';
    }
  };

  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen pb-12 space-y-10">
      <AnimatePresence>
        {showProfileTip && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 text-white relative shadow-xl shadow-blue-900/10">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <Star className="w-7 h-7 text-yellow-300 animate-pulse" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-black tracking-tight">完善您的专业资料，解锁更多 AI 2.0 次数</h3>
                  <p className="text-blue-100/80 text-xs font-medium">填写所属企业和职务，系统将为您定制专属智库专家档案并赠送额度。</p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href="/settings"
                    className="bg-white text-blue-700 px-5 py-2.5 rounded-2xl font-black text-xs hover:bg-blue-50 transition-all shadow-lg active:scale-95"
                  >
                    立即完善
                  </Link>
                  <button
                    onClick={() => setShowProfileTip(false)}
                    className="p-2 text-white/60 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 顶部欢迎与会员状态 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            欢迎回来，<span className="text-blue-600">{session?.user?.name || dashboardData.user.name}</span>
            <span className="text-[10px] font-black bg-slate-900 text-white px-3 py-1.5 rounded-full flex items-center gap-1.5 uppercase tracking-widest">
              <Crown className="w-3.5 h-3.5 text-yellow-400" />
              {session?.user?.plan || dashboardData.user.tier} TIER
            </span>
          </h1>
          <p className="text-slate-500 mt-2 font-medium">今天是 2026年1月11日，查看您最近的项目进展</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm flex items-center gap-6">
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-500">
              <span>AI 额度</span>
              <span>{dashboardData.user.usage.aiCalls.used}/{dashboardData.user.usage.aiCalls.total}</span>
            </div>
            <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${(dashboardData.user.usage.aiCalls.used / dashboardData.user.usage.aiCalls.total) * 100}%` }}
              ></div>
            </div>
          </div>
          <Link href="/pricing" className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">
            升级额度
          </Link>
        </div>
      </div>

      {/* 模块快捷入口 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/resource/map" className="group relative overflow-hidden bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl hover:shadow-blue-500/20 transition-all hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform">
            <Map className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <div className="p-3 bg-white/10 rounded-2xl w-fit mb-6">
              <Map className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">资源地图</h3>
            <p className="text-slate-400 text-sm leading-relaxed">精准锁定光风储资源，<br />多维评估地理条件</p>
            <ArrowRight className="mt-6 w-6 h-6 text-blue-400 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all" />
          </div>
        </Link>

        <Link href="/calculator" className="group relative overflow-hidden bg-blue-600 rounded-[2rem] p-8 text-white shadow-2xl hover:shadow-blue-600/30 transition-all hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform">
            <Calculator className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <div className="p-3 bg-white/10 rounded-2xl w-fit mb-6">
              <Calculator className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">收益测算</h3>
            <p className="text-blue-100 text-sm leading-relaxed">一键生成工程级<br />IRR/LCOE 投资模型</p>
            <ArrowRight className="mt-6 w-6 h-6 text-white opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all" />
          </div>
        </Link>

        <Link href="/maintenance" className="group relative overflow-hidden bg-white rounded-[2rem] p-8 text-slate-900 border border-slate-100 shadow-xl hover:shadow-slate-200 transition-all hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform">
            <Wrench className="w-24 h-24 text-slate-900" />
          </div>
          <div className="relative z-10">
            <div className="p-3 bg-slate-100 rounded-2xl w-fit mb-6">
              <Wrench className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">运维诊断</h3>
            <p className="text-slate-500 text-sm leading-relaxed">智能诊断故障根源，<br />预测最佳清洗时机</p>
            <ArrowRight className="mt-6 w-6 h-6 text-slate-900 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all" />
          </div>
        </Link>

        <Link href="/papers" className="group relative overflow-hidden bg-emerald-600 rounded-[2rem] p-8 text-white shadow-2xl hover:shadow-emerald-600/30 transition-all hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform">
            <FileText className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <div className="p-3 bg-white/10 rounded-2xl w-fit mb-6">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">学术智库</h3>
            <p className="text-emerald-50 text-sm leading-relaxed">追踪全球前沿文献，<br />AI 生成行业洞见</p>
            <ArrowRight className="mt-6 w-6 h-6 text-white opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all" />
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* 最近项目 */}
          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                最近项目
              </h2>
              <Link href="/projects" className="text-sm font-bold text-blue-600 hover:opacity-70">查看全部</Link>
            </div>
            <div className="space-y-4">
              {dashboardData.recentProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-colors group cursor-pointer border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${project.type === 'solar' ? 'bg-yellow-50 text-yellow-600' :
                      project.type === 'wind' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                      }`}>
                      {project.type === 'solar' ? <Zap className="w-5 h-5" /> :
                        project.type === 'wind' ? <TrendingUp className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{project.name}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-400">{project.time}</span>
                        <span className={`text-[10px] py-0.5 px-2 rounded-full font-bold uppercase ${project.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                          project.status === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                          {project.status === 'completed' ? '已完成' : project.status === 'warning' ? '需处理' : '计算中'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
                </div>
              ))}
            </div>
          </section>

          {/* 月度趋势图表 (Mock) */}
          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold text-slate-900">月度发电趋势</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div> 模拟产出
                </div>
                <select className="bg-slate-50 border-none rounded-xl text-xs font-bold px-3 py-2 outline-none">
                  <option>最近6个月</option>
                  <option>最近1年</option>
                </select>
              </div>
            </div>
            <div className="flex h-48 items-end gap-4 px-2">
              {dashboardData.monthlyData.map((data, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="relative w-full">
                    <div
                      className="w-full bg-blue-100 rounded-t-lg group-hover:bg-blue-200 transition-all"
                      style={{ height: `${(data.solar + data.wind + data.storage) / 1.5}px` }}
                    ></div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      {data.solar + data.wind + data.storage}kWh
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{data.month}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          {/* 用户成就 */}
          <section className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2rem] p-8 text-white shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                我的成就
              </h2>
              <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-lg">等级 2</span>
            </div>
            <div className="flex gap-4">
              {dashboardData.user.achievements.map((ach) => (
                <div key={ach.id} className="bg-white/10 hover:bg-white/20 transition-colors p-4 rounded-2xl flex-1 text-center">
                  <div className="text-3xl mb-2">{ach.icon}</div>
                  <div className="text-xs font-bold truncate">{ach.name}</div>
                </div>
              ))}
              <div className="bg-white/5 border border-white/10 border-dashed p-4 rounded-2xl flex-1 flex flex-col items-center justify-center">
                <Star className="w-5 h-5 text-white/30" />
                <div className="text-[10px] text-white/30 mt-1">解锁更多</div>
              </div>
            </div>
          </section>

          {/* 智能推荐与提醒 */}
          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Info className="w-5 h-5 text-indigo-600" />
              智能推荐
            </h2>
            <div className="space-y-4">
              {dashboardData.alerts.map((alert) => (
                <div key={alert.id} className={`p-4 rounded-2xl border ${getAlertColor(alert.type)} group cursor-pointer transition-all hover:shadow-md`}>
                  <div className="flex items-start gap-4">
                    <div className="mt-1">{getAlertIcon(alert.type)}</div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{alert.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{alert.description}</p>
                    </div>
                  </div>
                </div>
              ))}
              <Link
                href="/assistant"
                className="w-full flex items-center justify-center gap-3 py-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition-all"
              >
                <MessageSquare className="w-5 h-5" />
                咨询 AI 智库专家
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
