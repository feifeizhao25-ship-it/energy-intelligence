import type { Metadata, Viewport } from 'next'
import './globals.css'
import AuthProvider from '@/components/providers/AuthProvider'
import { BuildStamp } from '@/components/layout/BuildStamp'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { isAuthConfigured } from '@/lib/auth/availability'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '新能源智库 - 新能源项目测算与政策查询',
    description: '算清收益 · 看清假设。面向新能源从业者的光伏、风电、储能初步测算与政策查询工具，基于公开气象数据，结果仅供参考。',
    manifest: '/manifest.json',
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: '新能源智库' },
  };
}

export const viewport: Viewport = {
  themeColor: '#0E2A2B',
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
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <AuthProvider configured={isAuthConfigured()}>
              <BuildStamp />
              {children}
            </AuthProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
