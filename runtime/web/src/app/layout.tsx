import type { Metadata, Viewport } from 'next'
import './globals.css'
import AuthProvider from '@/components/providers/AuthProvider'
import { isAuthConfigured } from '@/lib/auth/availability'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isEnglish = locale === 'en';
  return {
    title: isEnglish ? 'Energy Intelligence | Traceable Renewable Energy Decisions' : '新能源智库 - AI 能源专家',
    description: isEnglish
      ? 'Reviewable solar, wind, and storage assessments with explicit assumptions, traceable sources, sensitivity ranges, and human approval.'
      : '算清收益 · 做对决策 · 省心赚钱。面向中国新能源从业者的智能决策系统，集成 NASA 数据与 AI 深度分析。',
    manifest: '/manifest.json',
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: isEnglish ? 'Energy Intelligence' : '新能源智库' },
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <head>
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider configured={isAuthConfigured()}>
            {children}
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
