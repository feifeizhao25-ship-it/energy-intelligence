'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    Activity,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Wrench,
    Calendar,
    Clock,
    Zap,
    Thermometer,
    Gauge,
    RefreshCw,
    Plus,
    ChevronRight,
    BrainCircuit,
    Loader2,
    Bell,
    Settings,
    TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface OmPageProps {
    params: {
        id: string;
    };
}

export default function OperationsMaintenancePage({ params }: OmPageProps) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [project, setProject] = useState<any>(null);
    const [stations, setStations] = useState<any[]>([]);
    const [stationsSummary, setStationsSummary] = useState<any>(null);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [alertsSummary, setAlertsSummary] = useState<any>(null);
    const [maintenance, setMaintenance] = useState<any[]>([]);
    const [maintenanceSummary, setMaintenanceSummary] = useState<any>(null);
    const [monitoring, setMonitoring] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'devices' | 'alerts' | 'maintenance'>('overview');

    const fetchData = async () => {
        try {
            // Fetch project details
            const projectRes = await fetch(`/api/projects/${params.id}`);
            const projectData = await projectRes.json();
            if (projectData.success) setProject(projectData.data);

            // Fetch stations
            const stationsRes = await fetch(`/api/projects/${params.id}/stations`);
            const stationsData = await stationsRes.json();
            if (stationsData.success) {
                setStations(stationsData.data.stations);
                setStationsSummary(stationsData.data.summary);
            }

            // Fetch alerts
            const alertsRes = await fetch(`/api/projects/${params.id}/alerts`);
            const alertsData = await alertsRes.json();
            if (alertsData.success) {
                setAlerts(alertsData.data.alerts);
                setAlertsSummary(alertsData.data.summary);
            }

            // Fetch maintenance
            const maintRes = await fetch(`/api/projects/${params.id}/maintenance`);
            const maintData = await maintRes.json();
            if (maintData.success) {
                setMaintenance(maintData.data.tasks);
                setMaintenanceSummary(maintData.data.summary);
            }

            // Fetch monitoring data
            const monitorRes = await fetch(`/api/projects/${params.id}/monitoring?range=24h`);
            const monitorData = await monitorRes.json();
            if (monitorData.success) {
                setMonitoring(monitorData.data);
            }

        } catch (e) {
            console.error('Failed to fetch O&M data:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Auto-refresh every 30 seconds
        const interval = setInterval(() => {
            setRefreshing(true);
            fetchData();
        }, 30000);
        return () => clearInterval(interval);
    }, [params.id]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <div className="text-sm text-slate-500">加载运维数据...</div>
                </div>
            </div>
        );
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'online': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
            case 'offline': case 'maintenance': return <XCircle className="w-4 h-4 text-slate-400" />;
            default: return <Activity className="w-4 h-4 text-slate-400" />;
        }
    };

    const getAlertIcon = (type: string) => {
        switch (type) {
            case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
            case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
            case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
            default: return <Bell className="w-5 h-5 text-blue-500" />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/projects/${params.id}`} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </Link>
                        <div className="h-8 w-[1px] bg-slate-200"></div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900">{project?.name || '电站'} - 运维中心</h1>
                            <div className="text-xs text-slate-500">实时监控与智能运维管理</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleRefresh}
                            className={cn(
                                "p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-all",
                                refreshing && "animate-spin"
                            )}
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition-colors">
                            <BrainCircuit className="w-4 h-4" />
                            AI 诊断
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex gap-6 border-t border-slate-100">
                        {[
                            { key: 'overview', label: '总览', icon: Activity },
                            { key: 'devices', label: '设备监控', icon: Gauge },
                            { key: 'alerts', label: '告警管理', icon: Bell },
                            { key: 'maintenance', label: '维护计划', icon: Wrench }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all",
                                    activeTab === tab.key
                                        ? "border-green-500 text-green-600"
                                        : "border-transparent text-slate-500 hover:text-slate-700"
                                )}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                                {tab.key === 'alerts' && alertsSummary?.active > 0 && (
                                    <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full">
                                        {alertsSummary.active}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-emerald-50 rounded-lg">
                                        <Zap className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-400 uppercase">实时功率</span>
                                </div>
                                <div className="text-2xl font-black text-slate-900">
                                    {monitoring?.summary?.currentPower?.toFixed(1) || 0}
                                    <span className="text-sm font-bold text-slate-400 ml-1">kW</span>
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-blue-50 rounded-lg">
                                        <Activity className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-400 uppercase">设备在线</span>
                                </div>
                                <div className="text-2xl font-black text-slate-900">
                                    {stationsSummary?.online || 0}/{stationsSummary?.total || 0}
                                    <span className="text-sm font-bold text-slate-400 ml-1">台</span>
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-amber-50 rounded-lg">
                                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-400 uppercase">活动告警</span>
                                </div>
                                <div className="text-2xl font-black text-slate-900">
                                    {alertsSummary?.active || 0}
                                    <span className="text-sm font-bold text-slate-400 ml-1">条</span>
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-purple-50 rounded-lg">
                                        <Wrench className="w-5 h-5 text-purple-500" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-400 uppercase">待办任务</span>
                                </div>
                                <div className="text-2xl font-black text-slate-900">
                                    {(maintenanceSummary?.scheduled || 0) + (maintenanceSummary?.inProgress || 0)}
                                    <span className="text-sm font-bold text-slate-400 ml-1">项</span>
                                </div>
                            </div>
                        </div>

                        {/* Power Chart */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-slate-900">发电功率曲线</h3>
                                <div className="flex gap-2">
                                    {['实时', '24小时', '7天', '30天'].map((label, i) => (
                                        <button
                                            key={i}
                                            className={cn(
                                                "px-3 py-1 text-xs font-bold rounded-lg transition-colors",
                                                i === 1 ? "bg-green-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={monitoring?.timeSeries?.slice(-24) || []}>
                                        <defs>
                                            <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis
                                            dataKey="time"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                                            tickFormatter={(val) => new Date(val).getHours() + ':00'}
                                        />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            labelFormatter={(val) => new Date(val).toLocaleString()}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="power"
                                            stroke="#10b981"
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#colorPower)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Two Column Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Latest Alerts */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-slate-900">最新告警</h3>
                                    <button
                                        onClick={() => setActiveTab('alerts')}
                                        className="text-xs font-bold text-green-600 hover:text-green-700 flex items-center gap-1"
                                    >
                                        查看全部 <ChevronRight className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {alerts.slice(0, 3).map(alert => (
                                        <div
                                            key={alert.id}
                                            className={cn(
                                                "p-4 rounded-xl border flex items-start gap-3",
                                                alert.type === 'error' ? "bg-red-50 border-red-100" :
                                                    alert.type === 'warning' ? "bg-amber-50 border-amber-100" :
                                                        "bg-slate-50 border-slate-100"
                                            )}
                                        >
                                            {getAlertIcon(alert.type)}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-slate-900">{alert.title}</div>
                                                <div className="text-xs text-slate-500 mt-1 line-clamp-1">{alert.description}</div>
                                                <div className="text-[10px] text-slate-400 mt-2">
                                                    {new Date(alert.createdAt).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {alerts.length === 0 && (
                                        <div className="text-center py-8 text-slate-400">
                                            <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <div className="text-sm">暂无告警</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Upcoming Maintenance */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-slate-900">维护计划</h3>
                                    <button
                                        onClick={() => setActiveTab('maintenance')}
                                        className="text-xs font-bold text-green-600 hover:text-green-700 flex items-center gap-1"
                                    >
                                        查看全部 <ChevronRight className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {maintenance.slice(0, 3).map(task => (
                                        <div
                                            key={task.id}
                                            className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex items-start gap-3"
                                        >
                                            <div className={cn(
                                                "p-2 rounded-lg",
                                                task.status === 'in_progress' ? "bg-blue-100" : "bg-slate-200"
                                            )}>
                                                <Wrench className={cn(
                                                    "w-4 h-4",
                                                    task.status === 'in_progress' ? "text-blue-600" : "text-slate-500"
                                                )} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-slate-900">{task.title}</div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className={cn(
                                                        "text-[10px] font-bold px-2 py-0.5 rounded",
                                                        task.priority === 'urgent' ? "bg-red-100 text-red-700" :
                                                            task.priority === 'high' ? "bg-amber-100 text-amber-700" :
                                                                "bg-slate-200 text-slate-600"
                                                    )}>
                                                        {task.priority === 'urgent' ? '紧急' : task.priority === 'high' ? '高优' : '常规'}
                                                    </span>
                                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(task.scheduledDate).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {maintenance.length === 0 && (
                                        <div className="text-center py-8 text-slate-400">
                                            <Wrench className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <div className="text-sm">暂无维护任务</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Devices Tab */}
                {activeTab === 'devices' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900">设备监控</h2>
                            <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors">
                                <Plus className="w-4 h-4" />
                                添加设备
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {stations.map(station => (
                                <div
                                    key={station.id}
                                    className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(station.status)}
                                            <span className="font-bold text-slate-900">{station.name}</span>
                                        </div>
                                        <span className={cn(
                                            "text-[10px] font-bold px-2 py-1 rounded",
                                            station.status === 'online' ? "bg-emerald-100 text-emerald-700" :
                                                station.status === 'warning' ? "bg-amber-100 text-amber-700" :
                                                    "bg-slate-100 text-slate-600"
                                        )}>
                                            {station.status === 'online' ? '在线' : station.status === 'warning' ? '告警' : '离线'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-slate-50 p-3 rounded-xl">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">功率</div>
                                            <div className="text-lg font-black text-slate-900">
                                                {station.power?.toFixed(1)} <span className="text-xs text-slate-400">kW</span>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">效率</div>
                                            <div className="text-lg font-black text-slate-900">
                                                {station.efficiency?.toFixed(1)} <span className="text-xs text-slate-400">%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1 text-slate-400">
                                            <Thermometer className="w-3 h-3" />
                                            {station.temperature?.toFixed(0)}°C
                                        </div>
                                        <div className="text-slate-400">
                                            更新于 {new Date(station.lastUpdate).toLocaleTimeString()}
                                        </div>
                                    </div>

                                    {station.alert && (
                                        <div className="mt-3 p-2 bg-amber-50 rounded-lg text-xs text-amber-700 flex items-center gap-2">
                                            <AlertTriangle className="w-3 h-3" />
                                            {station.alert}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {stations.length === 0 && (
                                <div className="col-span-full text-center py-16 text-slate-400">
                                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                    <div className="font-bold">暂无设备数据</div>
                                    <div className="text-sm mt-1">点击&quot;添加设备&quot;开始录入</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Alerts Tab */}
                {activeTab === 'alerts' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900">告警管理</h2>
                            <div className="flex gap-2">
                                <button className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-bold">全部</button>
                                <button className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold">活动</button>
                                <button className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold">已解决</button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {alerts.map(alert => (
                                <div
                                    key={alert.id}
                                    className={cn(
                                        "bg-white p-5 rounded-2xl border shadow-sm flex items-start gap-4",
                                        alert.status === 'resolved' ? "border-slate-100 opacity-60" :
                                            alert.type === 'error' ? "border-red-200" :
                                                alert.type === 'warning' ? "border-amber-200" :
                                                    "border-slate-100"
                                    )}
                                >
                                    {getAlertIcon(alert.type)}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-slate-900">{alert.title}</span>
                                            <span className={cn(
                                                "text-[10px] font-bold px-2 py-0.5 rounded",
                                                alert.status === 'active' ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
                                            )}>
                                                {alert.status === 'active' ? '待处理' : '已解决'}
                                            </span>
                                        </div>
                                        <div className="text-sm text-slate-600">{alert.description}</div>
                                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(alert.createdAt).toLocaleString()}
                                            </span>
                                            <span>{alert.deviceName}</span>
                                        </div>
                                    </div>
                                    {alert.status === 'active' && (
                                        <button className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors">
                                            确认
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Maintenance Tab */}
                {activeTab === 'maintenance' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900">维护计划</h2>
                            <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors">
                                <Plus className="w-4 h-4" />
                                新建任务
                            </button>
                        </div>

                        <div className="space-y-4">
                            {maintenance.map(task => (
                                <div
                                    key={task.id}
                                    className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-slate-900">{task.title}</span>
                                                <span className={cn(
                                                    "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                                                    task.status === 'in_progress' ? "bg-blue-100 text-blue-700" :
                                                        task.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                                                            "bg-slate-100 text-slate-600"
                                                )}>
                                                    {task.status === 'in_progress' ? '进行中' : task.status === 'completed' ? '已完成' : '已排期'}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-600">{task.description}</div>
                                        </div>
                                        <span className={cn(
                                            "text-[10px] font-bold px-2 py-1 rounded",
                                            task.priority === 'urgent' ? "bg-red-100 text-red-700" :
                                                task.priority === 'high' ? "bg-amber-100 text-amber-700" :
                                                    "bg-slate-100 text-slate-600"
                                        )}>
                                            {task.priority === 'urgent' ? '紧急' : task.priority === 'high' ? '高优先级' : '常规'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-4 gap-4 py-3 border-t border-slate-100">
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">计划时间</div>
                                            <div className="text-sm font-bold text-slate-900 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(task.scheduledDate).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">预计时长</div>
                                            <div className="text-sm font-bold text-slate-900">{task.estimatedDuration} 小时</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">负责人</div>
                                            <div className="text-sm font-bold text-slate-900">{task.assignedTo}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">涉及设备</div>
                                            <div className="text-sm font-bold text-slate-900">{task.devices?.join(', ') || '--'}</div>
                                        </div>
                                    </div>

                                    {task.notes && (
                                        <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                                            {task.notes}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
