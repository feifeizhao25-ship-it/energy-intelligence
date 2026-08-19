'use client';

import { useState, useEffect } from 'react';
import {
    Key,
    Plus,
    Trash2,
    Copy,
    Check,
    Eye,
    EyeOff,
    BarChart3,
    FileText,
    AlertCircle,
    TrendingUp,
    Activity,
    Clock,
    Shield,
    Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiKey {
    id: string;
    name: string;
    keyPreview: string;
    permissions: string[];
    rateLimit: number;
    createdAt: string;
    lastUsedAt?: string;
    status: 'active' | 'revoked' | 'expired';
    usageCount: number;
}

export default function DeveloperPage() {
    const [activeTab, setActiveTab] = useState<'keys' | 'usage' | 'docs'>('keys');
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newKeyData, setNewKeyData] = useState<any>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    // 获取 API Keys
    useEffect(() => {
        fetchApiKeys();
    }, []);

    const fetchApiKeys = async () => {
        try {
            const res = await fetch('/api/developer/keys');
            const data = await res.json();
            if (data.success) {
                setApiKeys(data.data.keys);
            }
        } catch (error) {
            console.error('Failed to fetch API keys:', error);
        } finally {
            setLoading(false);
        }
    };

    const createApiKey = async (formData: any) => {
        try {
            const res = await fetch('/api/developer/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                setNewKeyData(data.data);
                fetchApiKeys();
            }
        } catch (error) {
            console.error('Failed to create API key:', error);
        }
    };

    const revokeApiKey = async (keyId: string) => {
        if (!confirm('确定要撤销此 API Key 吗？此操作不可逆。')) return;

        try {
            const res = await fetch(`/api/developer/keys?id=${keyId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                fetchApiKeys();
            }
        } catch (error) {
            console.error('Failed to revoke API key:', error);
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(id);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-blue-500 rounded-xl">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900">开发者中心</h1>
                            <p className="text-slate-500 text-sm">管理您的 API Keys 和查看使用情况</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                    {[
                        { id: 'keys', label: 'API Keys', icon: Key },
                        { id: 'usage', label: '使用统计', icon: BarChart3 },
                        { id: 'docs', label: 'API 文档', icon: FileText }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all",
                                activeTab === tab.id
                                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                                    : "text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {activeTab === 'keys' && (
                    <div>
                        {/* Quick Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="p-2 bg-green-50 rounded-lg">
                                        <Key className="w-5 h-5 text-green-500" />
                                    </div>
                                    <span className="text-2xl font-black text-slate-900">
                                        {apiKeys.filter(k => k.status === 'active').length}
                                    </span>
                                </div>
                                <div className="text-sm font-bold text-slate-500">活跃 Keys</div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="p-2 bg-blue-50 rounded-lg">
                                        <Activity className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <span className="text-2xl font-black text-slate-900">
                                        {apiKeys.reduce((sum, k) => sum + k.usageCount, 0)}
                                    </span>
                                </div>
                                <div className="text-sm font-bold text-slate-500">总调用次数</div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="p-2 bg-purple-50 rounded-lg">
                                        <Zap className="w-5 h-5 text-purple-500" />
                                    </div>
                                    <span className="text-2xl font-black text-slate-900">
                                        {apiKeys[0]?.rateLimit || 60}
                                    </span>
                                </div>
                                <div className="text-sm font-bold text-slate-500">次/分钟</div>
                            </div>
                        </div>

                        {/* Create Button */}
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-black text-slate-900">我的 API Keys</h2>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30"
                            >
                                <Plus className="w-4 h-4" />
                                创建新 Key
                            </button>
                        </div>

                        {/* API Keys List */}
                        <div className="space-y-4">
                            {loading ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                                    <p className="text-slate-500">加载中...</p>
                                </div>
                            ) : apiKeys.length === 0 ? (
                                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
                                    <Key className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-bold text-slate-900 mb-2">还没有 API Key</h3>
                                    <p className="text-slate-500 mb-4">创建您的第一个 API Key 开始使用开放 API</p>
                                    <button
                                        onClick={() => setShowCreateModal(true)}
                                        className="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors"
                                    >
                                        立即创建
                                    </button>
                                </div>
                            ) : (
                                apiKeys.map((key) => (
                                    <div key={key.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-lg font-black text-slate-900">{key.name}</h3>
                                                    <span className={cn(
                                                        "px-3 py-1 rounded-full text-xs font-bold",
                                                        key.status === 'active' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                                                    )}>
                                                        {key.status === 'active' ? '活跃' : '已撤销'}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 mb-3">
                                                    <code className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-mono text-sm">
                                                        {key.keyPreview}
                                                    </code>
                                                    <button
                                                        onClick={() => copyToClipboard(key.keyPreview, key.id)}
                                                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                                    >
                                                        {copiedKey === key.id ? (
                                                            <Check className="w-4 h-4 text-green-500" />
                                                        ) : (
                                                            <Copy className="w-4 h-4 text-slate-400" />
                                                        )}
                                                    </button>
                                                </div>

                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    {key.permissions.map((perm, idx) => (
                                                        <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">
                                                            {perm}
                                                        </span>
                                                    ))}
                                                </div>

                                                <div className="flex items-center gap-6 text-sm text-slate-500">
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-4 h-4" />
                                                        创建于 {new Date(key.createdAt).toLocaleDateString()}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Activity className="w-4 h-4" />
                                                        {key.usageCount} 次调用
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Zap className="w-4 h-4" />
                                                        {key.rateLimit}/min
                                                    </div>
                                                </div>
                                            </div>

                                            {key.status === 'active' && (
                                                <button
                                                    onClick={() => revokeApiKey(key.id)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'usage' && (
                    <UsageStats />
                )}

                {activeTab === 'docs' && (
                    <ApiDocs />
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <CreateKeyModal
                    onClose={() => {
                        setShowCreateModal(false);
                        setNewKeyData(null);
                    }}
                    onCreate={createApiKey}
                    newKeyData={newKeyData}
                />
            )}
        </div>
    );
}

// Create Key Modal Component
function CreateKeyModal({ onClose, onCreate, newKeyData }: any) {
    const [formData, setFormData] = useState({
        name: '',
        permissions: ['read:projects', 'read:monitoring'],
        rateLimit: 60
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onCreate(formData);
    };

    if (newKeyData) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
                <div className="bg-white rounded-2xl p-8 max-w-2xl w-full">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Check className="w-8 h-8 text-green-500" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">API Key 创建成功！</h2>
                        <p className="text-slate-500">请妥善保存此 Key，它只会显示一次</p>
                    </div>

                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <div className="font-bold text-yellow-900 mb-1">重要提示</div>
                                <div className="text-sm text-yellow-700">请立即复制并保存此 API Key。关闭此窗口后将无法再次查看完整 Key。</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl mb-6">
                        <div className="text-sm font-bold text-slate-500 mb-2">您的 API Key</div>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 p-3 bg-white border border-slate-200 rounded-lg font-mono text-sm overflow-x-auto">
                                {newKeyData.key}
                            </code>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(newKeyData.key);
                                    alert('已复制到剪贴板！');
                                }}
                                className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                <Copy className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                        <div>
                            <div className="text-slate-500 font-bold mb-1">名称</div>
                            <div className="text-slate-900">{newKeyData.name}</div>
                        </div>
                        <div>
                            <div className="text-slate-500 font-bold mb-1">速率限制</div>
                            <div className="text-slate-900">{newKeyData.rateLimit} 次/分钟</div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                    >
                        我已保存，关闭
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full">
                <h2 className="text-2xl font-black text-slate-900 mb-6">创建新的 API Key</h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Key 名称 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="例如：生产环境 Key"
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            速率限制 (次/分钟)
                        </label>
                        <input
                            type="number"
                            value={formData.rateLimit}
                            onChange={(e) => setFormData({ ...formData, rateLimit: parseInt(e.target.value) })}
                            min="10"
                            max="1000"
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">最大 1000 次/分钟</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3">
                            权限选择
                        </label>
                        <div className="space-y-2">
                            {[
                                { value: 'read:projects', label: '读取项目数据' },
                                { value: 'read:monitoring', label: '读取监控数据' },
                                { value: 'read:analytics', label: '读取分析数据' },
                                { value: 'read:papers', label: '读取文献数据' }
                            ].map((perm) => (
                                <label key={perm.value} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.permissions.includes(perm.value)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setFormData({
                                                    ...formData,
                                                    permissions: [...formData.permissions, perm.value]
                                                });
                                            } else {
                                                setFormData({
                                                    ...formData,
                                                    permissions: formData.permissions.filter(p => p !== perm.value)
                                                });
                                            }
                                        }}
                                        className="w-5 h-5 text-blue-500 rounded"
                                    />
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-900">{perm.label}</div>
                                        <div className="text-xs text-slate-500">{perm.value}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors"
                        >
                            创建 API Key
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Usage Stats Component
function UsageStats() {
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/developer/usage');
            const data = await res.json();
            if (data.success) {
                setStats(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    if (!stats) {
        return <div className="text-center py-12">加载中...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                    <div className="text-sm font-bold text-slate-500 mb-2">总调用次数</div>
                    <div className="text-3xl font-black text-slate-900">{stats.overview.totalCalls}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                    <div className="text-sm font-bold text-slate-500 mb-2">最近24小时</div>
                    <div className="text-3xl font-black text-slate-900">{stats.overview.callsLast24h}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                    <div className="text-sm font-bold text-slate-500 mb-2">平均延迟</div>
                    <div className="text-3xl font-black text-slate-900">{stats.overview.avgLatency}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                    <div className="text-sm font-bold text-slate-500 mb-2">成功率</div>
                    <div className="text-3xl font-black text-green-500">{stats.overview.successRate}</div>
                </div>
            </div>

            {/* Endpoint Usage */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200">
                <h3 className="text-lg font-black text-slate-900 mb-4">热门端点</h3>
                <div className="space-y-3">
                    {stats.byEndpoint.map((endpoint: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-4">
                            <div className="flex-1">
                                <code className="text-sm text-slate-600">{endpoint.endpoint}</code>
                            </div>
                            <div className="font-bold text-slate-900">{endpoint.count} 次</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// API Docs Component
function ApiDocs() {
    return (
        <div className="bg-white p-8 rounded-2xl border border-slate-200">
            <h2 className="text-2xl font-black text-slate-900 mb-6">API 文档</h2>

            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Demo API Key</h3>
                    <p className="text-slate-600 mb-3">用于测试的演示 Key（只读权限）：</p>
                    <code className="block p-4 bg-slate-100 rounded-xl text-sm font-mono">
                        xny_pk_demo_1234567890abcdef
                    </code>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">认证方式</h3>
                    <p className="text-slate-600 mb-3">在请求头中携带 API Key：</p>
                    <code className="block p-4 bg-slate-100 rounded-xl text-sm font-mono">
                        X-API-Key: your_api_key
                    </code>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">示例请求</h3>
                    <pre className="p-4 bg-slate-900 text-green-400 rounded-xl text-sm overflow-x-auto">
                        {`curl http://localhost:3001/api/v1/projects \\
  -H "X-API-Key: xny_pk_demo_1234567890abcdef"`}
                    </pre>
                </div>

                <div className="flex gap-3">
                    <a
                        href="/api/v1/docs"
                        target="_blank"
                        className="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors inline-flex items-center gap-2"
                    >
                        <FileText className="w-5 h-5" />
                        查看完整文档
                    </a>
                    <a
                        href="/docs/OPEN_API.md"
                        target="_blank"
                        className="px-6 py-3 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-2"
                    >
                        <FileText className="w-5 h-5" />
                        使用指南
                    </a>
                </div>
            </div>
        </div>
    );
}
