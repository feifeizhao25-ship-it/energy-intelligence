import React, { Suspense } from 'react';
import LoginForm from './login-form';
import { isAuthConfigured } from '@/lib/auth/availability';

export default function LoginPage() {
  // 服务端判定 next-auth 配置是否齐全；未配置时登录入口降级为中文提示
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <LoginForm authConfigured={isAuthConfigured()} />
    </Suspense>
  );
}
