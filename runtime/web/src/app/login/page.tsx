'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Zap,
  ArrowRight,
  Check,
  Phone,
  MessageCircle,
  Star,
  Shield,
  Clock,
  Sparkles,
  Gift
} from 'lucide-react';
import { cn } from '@/lib/utils';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const fromQuickCalc = searchParams.get('from') === 'quick-calc';
  const supportEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

  const [isLogin, setIsLogin] = useState(true);
  const [loginMode, setLoginMode] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState('');

  // SMS countdown timer
  React.useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Send SMS code
  const handleSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号');
      return;
    }
    setSendingCode(true);
    setError('');
    try {
      const res = await fetch('/api/auth/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (data.success) {
        setCountdown(60);
      } else {
        setError(data.error || '发送失败');
      }
    } catch (e) {
      setError('网络错误');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (loginMode === 'phone') {
        // Phone + SMS login
        const result = await signIn('phone', {
          phone,
          code: smsCode,
          redirect: false,
        });
        if (result?.error) {
          setError(result.error);
        } else {
          router.push(callbackUrl);
        }
      } else if (isLogin) {
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          setError(result.error);
        } else {
          router.push(callbackUrl);
        }
      } else {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || '注册失败');
        } else {
          const result = await signIn('credentials', {
            email,
            password,
            redirect: false,
          });
          if (result?.ok) {
            router.push('/onboarding');
          }
        }
      }
    } catch (err) {
      setError('操作失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = (provider: 'google' | 'github') => {
    signIn(provider, { callbackUrl });
  };

  const handleWechatLogin = () => {
    // 微信登录提示
    alert('微信登录功能即将上线，请使用邮箱注册');
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-12 flex-col justify-between">
        <div>
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold">新能源智库</span>
          </Link>
        </div>

        <div>
          {fromQuickCalc && (
            <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-full">
              <Gift className="w-4 h-4 text-green-400" />
              <span className="text-sm font-bold text-green-400">首次登录，赠送10次专业测算！</span>
            </div>
          )}

          <h1 className="text-4xl font-black mb-6 leading-tight">
            {isLogin ? '欢迎回来' : '立即注册'}
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
              开启智能投资分析
            </span>
          </h1>

          <p className="text-xl text-slate-300 mb-8">
            {isLogin
              ? '登录您的账户，继续使用专业的新能源项目分析工具'
              : '免费注册即享10次专业测算，首次升级享7折优惠'}
          </p>

          {/* Trust Badges */}
          <div className="grid grid-cols-3 gap-4 mb-8">
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

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/10">
            <div>
              <div className="text-3xl font-black">全程留痕</div>
              <div className="text-sm text-slate-400">假设与来源可审计</div>
            </div>
            <div>
              <div className="text-3xl font-black">31</div>
              <div className="text-sm text-slate-400">覆盖省市</div>
            </div>
            <div>
              <div className="text-3xl font-black">人工复核</div>
              <div className="text-sm text-slate-400">关键结论确认后导出</div>
            </div>
          </div>
        </div>

        <div className="text-sm text-slate-400">
          © {new Date().getFullYear()} 新能源智库. 保留所有权利。
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-slate-900">新能源智库</span>
            </Link>
          </div>

          {/* 卡片 */}
          <div className="bg-white rounded-3xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-slate-900 mb-2">
                {isLogin ? '账号登录' : '创建账号'}
              </h2>
              <p className="text-slate-500">
                {isLogin ? '使用以下方式登录您的账户' : '开始您的免费试用'}
              </p>
            </div>

            {/* 切换 */}
            <div className="flex mb-6 bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => setIsLogin(true)}
                className={cn(
                  "flex-1 py-3 rounded-lg text-sm font-bold transition-all",
                  isLogin
                    ? "bg-white text-green-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                登录
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={cn(
                  "flex-1 py-3 rounded-lg text-sm font-bold transition-all",
                  !isLogin
                    ? "bg-white text-green-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                注册
              </button>
            </div>

            {/* 注册专属优惠提示 */}
            {!isLogin && (
              <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-green-500" />
                  <span className="font-bold text-green-700">新用户专享</span>
                </div>
                <ul className="text-sm text-green-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4" /> 10次免费专业测算
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4" /> 首次升级享7折优惠
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4" /> 永久免费基础功能
                  </li>
                </ul>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">用户名</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="设置您的用户名"
                    required={!isLogin}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">邮箱</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder={isLogin ? "请输入密码" : "设置密码（至少6位）"}
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    请稍候...
                  </>
                ) : (
                  <>
                    {isLogin ? '立即登录' : '免费注册'}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* 分隔 */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-500">其他登录方式</span>
              </div>
            </div>

            {/* 第三方登录 */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handleWechatLogin}
                className="flex flex-col items-center py-3 px-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mb-1">
                  <MessageCircle className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-xs text-slate-600">微信</span>
              </button>
              <button
                onClick={() => handleOAuthLogin('google')}
                className="flex flex-col items-center py-3 px-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-1">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                </div>
                <span className="text-xs text-slate-600">Google</span>
              </button>
              <button
                onClick={() => handleOAuthLogin('github')}
                className="flex flex-col items-center py-3 px-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center mb-1">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </div>
                <span className="text-xs text-slate-600">GitHub</span>
              </button>
            </div>

            {/* Terms */}
            {!isLogin && (
              <p className="mt-6 text-xs text-center text-slate-400">
                注册即表示同意
                <Link href="/terms" className="text-green-600 hover:underline"> 服务条款</Link>
                和
                <Link href="/privacy" className="text-green-600 hover:underline"> 隐私政策</Link>
              </p>
            )}
          </div>

          {/* Help */}
          {supportEmail && <div className="mt-6 text-center">
            <a href={`mailto:${supportEmail}`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-green-600">
              <Phone className="w-4 h-4" />
              联系支持：{supportEmail}
            </a>
          </div>}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><LoginContent /></Suspense>;
}
