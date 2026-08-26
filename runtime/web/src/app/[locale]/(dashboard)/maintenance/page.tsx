'use client';
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Zap,
    Thermometer,
    Wind,
    Droplets,
    Sun,
    Clock,
    TrendingUp,
    TrendingDown,
    Activity,
    Settings,
    Phone,
    FileText,
    ChevronRight,
    Sparkles,
    RefreshCw,
    Shield,
    Wrench,
    Eye,
    Battery,
    BarChart3,
    Target,
    Calendar,
    Bell,
    Cpu,
    Wifi,
    WifiOff,
    User
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { useStation, Station, Issue, MaintenanceRecord } from '@/contexts/StationContext';

// Removed hardcoded healthMetrics

const severityConfig = {
    error: { color: 'red', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', icon: XCircle, label: '严重' },
    warning: { color: 'amber', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', icon: AlertTriangle, label: '警告' },
    info: { color: 'blue', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', icon: Activity, label: '提示' }
};

const CleaningDecisionView = dynamic(() => import('@/components/maintenance/CleaningDecisionView'), { ssr: false });
const PRAnalysisView = dynamic(() => import('@/components/maintenance/PRAnalysisView'), { ssr: false });
const FaultLocalizationView = dynamic(() => import('@/components/maintenance/FaultLocalizationView'), { ssr: false });
const IVCurveAnalysisView = dynamic(() => import('@/components/maintenance/IVCurveAnalysisView'), { ssr: false });
const WorkPermitGeneratorView = dynamic(() => import('@/components/maintenance/WorkPermitGeneratorView'), { ssr: false });
const PredictiveMaintenanceView = dynamic(() => import('@/components/maintenance/PredictiveMaintenanceView'), { ssr: false });

const typeConfig = {
    solar: { icon: Sun, color: 'text-amber-500', bg: 'bg-amber-500' },
    wind: { icon: Wind, color: 'text-blue-500', bg: 'bg-blue-500' },
    storage: { icon: Battery, color: 'text-emerald-500', bg: 'bg-emerald-500' }
};

export default function MaintenancePage() {
    const { stations, issues, records, addStation } = useStation();
    const [selectedStation, setSelectedStation] = useState<Station | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'records' | 'devices' | 'cleaning' | 'pr' | 'diagnosis' | 'iv' | 'permit' | 'predictive'>('overview');
    const [refreshing, setRefreshing] = useState(false);

    // Initial station selection
    useEffect(() => {
        if (stations.length > 0 && !selectedStation) {
            setSelectedStation(stations[0]);
        }
    }, [stations, selectedStation]);

    // Handle empty state
    const currentStation = selectedStation || stations[0];

    if (!currentStation) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">暂无电站数据</div>;
    }

    const filteredIssues = issues.filter(i => i.stationId === currentStation.id);
    const activeIssues = filteredIssues.filter(i => !i.solved);
    const stationRecords = records.filter(r => r.stationId === currentStation.id);

    const handleRefresh = async () => {
        setRefreshing(true);
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));
        setRefreshing(false);
    };

    const handleCreateStation = () => {
        const types: ('solar' | 'wind' | 'storage')[] = ['solar', 'wind', 'storage'];
        const randomType = types[Math.floor(Math.random() * types.length)];
        const cities = ['保定', '张家口', '承德', '唐山', '雄安'];
        const city = cities[Math.floor(Math.random() * cities.length)];

        addStation({
            name: `${city}新区${randomType === 'solar' ? '光伏' : randomType === 'wind' ? '风电' : '储能'}示范站`,
            type: randomType,
            capacity: Math.floor(Math.random() * 500) + 50,
            status: 'healthy',
            location: `河北省${city}市`,
            installDate: new Date().toISOString().split('T')[0],
            lastCheck: new Date().toLocaleString('zh-CN', { hour12: false }),
            efficiency: 90 + Math.random() * 8,
            uptime: 98 + Math.random() * 2,
            dailyGeneration: Math.floor(Math.random() * 1000),
            deviceCount: Math.floor(Math.random() * 50) + 10
        });
    };

    // Calculate dynamic metrics
    const calculateMetrics = () => {
        if (!currentStation) return { overall: 0, efficiency: 0, reliability: 0, safety: 0 };

        const stationIssues = issues.filter(i => i.stationId === currentStation.id && !i.solved);
        const errorCount = stationIssues.filter(i => i.severity === 'error').length;
        const warningCount = stationIssues.filter(i => i.severity === 'warning').length;

        const safetyScore = Math.max(0, 100 - (errorCount * 20 + warningCount * 5));
        const efficiency = currentStation.efficiency;
        const reliability = currentStation.uptime;

        const overall = Math.round((safetyScore * 0.4) + (efficiency * 0.3) + (reliability * 0.3));

        return {
            overall,
            efficiency: Math.round(efficiency),
            reliability: Math.round(reliability),
            safety: Math.round(safetyScore)
        };
    };

    const healthMetrics = calculateMetrics();

    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            {/* Header */}
            <div className="bg-white border-b border-slate-100">
                <div className="px-6 py-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl flex items-center justify-center">
                                <Wrench className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-slate-900">运维诊断中心</h1>
                                <p className="text-sm text-slate-500">实时监控 · 智能预警 · 预测性维护</p>
                            </div>
                        </div>
                        <button
                            onClick={handleRefresh}
                            className={cn(
                                "p-3 rounded-xl bg-slate-100 hover:bg-slate-200 transition-all",
                                refreshing && "animate-spin"
                            )}
                        >
                            <RefreshCw className="w-5 h-5 text-slate-600" />
                        </button>
                    </div>

                    {/* Overall Health Dashboard */}
                    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[32px] p-6 text-white overflow-hidden relative">
                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-green-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
                        </div>

                        <div className="relative">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm text-slate-400 font-bold uppercase tracking-wider">整体健康度</span>
                                        {healthMetrics.overall >= 80 ? (
                                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-bold rounded-full flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" />
                                                优良
                                            </span>
                                        ) : healthMetrics.overall >= 60 ? (
                                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full">
                                                正常
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-bold rounded-full">
                                                需关注
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-6xl font-black flex items-baseline">
                                        {healthMetrics.overall}
                                        <span className="text-2xl ml-1">%</span>
                                    </div>
                                </div>
                                <div className={cn(
                                    "w-24 h-24 rounded-full flex items-center justify-center relative",
                                    healthMetrics.overall >= 80 ? "bg-gradient-to-br from-green-500 to-emerald-600" :
                                        healthMetrics.overall >= 60 ? "bg-gradient-to-br from-amber-500 to-orange-500" :
                                            "bg-gradient-to-br from-red-500 to-rose-600"
                                )}>
                                    <Shield className="w-12 h-12 text-white" />
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full">
                                        <div className="bg-white/10 backdrop-blur px-3 py-1 rounded-full text-xs font-bold">
                                            监控中
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: '发电效率', value: healthMetrics.efficiency, icon: Zap, trend: '+2.3%' },
                                    { label: '运行可靠', value: healthMetrics.reliability, icon: Activity, trend: '+0.8%' },
                                    { label: '安全状态', value: healthMetrics.safety, icon: Shield, trend: '0%' },
                                    { label: '待处理', value: activeIssues.length, icon: Bell, trend: '-1' }
                                ].map((metric, i) => (
                                    <div key={i} className="bg-white/5 backdrop-blur rounded-2xl p-4 text-center">
                                        <div className="flex items-center justify-center gap-1 mb-2">
                                            <metric.icon className="w-4 h-4 text-slate-400" />
                                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">{metric.label}</span>
                                        </div>
                                        <div className="text-2xl font-black flex items-center justify-center gap-1">
                                            {typeof metric.value === 'number' ? metric.value : metric.value}
                                            {typeof metric.value === 'number' && <span className="text-sm font-bold">%</span>}
                                        </div>
                                        {metric.trend && (
                                            <div className={cn(
                                                "text-[10px] font-bold flex items-center justify-center gap-0.5 mt-1",
                                                metric.trend.startsWith('+') ? "text-green-400" :
                                                    metric.trend.startsWith('-') ? "text-amber-400" : "text-slate-400"
                                            )}>
                                                {metric.trend.startsWith('+') && <TrendingUp className="w-3 h-3" />}
                                                {metric.trend.startsWith('-') && <TrendingDown className="w-3 h-3" />}
                                                {metric.trend}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-6">
                    <div className="flex gap-2 border-b border-slate-100 -mb-px overflow-x-auto">
                        {[
                            { id: 'overview', name: '概览', icon: BarChart3 },
                            { id: 'issues', name: '问题', icon: AlertTriangle, count: activeIssues.length },
                            { id: 'records', name: '记录', icon: FileText },
                            { id: 'devices', name: '设备', icon: Cpu },
                            { id: 'pr', name: 'PR分析', icon: Activity },
                            { id: 'cleaning', name: '清洗决策', icon: Droplets },
                            { id: 'diagnosis', name: '组串诊断', icon: Target },
                            { id: 'iv', name: 'IV扫描', icon: Activity },
                            { id: 'permit', name: '工作票', icon: FileText },
                            { id: 'predictive', name: '预测维护', icon: TrendingUp },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap",
                                    activeTab === tab.id
                                        ? "border-green-500 text-green-600"
                                        : "border-transparent text-slate-500 hover:text-slate-700"
                                )}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.name}
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Station Selector */}
            <div className="px-6 py-4">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <Target className="w-4 h-4" />
                        选择电站
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        {stations.map((station) => {
                            const typeConf = typeConfig[station.type];
                            return (
                                <button
                                    key={station.id}
                                    onClick={() => setSelectedStation(station)}
                                    className={cn(
                                        "flex-shrink-0 p-4 rounded-2xl border-2 transition-all text-left min-w-[240px] hover:shadow-lg",
                                        currentStation.id === station.id
                                            ? "bg-white border-green-500 shadow-lg shadow-green-500/10"
                                            : "bg-white border-slate-100 hover:border-slate-300"
                                    )}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", typeConf.bg + "/10")}>
                                                <typeConf.icon className={cn("w-5 h-5", typeConf.color)} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 text-sm line-clamp-1">{station.name}</div>
                                                <div className="text-xs text-slate-400">{station.location}</div>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "w-2.5 h-2.5 rounded-full flex-shrink-0",
                                            station.status === 'healthy' ? "bg-green-500" :
                                                station.status === 'warning' ? "bg-amber-500" :
                                                    station.status === 'error' ? "bg-red-500" : "bg-slate-400"
                                        )} />
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Zap className="w-3.5 h-3.5" />
                                                {station.capacity} kW
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Activity className="w-3.5 h-3.5" />
                                                {station.efficiency}%
                                            </span>
                                        </div>
                                        {station.status === 'error' && (
                                            <span className="text-red-500 font-bold flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" />
                                                故障
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}

                        {/* Add Station Button */}
                        <button
                            onClick={handleCreateStation}
                            className="flex-shrink-0 p-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 hover:shadow-md transition-all text-left min-w-[240px] flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-green-600 group"
                        >
                            <div className="w-12 h-12 rounded-full bg-white border border-slate-200 group-hover:border-green-500 group-hover:bg-green-50 flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">+</span>
                            </div>
                            <span className="font-bold text-sm">新建电站项目</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
                <div className="max-w-6xl mx-auto">
                    {activeTab === 'overview' && (
                        <OverviewTab
                            station={currentStation}
                            issues={activeIssues}
                            onTabChange={setActiveTab}
                        />
                    )}
                    {activeTab === 'issues' && (
                        <IssuesTab
                            issues={filteredIssues}
                            onStationChange={(s: Station) => setSelectedStation(s)}
                        />
                    )}
                    {activeTab === 'records' && (
                        <RecordsTab records={stationRecords} station={currentStation} />
                    )}
                    {activeTab === 'devices' && (
                        <DevicesTab station={currentStation} />
                    )}
                    {activeTab === 'cleaning' && (
                        <CleaningDecisionView
                            stationId={currentStation.id}
                            stationName={currentStation.name}
                            capacity={currentStation.capacity}
                            location={currentStation.location}
                        />
                    )}
                    {activeTab === 'pr' && (
                        <PRAnalysisView
                            stationId={currentStation.id}
                            capacity={currentStation.capacity}
                            location={{ lat: 39.9, lng: 116.4 }} // Mock location, assume context provide it later
                        />
                    )}
                    {activeTab === 'diagnosis' && (
                        <FaultLocalizationView />
                    )}
                    {activeTab === 'iv' && (
                        <IVCurveAnalysisView />
                    )}
                    {activeTab === 'permit' && (
                        <WorkPermitGeneratorView />
                    )}
                    {activeTab === 'predictive' && (
                        <PredictiveMaintenanceView />
                    )}
                </div>
            </div>

            {/* Fixed Bottom CTA */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-xl border-t border-slate-100 z-40">
                <div className="max-w-6xl mx-auto">
                    <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-4 text-white flex items-center justify-between shadow-lg shadow-green-500/20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-bold">升级专业版</div>
                                <div className="text-xs opacity-80">解锁AI预测性维护和自动工单</div>
                            </div>
                        </div>
                        <button className="px-4 py-2 bg-white text-green-600 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors">
                            立即升级
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Overview Tab Component
function OverviewTab({ station, issues, onTabChange }: { station: Station; issues: Issue[]; onTabChange: (tab: any) => void }) {
    const typeConf = typeConfig[station.type];

    return (
        <div className="space-y-6">
            {/* Station Stats */}
            <div className="bg-white rounded-[24px] border border-slate-100 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900">电站状态</h3>
                    <span className="text-sm text-slate-400 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        更新于 {new Date().toLocaleTimeString('zh-CN')}
                    </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                            <Zap className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase">装机容量</span>
                        </div>
                        <div className="text-2xl font-black text-slate-900">{station.capacity} <span className="text-sm font-bold text-slate-400">kW</span></div>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                            <Sun className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase">今日发电</span>
                        </div>
                        <div className="text-2xl font-black text-slate-900">{station.dailyGeneration} <span className="text-sm font-bold text-slate-400">kWh</span></div>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                            <Activity className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase">运行效率</span>
                        </div>
                        <div className="text-2xl font-black text-slate-900">{station.efficiency}%</div>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                            <Clock className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase">运行时间</span>
                        </div>
                        <div className="text-2xl font-black text-slate-900">{station.uptime}%</div>
                    </div>
                </div>
            </div>

            {/* Performance Chart Placeholder */}
            <div className="bg-white rounded-[24px] border border-slate-100 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900">发电趋势</h3>
                    <div className="flex gap-2">
                        {['7天', '30天', '90天'].map(period => (
                            <button key={period} className="px-3 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">
                                {period}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="h-64 flex items-center justify-center bg-slate-50 rounded-2xl">
                    <div className="text-center">
                        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                        <p className="text-slate-400 text-sm">7天发电趋势图</p>
                    </div>
                </div>
            </div>

            {/* Active Issues Preview */}
            {issues.length > 0 && (
                <div className="bg-white rounded-[24px] border border-slate-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            待处理问题
                        </h3>
                        <button
                            onClick={() => onTabChange('issues')}
                            className="text-sm text-green-600 font-bold flex items-center gap-1"
                        >
                            查看全部
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-3">
                        {issues.slice(0, 2).map(issue => {
                            const config = severityConfig[issue.severity];
                            const Icon = config.icon;
                            return (
                                <div key={issue.id} className={cn("p-4 rounded-xl border", config.bg, config.border)}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Icon className={cn("w-4 h-4", config.text)} />
                                        <span className="font-bold text-sm text-slate-900">{issue.title}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 ml-6">{issue.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { icon: FileText, title: '生成报告', desc: '导出运维报告' },
                    { icon: Phone, title: '联系专家', desc: '在线客服支持' },
                    { icon: Calendar, title: '预约巡检', desc: '安排定期维护' },
                    { icon: Wrench, title: '报修', desc: '提交维修工单' },
                ].map((action, i) => (
                    <button key={i} className="bg-white p-5 rounded-[20px] border border-slate-100 hover:shadow-lg transition-all text-left">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-3">
                            <action.icon className="w-5 h-5 text-slate-600" />
                        </div>
                        <div className="font-bold text-slate-900 text-sm">{action.title}</div>
                        <div className="text-xs text-slate-400">{action.desc}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// Issues Tab Component
function IssuesTab({ issues, onStationChange }: { issues: Issue[]; onStationChange: (s: Station) => void }) {
    const { resolveIssue, dismissIssue } = useStation();

    const activeIssues = issues.filter(i => !i.solved);
    const solvedIssues = issues.filter(i => i.solved);

    return (
        <div className="space-y-6">
            {/* Active Issues */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        待处理问题
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-600 text-xs font-bold rounded-full">
                            {activeIssues.length}
                        </span>
                    </h3>
                </div>

                {activeIssues.length > 0 ? (
                    <div className="space-y-4">
                        {activeIssues.map(issue => {
                            const config = severityConfig[issue.severity];
                            const Icon = config.icon;

                            return (
                                <div
                                    key={issue.id}
                                    className={cn(
                                        "bg-white rounded-[24px] border-2 p-6 transition-all hover:shadow-xl",
                                        config.border
                                    )}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0", config.bg)}>
                                            <Icon className={cn("w-6 h-6", config.text)} />
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <span className={cn("text-xs font-bold uppercase px-2 py-1 rounded-full", config.bg, config.text)}>
                                                    {config.label}
                                                </span>
                                                <span className="text-sm font-bold text-slate-900">{issue.title}</span>
                                            </div>

                                            <p className="text-slate-500 text-sm mb-4">{issue.description}</p>

                                            <div className="bg-slate-50 rounded-2xl p-4 mb-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Sparkles className="w-4 h-4 text-green-500" />
                                                    <span className="text-sm font-bold text-slate-900">建议解决方案</span>
                                                </div>
                                                <p className="text-sm text-slate-600">{issue.suggestion}</p>
                                            </div>

                                            <div className="flex items-center justify-between flex-wrap gap-4">
                                                <div className="flex items-center gap-4 text-sm">
                                                    <div className="flex items-center gap-1.5">
                                                        <TrendingDown className="w-4 h-4 text-red-500" />
                                                        <span className="text-slate-500">预计损失：</span>
                                                        <span className="font-bold text-red-500">{issue.estimatedLoss}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-slate-400">
                                                        <Clock className="w-4 h-4" />
                                                        <span>{new Date(issue.createdAt).toLocaleDateString('zh-CN')}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => dismissIssue(issue.id)}
                                                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                                                    >
                                                        忽略
                                                    </button>
                                                    <button
                                                        onClick={() => resolveIssue(issue.id)}
                                                        className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition-colors"
                                                    >
                                                        立即处理
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white rounded-[24px] border-2 border-green-200 p-8 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">一切正常！</h3>
                        <p className="text-slate-500">该电站暂无需要处理的问题</p>
                    </div>
                )}
            </div>

            {/* Solved Issues */}
            {solvedIssues.length > 0 && (
                <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        已解决问题
                    </h3>
                    <div className="bg-white rounded-[24px] border border-slate-100 divide-y divide-slate-100">
                        {solvedIssues.map(issue => (
                            <div key={issue.id} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    <span className="font-bold text-slate-700">{issue.title}</span>
                                </div>
                                <button className="text-sm text-slate-400 flex items-center gap-1 hover:text-slate-600">
                                    <Eye className="w-4 h-4" />
                                    查看
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Records Tab Component
function RecordsTab({ records, station }: { records: MaintenanceRecord[]; station: Station }) {
    const typeConfigMap = {
        inspection: { icon: Eye, color: 'text-blue-500', bg: 'bg-blue-50' },
        repair: { icon: Wrench, color: 'text-amber-500', bg: 'bg-amber-50' },
        cleaning: { icon: Droplets, color: 'text-cyan-500', bg: 'bg-cyan-50' },
        replacement: { icon: RefreshCw, color: 'text-purple-500', bg: 'bg-purple-50' }
    };

    const statusConfig = {
        completed: { text: '已完成', color: 'text-green-600', bg: 'bg-green-100' },
        in_progress: { text: '进行中', color: 'text-amber-600', bg: 'bg-amber-100' },
        scheduled: { text: '待执行', color: 'text-blue-600', bg: 'bg-blue-100' }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">维护记录</h3>
                <button className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition-colors">
                    新建工单
                </button>
            </div>

            <div className="space-y-4">
                {records.length > 0 ? (
                    records.map(record => {
                        const typeConf = typeConfigMap[record.type];
                        const statusConf = statusConfig[record.status];
                        return (
                            <div key={record.id} className="bg-white rounded-[24px] border border-slate-100 p-6">
                                <div className="flex items-start gap-4">
                                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0", typeConf.bg)}>
                                        <typeConf.icon className={cn("w-6 h-6", typeConf.color)} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-bold text-slate-900">{record.title}</h4>
                                            <span className={cn("px-2 py-1 rounded-lg text-xs font-bold", statusConf.bg, statusConf.color)}>
                                                {statusConf.text}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4" />
                                                {record.date}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <User className="w-4 h-4" />
                                                {record.technician}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Zap className="w-4 h-4" />
                                                ¥{record.cost}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="bg-white rounded-[24px] border border-slate-100 p-8 text-center">
                        <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-500">暂无维护记录</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Devices Tab Component
function DevicesTab({ station }: { station: Station }) {
    const devices = Array.from({ length: station.deviceCount }, (_, i) => ({
        id: `${station.id}-${i + 1}`,
        name: `${station.type === 'solar' ? '光伏组串' : station.type === 'wind' ? '风机' : '电池模组'} #${i + 1}`,
        status: i === 2 && station.status === 'error' ? 'error' :
            i === 4 && station.status === 'warning' ? 'warning' : 'healthy',
        efficiency: i === 2 && station.status === 'error' ? 72 :
            i === 4 && station.status === 'warning' ? 88 : 94 + Math.random() * 4,
        temperature: 35 + Math.random() * 10,
        online: Math.random() > 0.05
    }));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">设备列表</h3>
                <span className="text-sm text-slate-400">共 {station.deviceCount} 台设备</span>
            </div>

            <div className="grid gap-4">
                {devices.map((device, i) => (
                    <div
                        key={device.id}
                        className={cn(
                            "bg-white rounded-[20px] border p-5 transition-all",
                            device.status === 'error' ? "border-red-200 bg-red-50/30" :
                                device.status === 'warning' ? "border-amber-200 bg-amber-50/30" :
                                    "border-slate-100 hover:shadow-lg"
                        )}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center",
                                    device.status === 'error' ? "bg-red-100" :
                                        device.status === 'warning' ? "bg-amber-100" : "bg-slate-100"
                                )}>
                                    <Cpu className={cn(
                                        "w-5 h-5",
                                        device.status === 'error' ? "text-red-500" :
                                            device.status === 'warning' ? "text-amber-500" : "text-slate-500"
                                    )} />
                                </div>
                                <div>
                                    <div className="font-bold text-slate-900">{device.name}</div>
                                    <div className="text-xs text-slate-400 flex items-center gap-1">
                                        {device.online ? (
                                            <>
                                                <Wifi className="w-3 h-3 text-green-500" />
                                                在线
                                            </>
                                        ) : (
                                            <>
                                                <WifiOff className="w-3 h-3 text-red-500" />
                                                离线
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className={cn(
                                "w-2.5 h-2.5 rounded-full",
                                device.status === 'error' ? "bg-red-500 animate-pulse" :
                                    device.status === 'warning' ? "bg-amber-500" : "bg-green-500"
                            )} />
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-1.5">
                                <span className="text-slate-400">效率</span>
                                <span className="font-bold text-slate-900">{device.efficiency.toFixed(1)}%</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-slate-400">温度</span>
                                <span className="font-bold text-slate-900">{device.temperature.toFixed(0)}°C</span>
                            </div>
                            {device.status === 'error' && (
                                <span className="text-red-500 font-bold text-sm ml-auto">需要维护</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
