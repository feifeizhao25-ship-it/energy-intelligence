'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Zap,
    Wind,
    Battery,
    Sparkles,
    MapPin,
    ArrowRight,
    Calculator,
    TrendingUp,
    Sun,
    Cloud,
    Droplets,
    Leaf,
    Coins,
    Home,
    Building2,
    Users,
    Award,
    FileText,
    Settings,
    Bell,
    ChevronRight,
    Target,
    Flame,
    Calendar,
    BarChart3,
    Activity,
    Eye,
    Download,
    Share2,
    Play,
    Check,
    Phone,
    MessageCircle,
    Star,
    Shield,
    Clock,
    Calculator as CalcIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale, useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete';
import InternationalLanding from '@/components/home/InternationalLanding';

// 快速计算结果展示组件
function QuickResultCard({ icon: Icon, label, value, unit, color }: any) {
    return (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-2", color.bg)}>
                <Icon className={cn("w-5 h-5", color.text)} />
            </div>
            <div className="text-2xl font-black text-slate-900">{value}</div>
            <div className="text-xs text-slate-400 flex items-center gap-1">
                <span>{label}</span>
                <span>{unit}</span>
            </div>
        </div>
    );
}

export default function HomePage() {
    const t = useTranslations('Index');
    const locale = useLocale();
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);
    const [location, setLocation] = useState('');
    const [capacity, setCapacity] = useState(100);
    const [isCalculating, setIsCalculating] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [result, setResult] = useState<any>(null);
    const contactPhone = process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim();
    const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (locale === 'en') return <InternationalLanding />;

    const handleQuickCalc = async () => {
        if (!location.trim() || capacity <= 0) return;

        setIsCalculating(true);

        try {
            // 调用真实API
            const response = await fetch('/api/calculator/quick', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ location, capacity })
            });

            const data = await response.json();

            if (data.success) {
                setResult({
                    annualGeneration: data.data.energy.annualGeneration,
                    dailyGeneration: data.data.energy.dailyGeneration,
                    monthlyRevenue: data.data.financial.monthlyRevenue,
                    co2Reduction: data.data.environmental.co2Reduction,
                    trees: data.data.environmental.treesEquivalent,
                    payback: data.data.financial.paybackYears,
                    irr: data.data.financial.irr,
                    province: data.data.location.province
                });
                setShowResult(true);
            } else {
                // 显示错误提示
                alert(data.message || '计算失败，请检查地址是否正确');
            }
        } catch (error) {
            console.error('Quick calc error:', error);
            alert('网络错误，请稍后重试');
        } finally {
            setIsCalculating(false);
        }
    };

    const handleSaveAndContinue = () => {
        // 跳转到注册页面，并带上计算结果
        router.push(`/login?callbackUrl=/calculator/result&from=quick-calc`);
    };

    if (!isClient) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                            <Zap className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-base sm:text-xl text-slate-900 whitespace-nowrap">新能源智库</span>
                    </div>
                    <div className="hidden md:flex items-center gap-8">
                        <Link href="#features" className="text-slate-600 hover:text-green-600 text-sm font-medium">功能介绍</Link>
                        <Link href="#calculator" className="text-slate-600 hover:text-green-600 text-sm font-medium">在线计算</Link>
                        <Link href="#cases" className="text-slate-600 hover:text-green-600 text-sm font-medium">客户案例</Link>
                        <Link href="/pricing" className="text-slate-600 hover:text-green-600 text-sm font-medium">价格方案</Link>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
                        <LanguageSwitcher />
                        <Link href="/login" className="whitespace-nowrap text-slate-600 hover:text-green-600 text-sm font-medium">登录</Link>
                        <Link href="/login" className="whitespace-nowrap px-2.5 sm:px-4 py-2 bg-green-500 text-white text-sm font-bold rounded-xl hover:bg-green-600 transition-colors">
                            <span className="sm:hidden">注册</span><span className="hidden sm:inline">免费注册</span>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-24 pb-12 px-4 bg-gradient-to-b from-slate-900 to-slate-800 text-white">
                <div className="max-w-6xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        {/* Left Content */}
                        <div>
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-full mb-6">
                                <Sparkles className="w-4 h-4 text-green-400" />
                                <span className="text-sm font-bold text-green-400">AI驱动的智能决策系统</span>
                            </div>

                            <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight">
                                {t('hero.title')}<br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                                    {t('hero.subtitle')}
                                </span>
                            </h1>

                            <p className="text-xl text-slate-300 mb-8">
                                基于NASA气象数据和AI深度分析，为您提供专业级的光伏/风电项目投资决策报告
                            </p>

                            <div className="flex flex-wrap gap-4">
                                <Link
                                    href="#calculator"
                                    className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-all shadow-lg shadow-green-500/25 animate-pulse ring-2 ring-green-400/50 ring-offset-2 ring-offset-slate-900"
                                >
                                    <Play className="w-5 h-5" />
                                    立即体验计算
                                </Link>
                                <Link
                                    href="/developer/docs"
                                    className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors"
                                >
                                    <FileText className="w-5 h-5" />
                                    查看API文档
                                </Link>
                            </div>

                            {/* 社交证明 */}
                            <div className="mt-6 flex items-center gap-3 bg-white/5 rounded-full px-4 py-2 w-fit">
                                <div className="flex -space-x-2">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-white">
                                            {String.fromCharCode(65 + i)}
                                        </div>
                                    ))}
                                </div>
                                <span className="text-sm text-slate-300">
                                    <span className="font-bold text-green-400">假设与来源</span> 全程留痕可审计
                                </span>
                            </div>

                            {/* Trust Badges */}
                            <div className="mt-10 flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-green-400" />
                                    <span className="text-sm text-slate-400">数据权威</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-green-400" />
                                    <span className="text-sm text-slate-400">快速响应</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Star className="w-5 h-5 text-green-400" />
                                    <span className="text-sm text-slate-400">专业可靠</span>
                                </div>
                            </div>
                        </div>

                        {/* Right - Quick Calculator Demo */}
                        <div className="bg-white rounded-3xl p-6 shadow-2xl" id="calculator">
                            <div className="flex items-center gap-2 mb-6">
                                <CalcIcon className="w-6 h-6 text-green-500" />
                                <h2 className="text-xl font-bold text-slate-900">快速发电量估算</h2>
                            </div>

                            {!showResult ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            项目地址
                                        </label>
                                        <AddressAutocomplete
                                            value={location}
                                            onChange={setLocation}
                                            placeholder="输入城市或地点，如：北京朝阳"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            装机容量 (kW)
                                        </label>
                                        <input
                                            type="number"
                                            value={capacity}
                                            onChange={(e) => setCapacity(Number(e.target.value))}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-slate-900 placeholder:text-slate-400"
                                        />
                                        <div className="flex gap-2 mt-2">
                                            {[50, 100, 200, 500].map((cap) => (
                                                <button
                                                    key={cap}
                                                    onClick={() => setCapacity(cap)}
                                                    className={cn(
                                                        "px-3 py-1 rounded-lg text-sm font-medium transition-colors",
                                                        capacity === cap
                                                            ? "bg-green-500 text-white"
                                                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                                                    )}
                                                >
                                                    {cap}kW
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleQuickCalc}
                                        disabled={!location.trim() || isCalculating}
                                        className="w-full py-4 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isCalculating ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                计算中...
                                            </>
                                        ) : (
                                            <>
                                                <Zap className="w-5 h-5" />
                                                立即计算
                                            </>
                                        )}
                                    </button>

                                    <p className="text-xs text-center text-slate-400">
                                        无需注册，立即查看估算结果
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <QuickResultCard
                                            icon={Sun}
                                            label="年发电量"
                                            value={result.annualGeneration.toLocaleString()}
                                            unit="kWh"
                                            color={{ bg: 'bg-amber-100', text: 'text-amber-600' }}
                                        />
                                        <QuickResultCard
                                            icon={Coins}
                                            label="预计年收益"
                                            value={`¥${Math.round(result.annualGeneration * 0.5).toLocaleString()}`}
                                            unit="元"
                                            color={{ bg: 'bg-green-100', text: 'text-green-600' }}
                                        />
                                        <QuickResultCard
                                            icon={Leaf}
                                            label="年减碳"
                                            value={result.co2Reduction.toLocaleString()}
                                            unit="kg"
                                            color={{ bg: 'bg-blue-100', text: 'text-blue-600' }}
                                        />
                                        <QuickResultCard
                                            icon={Target}
                                            label="投资回收期"
                                            value={result.payback}
                                            unit="年"
                                            color={{ bg: 'bg-purple-100', text: 'text-purple-600' }}
                                        />
                                    </div>

                                    <div className="bg-slate-50 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-slate-600">内部收益率 (IRR)</span>
                                            <span className="font-bold text-green-600">{result.irr}%</span>
                                        </div>
                                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                                                style={{ width: `${Math.min(Number(result.irr) * 5, 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSaveAndContinue}
                                        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <span>查看完整分析报告</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowResult(false);
                                            setResult(null);
                                        }}
                                        className="w-full py-3 text-slate-500 font-medium hover:text-slate-700 transition-colors"
                                    >
                                        重新计算
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-12 bg-white border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {[
                            { value: '假设可见', label: '关键参数可调整', icon: Building2 },
                            { value: '来源可溯', label: '数据出处与时间记录', icon: Zap },
                            { value: '31', label: '覆盖省市', icon: MapPin },
                            { value: '人工复核', label: '结论导出前确认', icon: Star },
                        ].map((stat, i) => (
                            <div key={i} className="text-center">
                                <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <stat.icon className="w-6 h-6 text-green-600" />
                                </div>
                                <div className="text-3xl font-black text-slate-900">{stat.value}</div>
                                <div className="text-sm text-slate-500">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-16 px-4">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-black text-slate-900 mb-4">核心功能</h2>
                        <p className="text-lg text-slate-500">专业级的新能源项目分析工具</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                icon: Sun,
                                title: '光伏发电计算',
                                description: '基于NASA辐射数据，精确计算25年发电量和投资回报',
                                color: 'amber',
                                link: '/calculator/solar'
                            },
                            {
                                icon: Wind,
                                title: '风电效益分析',
                                description: '分散式风电项目评估，智能推荐最优装机方案',
                                color: 'cyan',
                                link: '/calculator/wind'
                            },
                            {
                                icon: Battery,
                                title: '储能收益计算',
                                description: '峰谷套利分析，优化储能系统配置',
                                color: 'emerald',
                                link: '/calculator/storage'
                            },
                            {
                                icon: FileText,
                                title: '专业报告生成',
                                description: '一键生成PDF投资分析报告，可用于立项审批',
                                color: 'purple',
                                link: '/my/stations'
                            },
                            {
                                icon: Sparkles,
                                title: 'AI智能问答',
                                description: '新能源领域专家，解答所有技术政策问题',
                                color: 'pink',
                                link: '/assistant'
                            },
                            {
                                icon: Leaf,
                                title: '碳减排计算',
                                description: '量化环境贡献，生成碳中和证书',
                                color: 'green',
                                link: '/achievements'
                            }
                        ].map((feature, i) => (
                            <Link
                                key={i}
                                href={feature.link}
                                className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-xl hover:border-green-200 transition-all"
                            >
                                <div className={cn(
                                    "w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors",
                                    feature.color === 'amber' && "bg-amber-100 group-hover:bg-amber-500",
                                    feature.color === 'cyan' && "bg-cyan-100 group-hover:bg-cyan-500",
                                    feature.color === 'emerald' && "bg-emerald-100 group-hover:bg-emerald-500",
                                    feature.color === 'purple' && "bg-purple-100 group-hover:bg-purple-500",
                                    feature.color === 'pink' && "bg-pink-100 group-hover:bg-pink-500",
                                    feature.color === 'green' && "bg-green-100 group-hover:bg-green-500"
                                )}>
                                    <feature.icon className={cn(
                                        "w-7 h-7 transition-colors",
                                        feature.color === 'amber' && "text-amber-600 group-hover:text-white",
                                        feature.color === 'cyan' && "text-cyan-600 group-hover:text-white",
                                        feature.color === 'emerald' && "text-emerald-600 group-hover:text-white",
                                        feature.color === 'purple' && "text-purple-600 group-hover:text-white",
                                        feature.color === 'pink' && "text-pink-600 group-hover:text-white",
                                        feature.color === 'green' && "text-green-600 group-hover:text-white"
                                    )} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
                                <p className="text-slate-500">{feature.description}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* Data Sources Section */}
            <section className="py-16 px-4 bg-slate-900 text-white">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl font-black mb-4">权威数据源</h2>
                    <p className="text-lg text-slate-400 mb-12">集成国际公开数据源，分析假设与来源全程可见</p>

                    <div className="grid md:grid-cols-4 gap-6">
                        {[
                            { name: 'NASA POWER', desc: '气象辐射数据' },
                            { name: 'NREL', desc: '光伏发电标准' },
                            { name: 'Open-Meteo', desc: '天气预报数据' },
                            { name: '高德地图', desc: '地理信息数据' },
                        ].map((source, i) => (
                            <div key={i} className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm">
                                <div className="text-xl font-bold mb-2">{source.name}</div>
                                <div className="text-sm text-slate-400">{source.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Preview */}
            <section className="py-16 px-4 bg-green-50">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl font-black text-slate-900 mb-4">价格方案</h2>
                    <p className="text-lg text-slate-500 mb-8">从个人投资到企业级应用，满足不同规模需求</p>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { name: '免费版', price: '¥0', features: ['每日2次测算', '最多1个项目', '数据保留7天'] },
                            { name: '专业版', price: '¥198/月', features: ['测算与资源查询不限次', '文献检索', 'PDF与Word导出'], popular: true },
                            { name: '企业版', price: '¥38,000/年', features: ['企业权限', 'API与SSO', '白标与定制评估'], popular: false },
                        ].map((plan, i) => (
                            <div key={i} className={cn(
                                "bg-white rounded-2xl p-6 shadow-sm border-2",
                                plan.popular ? "border-green-500 scale-105" : "border-slate-100"
                            )}>
                                {plan.popular && (
                                    <div className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full -mt-8 mb-4 inline-block">
                                        最受欢迎
                                    </div>
                                )}
                                <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                                <div className="text-3xl font-black text-slate-900 mb-4">{plan.price}</div>
                                <ul className="space-y-2 mb-6">
                                    {plan.features.map((f, j) => (
                                        <li key={j} className="flex items-center gap-2 text-sm text-slate-600">
                                            <Check className="w-4 h-4 text-green-500" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    href="/pricing"
                                    className={cn(
                                        "block w-full py-3 rounded-xl font-bold text-center transition-colors",
                                        plan.popular
                                            ? "bg-green-500 text-white hover:bg-green-600"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    )}
                                >
                                    查看完整方案
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 px-4 bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-3xl font-black mb-4">立即开始您的智能投资分析</h2>
                    <p className="text-lg text-green-100 mb-8">免费版可体验基础测算；完整额度与会员权益以价格方案页为准</p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <Link
                            href="/login"
                            className="flex items-center gap-2 px-8 py-4 bg-white text-green-600 font-bold rounded-2xl hover:bg-green-50 transition-colors shadow-lg"
                        >
                            <span>免费注册体验</span>
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                        {contactPhone && <a
                            href={`tel:${contactPhone}`}
                            className="flex items-center gap-2 px-8 py-4 bg-white/20 text-white font-bold rounded-2xl hover:bg-white/30 transition-colors"
                        >
                            <Phone className="w-5 h-5" />
                            咨询热线
                        </a>}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-900 text-slate-400 py-12 px-4">
                <div className="max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-4 gap-8 mb-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                                    <Zap className="w-4 h-4 text-white" />
                                </div>
                                <span className="font-bold text-white">新能源智库</span>
                            </div>
                            <p className="text-sm">AI驱动的新能源项目智能决策系统</p>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-4">产品</h4>
                            <ul className="space-y-2 text-sm">
                                <li><Link href="/calculator/solar" className="hover:text-green-400">光伏计算</Link></li>
                                <li><Link href="/calculator/wind" className="hover:text-green-400">风电分析</Link></li>
                                <li><Link href="/pricing" className="hover:text-green-400">价格方案</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-4">资源</h4>
                            <ul className="space-y-2 text-sm">
                                <li><Link href="/developer/docs" className="hover:text-green-400">API文档</Link></li>
                                <li><Link href="/papers" className="hover:text-green-400">文献检索</Link></li>
                                <li><Link href="/assistant" className="hover:text-green-400">AI助手</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-4">联系我们</h4>
                            <ul className="space-y-2 text-sm">
                                {contactEmail && <li className="flex items-center gap-2">
                                    <MessageCircle className="w-4 h-4" />
                                    {contactEmail}
                                </li>}
                                {contactPhone && <li className="flex items-center gap-2">
                                    <Phone className="w-4 h-4" />
                                    {contactPhone}
                                </li>}
                                {!contactEmail && !contactPhone && <li>请通过登录后的工单中心联系我们</li>}
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-slate-800 pt-8 text-center text-sm">
                        © {new Date().getFullYear()} 新能源智库. 保留所有权利。
                    </div>
                </div>
            </footer>
        </div>
    );
}
