import type { Metadata, Viewport } from 'next'
import '../globals.css'
import AuthProvider from '@/components/providers/AuthProvider'
import { isAuthConfigured } from '@/lib/auth/availability'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { AccessibilityProvider } from '@/contexts/AccessibilityContext'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isEnglish = locale === 'en';
  return {
    title: isEnglish ? 'Energy Intelligence | Traceable Renewable Energy Decisions' : '新能源智库 - AI 能源专家',
    description: isEnglish
      ? 'Reviewable solar, wind, and storage assessments with explicit assumptions, traceable sources, sensitivity ranges, and human approval.'
      : '算清收益 · 做对决策 · 省心赚钱。面向中国新能源从业者的智能决策系统，集成 NASA 数据与 AI 深度分析。',
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: isEnglish ? 'Energy Intelligence' : '新能源智库',
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#22c55e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  // locale 白名单守卫：垃圾首段（如 /this-page-does-not-exist）会匹配到
  // [locale] 动态段，这里 fail-closed 渲染中文 404，而不是误渲染首页。
  if (!['zh', 'en'].includes(params.locale)) {
    notFound();
  }
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
      </head>
      <body className="font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider configured={isAuthConfigured()}>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <AccessibilityProvider>
                {children}
              </AccessibilityProvider>
            </ThemeProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
