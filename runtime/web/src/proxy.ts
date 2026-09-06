import { withAuth } from 'next-auth/middleware';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, NextRequest } from 'next/server';
import { isAuthConfigured } from '@/lib/auth/availability';

/**
 * 构造站内重定向 URL。next-auth 在 NEXTAUTH_URL 缺失时会用
 * http://localhost:$PORT 兜底（生产事故来源），这里一律按请求
 * Host 头推导源站，禁止 localhost 兜底进入用户可见的重定向。
 */
function siteUrl(req: NextRequest, path: string): URL {
  // 注意：Next standalone 会把 x-forwarded-host 合成为 localhost:$PORT，
  // 因此优先取真实 Host 头，仅在缺失时才用 x-forwarded-host。
  const host = req.headers.get('host') ?? req.headers.get('x-forwarded-host');
  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  return new URL(path, host ? `${proto}://${host}` : req.nextUrl.origin);
}

const intlMiddleware = createIntlMiddleware({
  // runtime/web 是国内生产包；国际版由独立 runtime/web-int 提供。
  locales: ['zh'],
  defaultLocale: 'zh',
  localePrefix: 'never', // 不使用 URL 前缀，通过 Cookie 处理
  localeDetection: false
});

// 仅旧版语言目录中的页面需要语言重写；根目录页面必须保持原路径。
function domesticRoute(req: NextRequest) {
  const localizedOnly = ['/education/pitfalls', '/tools/contract-check', '/calculator/compare'];
  return localizedOnly.includes(req.nextUrl.pathname) ? intlMiddleware(req) : NextResponse.next();
}

// 公开路径列表（不需要登录）
const publicPaths = [
  '/',
  '/login',
  '/pricing',
  '/checkout',
  '/demo-request',
  '/terms',
  '/privacy',
  '/calculator',
  '/quick-calc',
  '/api-docs',
  '/developer/docs',
  '/auth/error' // 中文认证错误页必须始终可访问（尤其登录未配置时）
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

// 已知路由首段（去掉 zh/en 前缀后）。未匹配的路径直接渲染中文 404，
// 不再进入认证流程（历史上未知路由会被 withAuth 重定向到全英文
// /api/auth/error?error=Configuration 并返回 500）。
// 新增页面路由时必须同步加入本表——宁可 404 也不绕过鉴权。
const knownSegments = new Set([
  'achievements', 'assistant', 'audit', 'auth', 'calculator', 'checkout',
  'community', 'dashboard', 'demo-request', 'developer', 'education',
  'enterprise', 'login', 'maintenance', 'map', 'membership', 'my',
  'onboarding', 'papers', 'pricing', 'privacy', 'project', 'projects',
  'quick-calc', 'referral', 'resource', 'settings', 'terms', 'tools',
]);

function firstSegment(pathname: string): string {
  const normalized = pathname.replace(/^\/(?:zh|en)(?=\/|$)/, '') || '/';
  return normalized.split('/')[1] ?? '';
}

function isKnownRoute(pathname: string): boolean {
  const normalized = pathname.replace(/^\/(?:zh|en)(?=\/|$)/, '') || '/';
  if (normalized === '/') return true;
  return knownSegments.has(firstSegment(pathname));
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

    return domesticRoute(req);
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
    pages: {
      signIn: '/login',
      error: '/auth/error', // 中文错误页；不再落到全英文 /api/auth/error
    },
  }
);

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path === '/en' || path.startsWith('/en/')) {
    return NextResponse.redirect(siteUrl(req, '/'));
  }

  // 排除 API, 静态文件
  if (path.startsWith('/api') ||
    path.includes('.') ||
    path.startsWith('/_next')) {
    return NextResponse.next();
  }

  // 未知路由：放行给路由层——单段垃圾路径会匹配 [locale] 动态段，
  // 由 [locale]/layout.tsx 的 locale 白名单守卫 notFound() 渲染中文 404；
  // 其余未匹配路径由 Next 渲染根 not-found.tsx。均不再进入认证流程
  // （历史上未知路由会被 withAuth 重定向到全英文 /api/auth/error 并 500）。
  // 注意：新增页面路由必须同步加入 knownSegments——宁可 404 也不绕过鉴权。
  if (!isKnownRoute(path)) {
    return NextResponse.next();
  }

  // 国内版公开转化页无需 locale 重写。next-intl 在 standalone 环境会把
  // `/pricing` 反复改写为 `/zh/pricing`，造成公开页面重定向循环。
  if (isPublicPath(path)) {
    return NextResponse.next();
  }
  if (isDemoDashboardPreview(path)) {
    return domesticRoute(req);
  }

  // fail-closed：next-auth 未配置（缺 NEXTAUTH_SECRET/NEXTAUTH_URL）时，
  // 不进入 withAuth（其内部会用 localhost:$PORT 兜底并重定向到错误页），
  // 受保护页面改为重定向到中文登录页（页内展示「登录服务未配置」提示）。
  if (!isAuthConfigured()) {
    return NextResponse.redirect(
      siteUrl(req, '/login?callbackUrl=' + encodeURIComponent(path))
    );
  }

  // 其他页面需要认证
  try {
    // @ts-ignore
    return await authMiddleware(req);
  } catch {
    // withAuth 执行期异常同样降级到中文登录页，不外泄英文错误页
    return NextResponse.redirect(
      siteUrl(req, '/login?callbackUrl=' + encodeURIComponent(path))
    );
  }
}

export const config = {
  matcher: [
    // 匹配常规页面
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons).*)',
  ],
};
