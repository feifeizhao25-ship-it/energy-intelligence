'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    MapPin,
    Calendar,
    Zap,
    Wind,
    Battery,
    TrendingUp,
    Activity,
    AlertTriangle,
    CheckCircle,
    Settings,
    Share2,
    Download,
    BrainCircuit,
    Loader2,
    Shield,
    Wrench,
    Gauge
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DiagnosisResult {
    summary: string;
    status: 'healthy' | 'warning' | 'critical';
    scores: {
        overall: number;
        efficiency: number;
        maintenance: number;
        safety: number;
    };
    issues: Array<{
        type: 'warning' | 'error' | 'info';
        title: string;
        description: string;
        recommendation: string;
    }>;
    recommendations: string[];
    nextMaintenanceDate: string;
}

interface ProjectDetailProps {
    params: {
        id: string;
    };
}

export default function ProjectDetailPage({ params }: ProjectDetailProps) {
    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState<Array<{ time: string; value: number }>>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [diagnosisLoading, setDiagnosisLoading] = useState(false);
    const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);

    useEffect(() => {
        const fetchProject = async () => {
            try {
                // Fetch from real API
                const res = await fetch(`/api/projects/${params.id}`);
                const data = await res.json();

                if (data.success) {
                    const p = data.data;
                    const latestAnalysis = p.dailyAnalyses?.[0];
                    const dailyEnergy = p.stations?.reduce((sum: number, station: any) => sum + (station.dailyEnergy || 0), 0);
                    const totalEnergy = p.stations?.reduce((sum: number, station: any) => sum + (station.totalEnergy || 0), 0);
                    // Adapt DB data to UI model
                    setProject({
                        id: p.id,
                        name: p.name,
                        type: p.type,
                        status: p.parameters?.status || 'planning',
                        capacity: p.capacity,
                        location: p.parameters?.address || '未知位置',
                        createdAt: new Date(p.createdAt).toLocaleDateString(),
                        dailyGen: p.stations?.length ? dailyEnergy : (latestAnalysis ? Number(latestAnalysis.generationActual) : null),
                        totalGen: p.stations?.length ? totalEnergy : null,
                        health: latestAnalysis ? Number(latestAnalysis.healthScore) : null
                    });
                    setChartData((p.dailyAnalyses || []).slice().reverse().map((item: any) => ({
                        time: new Date(item.analysisDate).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
                        value: Number(item.generationActual),
                    })));
                    setAlerts(p.alerts || []);
                } else {
                    console.error('Project not found API error');
                }
            } catch (e) {
                console.error('Failed to fetch project details', e);
            } finally {
                setLoading(false);
            }
        };

        fetchProject();
    }, [params.id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500">
                <p>未找到项目</p>
                <Link href="/projects" className="mt-4 text-green-600 hover:underline">返回列表</Link>
            </div>
        );
    }

    const handleAIDiagnosis = async () => {
        if (diagnosisLoading || diagnosis) return;
        setDiagnosisLoading(true);
        try {
            const res = await fetch('/api/projects/diagnosis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.id,
                    projectName: project.name,
                    projectType: project.type,
                    capacity: project.capacity,
                    location: project.location,
                    dailyGen: project.dailyGen,
                    health: project.health
                })
            });
            const data = await res.json();
            if (data.success) {
                setDiagnosis(data.data);
            }
        } catch (e) {
            console.error('AI Diagnosis failed:', e);
        } finally {
            setDiagnosisLoading(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'solar': return <Zap className="h-8 w-8 text-amber-500" />;
            case 'wind': return <Wind className="h-8 w-8 text-cyan-500" />;
            case 'storage': return <Battery className="h-8 w-8 text-emerald-500" />;
            default: return <Activity className="h-8 w-8 text-slate-500" />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/projects" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </Link>
                        <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
                        <h1 className="text-lg font-bold text-slate-900">{project.name}</h1>
                        <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                            project.status === 'running' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                        )}>
                            {project.status === 'running' ? '运行中' : project.status}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href={`/projects/${params.id}/om`}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
                        >
                            <Activity className="w-4 h-4" />
                            运维中心
                        </Link>
                        <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                            <Share2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                            <Settings className="w-4 h-4" />
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors">
                            <Download className="w-4 h-4" />
                            导出报告
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Top Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-amber-50 rounded-lg">
                                <Zap className="w-5 h-5 text-amber-500" />
                            </div>
                        </div>
                        <div className="text-sm font-bold text-slate-500">今日发电量</div>
                        <div className="text-2xl font-black text-slate-900">{project.dailyGen ?? '待接入'} {project.dailyGen != null && <span className="text-xs font-bold text-slate-400">kWh</span>}</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-blue-500" />
                            </div>
                        </div>
                        <div className="text-sm font-bold text-slate-500">总发电量</div>
                        <div className="text-2xl font-black text-slate-900">{project.totalGen != null ? (project.totalGen / 1000).toFixed(1) : '待接入'} {project.totalGen != null && <span className="text-xs font-bold text-slate-400">MWh</span>}</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-purple-50 rounded-lg">
                                <Activity className="w-5 h-5 text-purple-500" />
                            </div>
                            <span className="text-xs font-bold text-slate-400">实时</span>
                        </div>
                        <div className="text-sm font-bold text-slate-500">及格率 (PR)</div>
                        <div className="text-2xl font-black text-slate-900">82.4 <span className="text-xs font-bold text-slate-400">%</span></div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-green-50 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-500" />
                            </div>
                        </div>
                        <div className="text-sm font-bold text-slate-500">系统健康度</div>
                        <div className="text-2xl font-black text-slate-900">{project.health ?? '待诊断'} {project.health != null && <span className="text-xs font-bold text-slate-400">/ 100</span>}</div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Chart & Details */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Chart */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-slate-900">功率曲线 (24H)</h3>
                                <select className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold px-3 py-1 text-slate-600">
                                    <option>今日</option>
                                    <option>昨日</option>
                                    <option>最近7天</option>
                                </select>
                            </div>
                            <div className="h-[300px] w-full">
                                {chartData.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-sm text-slate-400">尚无已采集的发电数据</div>
                                ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                                        />
                                        <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#10b981' }} />
                                    </LineChart>
                                </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        {/* Recent Alerts */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">最近告警 / 提示</h3>
                            <div className="space-y-4">
                                {alerts.length === 0 ? <div className="p-6 text-center text-sm text-slate-400 bg-slate-50 rounded-xl">暂无真实告警记录</div> : alerts.map(alert => (
                                    <div key={alert.id} className="flex items-start gap-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
                                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                        <div>
                                            <div className="text-sm font-bold text-slate-900">{alert.title}</div>
                                            <div className="text-xs text-slate-500 mt-1">{alert.description}</div>
                                            {alert.recommendation && <div className="text-xs text-amber-700 mt-2">建议：{alert.recommendation}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Info */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">项目档案</h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <MapPin className="w-4 h-4 text-slate-400" />
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 uppercase">地理位置</div>
                                        <div className="text-sm font-bold text-slate-900">{project.location}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 uppercase">投运日期</div>
                                        <div className="text-sm font-bold text-slate-900">{project.createdAt}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Zap className="w-4 h-4 text-slate-400" />
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 uppercase">装机容量</div>
                                        <div className="text-sm font-bold text-slate-900">{project.capacity} kW</div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-100">
                                <h4 className="text-xs font-black text-slate-400 uppercase mb-3">资产详情</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="text-center p-3 bg-slate-50 rounded-xl">
                                        <div className="text-xl font-black text-slate-900">5</div>
                                        <div className="text-[10px] font-bold text-slate-400">逆变器</div>
                                    </div>
                                    <div className="text-center p-3 bg-slate-50 rounded-xl">
                                        <div className="text-xl font-black text-slate-900">240</div>
                                        <div className="text-[10px] font-bold text-slate-400">光伏板</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* AI Diagnosis Section */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <BrainCircuit className="w-5 h-5 text-purple-500" />
                                    AI 智能诊断
                                </h3>
                                {!diagnosis && (
                                    <button
                                        onClick={handleAIDiagnosis}
                                        disabled={diagnosisLoading}
                                        className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {diagnosisLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
                                        {diagnosisLoading ? '分析中...' : '开始诊断'}
                                    </button>
                                )}
                            </div>

                            {diagnosis ? (
                                <div className="space-y-4">
                                    {/* Status Summary */}
                                    <div className={cn(
                                        "p-4 rounded-xl border",
                                        diagnosis.status === 'healthy' ? "bg-emerald-50 border-emerald-200" :
                                            diagnosis.status === 'warning' ? "bg-amber-50 border-amber-200" :
                                                "bg-red-50 border-red-200"
                                    )}>
                                        <div className={cn(
                                            "text-sm font-bold",
                                            diagnosis.status === 'healthy' ? "text-emerald-700" :
                                                diagnosis.status === 'warning' ? "text-amber-700" :
                                                    "text-red-700"
                                        )}>
                                            {diagnosis.summary}
                                        </div>
                                    </div>

                                    {/* Score Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { label: '总评', value: diagnosis.scores.overall, icon: Gauge, color: 'text-blue-500' },
                                            { label: '效率', value: diagnosis.scores.efficiency, icon: TrendingUp, color: 'text-green-500' },
                                            { label: '维护', value: diagnosis.scores.maintenance, icon: Wrench, color: 'text-amber-500' },
                                            { label: '安全', value: diagnosis.scores.safety, icon: Shield, color: 'text-purple-500' }
                                        ].map((score, i) => (
                                            <div key={i} className="bg-slate-50 p-3 rounded-xl flex items-center gap-3">
                                                <score.icon className={cn("w-4 h-4", score.color)} />
                                                <div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase">{score.label}</div>
                                                    <div className="text-lg font-black text-slate-900">{score.value}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Issues */}
                                    {diagnosis.issues.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="text-xs font-black text-slate-400 uppercase">检测到的问题</div>
                                            {diagnosis.issues.map((issue, i) => (
                                                <div key={i} className={cn(
                                                    "p-3 rounded-xl text-sm",
                                                    issue.type === 'error' ? "bg-red-50 border border-red-100" :
                                                        issue.type === 'warning' ? "bg-amber-50 border border-amber-100" :
                                                            "bg-blue-50 border border-blue-100"
                                                )}>
                                                    <div className="font-bold text-slate-900">{issue.title}</div>
                                                    <div className="text-xs text-slate-600 mt-1">{issue.description}</div>
                                                    <div className="text-xs text-green-600 mt-1">建议: {issue.recommendation}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Recommendations */}
                                    <div className="space-y-2">
                                        <div className="text-xs font-black text-slate-400 uppercase">AI 建议</div>
                                        <ul className="space-y-1">
                                            {diagnosis.recommendations.map((rec, i) => (
                                                <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                                                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                                    {rec}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Next Maintenance */}
                                    <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                                        建议下次维护日期: <span className="font-bold text-slate-900">{diagnosis.nextMaintenanceDate}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-400">
                                    <BrainCircuit className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <div className="text-sm font-bold">点击&ldquo;开始诊断&rdquo;获取 AI 智能分析报告</div>
                                    <div className="text-xs mt-1">基于大模型的结构化运维建议</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
