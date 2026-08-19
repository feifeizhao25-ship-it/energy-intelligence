import type { Metadata, Viewport } from 'next'
import { Inter, Noto_Sans, Space_Grotesk } from 'next/font/google'
import './globals.css'
import AuthProvider from '@/components/providers/AuthProvider'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const notoSans = Noto_Sans({ subsets: ['latin'], variable: '--font-noto-sans' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })

export const metadata: Metadata = {
  title: '新能源智库 - AI 能源专家',
  description: '算清收益 · 做对决策 · 省心赚钱。面向中国新能源从业者的智能决策系统，集成 NASA 数据与 AI 深度分析。',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '新能源智库',
  },
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
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.variable} ${notoSans.variable} ${spaceGrotesk.variable} font-sans`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

