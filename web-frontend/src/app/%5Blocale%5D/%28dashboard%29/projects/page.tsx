'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calculator,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Zap,
  Wind,
  Battery,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Search,
  BrainCircuit,
  ArrowRight,
  Loader2,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) {
        setProjects(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch projects', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDemo = async () => {
    setCreating(true);
    try {
      // Quick demo creation for testing
      const res = await fetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: `新建示范电站 ${Math.floor(Math.random() * 1000)}`,
          type: Math.random() > 0.5 ? 'solar' : 'wind',
          capacity: (Math.random() * 5000 + 100).toFixed(0),
          location: '北京市朝阳区示范基地',
          lat: 39.9,
          lng: 116.4
        })
      });
      const data = await res.json();
      if (data.success) {
        await fetchProjects();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const getProjectIcon = (type: string) => {
    switch (type) {
      case 'solar': return <Zap className="h-6 w-6 text-amber-500" />
      case 'wind': return <Wind className="h-6 w-6 text-cyan-500" />
      case 'storage': return <Battery className="h-6 w-6 text-emerald-500" />
      default: return <Calculator className="h-6 w-6 text-slate-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            运行中
          </span>
        )
      case 'analyzing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-100">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            AI 分析中
          </span>
        )
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest border border-amber-100">
            <AlertCircle className="w-3 h-3" />
            需关注
          </span>
        )
      default:
        // Default to planning/draft
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-100">
            草稿
          </span>
        )
    }
  }

  // Calculate stats
  const totalCapacity = projects.reduce((acc, p) => acc + (p.capacity || 0), 0) / 1000; // MW
  const totalCount = projects.length;

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">我的能源资产</h1>
          <p className="text-slate-500 font-medium">全生命周期管理与 AI 智能诊断中心</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-green-500 transition-colors" />
            <input
              type="text"
              placeholder="搜索电站或项目..."
              className="pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all w-64 shadow-sm"
            />
          </div>
          {/* Create Button with dual functionality for demo */}
          <div className="flex gap-2">
            <button
              onClick={handleCreateDemo}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              快速模拟 (Debug)
            </button>
            <Link
              href="/calculator"
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-green-600 transition-all shadow-lg hover:shadow-green-200 font-bold text-sm group"
            >
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
              创建新项目
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: '资产总数', value: totalCount, unit: '个', icon: MapPin, color: 'text-blue-500', bg: 'bg-blue-50' },
              { label: '总装机容量', value: totalCapacity.toFixed(1), unit: 'MW', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
              { label: '今日发电', value: (totalCapacity * 3.5).toFixed(1), unit: 'MWh', icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50' },
              { label: '健康度', value: totalCount > 0 ? '94.2' : '-', unit: '分', icon: CheckCircle2, color: 'text-purple-500', bg: 'bg-purple-50' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className={cn("p-3 rounded-xl transition-colors", stat.bg)}>
                    <stat.icon className={cn("w-6 h-6", stat.color)} />
                  </div>
                  {i === 2 && totalCount > 0 && <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg">+12%</span>}
                </div>
                <div className="space-y-1">
                  <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">{stat.label}</div>
                  <div className="text-2xl font-black text-slate-900 flex items-baseline gap-1">
                    {stat.value}
                    <span className="text-sm text-slate-400 font-bold">{stat.unit}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Projects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div key={project.id} className="group bg-white rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-100 transition-all duration-300 overflow-hidden flex flex-col">
                {/* Visual Header */}
                <div className={cn("h-32 p-6 flex flex-col justify-between relative overflow-hidden",
                  project.type === 'solar' ? "bg-gradient-to-br from-amber-100 to-orange-50" :
                    project.type === 'wind' ? "bg-gradient-to-br from-cyan-100 to-blue-50" :
                      "bg-gradient-to-br from-emerald-100 to-green-50"
                )}>
                  <div className="absolute right-0 top-0 p-32 bg-white/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>

                  <div className="flex justify-between items-start relative z-10">
                    <div className="p-2 bg-white/80 backdrop-blur-md rounded-xl shadow-sm">
                      {getProjectIcon(project.type)}
                    </div>
                    <div className="flex gap-2">
                      {getStatusBadge(project.parameters?.status || 'planning')}
                    </div>
                  </div>
                </div>

                {/* Content Body */}
                <div className="p-6 flex-1 flex flex-col gap-6">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 mb-2 line-clamp-1 group-hover:text-green-600 transition-colors">
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {project.parameters?.address || '未知位置'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : '--'}
                      </span>
                    </div>
                  </div>

                  {/* Data Grid */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="space-y-1">
                      <div className="text-[10px] font-black text-slate-400 uppercase">容量</div>
                      <div className="text-sm font-black text-slate-900">{project.capacity >= 1000 ? `${project.capacity / 1000} MW` : `${project.capacity} kW`}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] font-black text-slate-400 uppercase">健康度</div>
                      <div className="text-sm font-black text-emerald-600">
                        {project.parameters?.status === 'running' ? '98%' : project.parameters?.status === 'warning' ? '72%' : '--'}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-auto pt-4 border-t border-slate-50 flex items-center gap-2">
                    <Link
                      href={`/projects/${project.id}/om`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-50 text-green-600 text-[10px] font-bold hover:bg-green-100 transition-colors"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      运维
                    </Link>
                    <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-50 text-slate-600 text-[10px] font-bold hover:bg-slate-100 transition-colors">
                      <BrainCircuit className="w-3.5 h-3.5 text-purple-500" />
                      诊断
                    </button>
                    <Link
                      href={`/projects/timeline`}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-all shadow-sm"
                      title="查看项目时间线"
                    >
                      <Clock className="w-4 h-4" />
                    </Link>
                    <Link
                      href={`/projects/${project.id}`}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:border-green-500 hover:text-green-500 transition-all shadow-sm"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}

            {/* Create New Card (Empty State) */}
            <Link
              href="/calculator"
              className="group min-h-[300px] rounded-[32px] border-2 border-dashed border-slate-200 hover:border-green-400 hover:bg-green-50/30 transition-all flex flex-col items-center justify-center gap-4 cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-100 group-hover:bg-white group-hover:shadow-xl group-hover:scale-110 transition-all flex items-center justify-center">
                <Plus className="w-8 h-8 text-slate-400 group-hover:text-green-500" />
              </div>
              <div className="text-center">
                <div className="text-sm font-black text-slate-900">新建资产项目</div>
                <div className="text-xs text-slate-400 font-medium mt-1">支持光伏/风电/储能评估</div>
              </div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
