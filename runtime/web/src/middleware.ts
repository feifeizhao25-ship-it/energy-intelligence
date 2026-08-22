import { withAuth } from 'next-auth/middleware';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, NextRequest } from 'next/server';

const intlMiddleware = createIntlMiddleware({
  // A list of all locales that are supported
  locales: ['en', 'zh'],

  // Used when no locale matches
  defaultLocale: process.env.NEXT_PUBLIC_APP_EDITION === 'international' ? 'en' : 'zh',
  localePrefix: 'never', // 不使用 URL 前缀，通过 Cookie 处理
  localeDetection: true // 启用语言检测
});

// 公开路径列表（不需要登录）
const publicPaths = [
  '/',
  '/login',
  '/pricing',
  '/calculator',
  '/quick-calc',
  '/api-docs'
];

// 检查路径是否是公开的
function isPublicPath(pathname: string): boolean {
  // next-intl may internally rewrite `/pricing` to `/zh/pricing` even when
  // localePrefix is `never`. Authorization must evaluate the user-visible
  // path, otherwise a public page redirects to sign-in forever.
  const normalizedPath = pathname.replace(/^\/(?:zh|en)(?=\/|$)/, '') || '/';
  // 完全匹配
  if (publicPaths.includes(normalizedPath)) return true;
  // 前缀匹配
  return publicPaths.some(path =>
    path !== '/' && normalizedPath.startsWith(path + '/')
  );
}

// 窄豁免：仅当显式开启 NEXT_PUBLIC_DEMO_PERSONA_PREVIEW=1 时，
// 放行 /dashboard 单页用于个性化人设 demo 预览（不含 /dashboard 子路径）
function isDemoDashboardPreview(pathname: string): boolean {
  return process.env.NEXT_PUBLIC_DEMO_PERSONA_PREVIEW === '1' && pathname === '/dashboard';
}

const authMiddleware = withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // 保护dashboard路由
    if ((path.startsWith('/dashboard') ||
      path.startsWith('/my') ||
      path.startsWith('/settings') ||
      path.startsWith('/enterprise')) &&
      !isDemoDashboardPreview(path)) {
      if (!token) {
        return NextResponse.redirect(new URL('/login?callbackUrl=' + path, req.url));
      }
    }

    return intlMiddleware(req);
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        // 所有公开路径都允许访问
        if (isPublicPath(path) || path.startsWith('/api/auth') || isDemoDashboardPreview(path)) {
          return true;
        }
        return !!token;
      },
    },
  }
);

export default function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // 排除 API, 静态文件
  if (path.startsWith('/api') ||
    path.includes('.') ||
    path.startsWith('/_next')) {
    return NextResponse.next();
  }

  // 国内版公开转化页无需 locale 重写。next-intl 在 standalone 环境会把
  // `/pricing` 反复改写为 `/zh/pricing`，造成公开页面重定向循环。
  if (isPublicPath(path)) {
    return NextResponse.next();
  }
  if (isDemoDashboardPreview(path)) {
    return intlMiddleware(req);
  }

  // 其他页面需要认证
  // @ts-ignore
  return authMiddleware(req);
}

export const config = {
  matcher: [
    // 匹配常规页面
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons).*)',
  ],
};
