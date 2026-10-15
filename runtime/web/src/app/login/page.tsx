import React from 'react';
import LoginForm from './login-form';
import { isAuthConfigured } from '@/lib/auth/availability';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  // 服务端读取查询参数并直接渲染中文登录表单（不再用 useSearchParams + 空白 Suspense 兜底）；
  // 服务端判定 next-auth 配置是否齐全；未配置时登录入口降级为中文提示
  const params = await searchParams;
  const raw = params.callbackUrl;
  const callbackUrl = (Array.isArray(raw) ? raw[0] : raw) || '/dashboard';
  return <LoginForm authConfigured={isAuthConfigured()} callbackUrl={callbackUrl} />;
}
