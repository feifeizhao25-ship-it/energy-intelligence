// 根级 404：未匹配路由（含 middleware 对未知路径的 /_not-found 重写）渲染本页。
// 根 not-found 由根布局包裹；保持静态中文，
// 不依赖 next-intl / next-auth，与认证错误页解耦。
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '页面不存在 - 新能源智库',
};

export default function NotFound() {
    return (
        <div style={{ margin: 0, fontFamily: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif', background: '#f8fafc', color: '#0f172a' }}>
                <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
                    <div style={{ width: 96, height: 96, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, marginBottom: 24 }}>
                        🔍
                    </div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px' }}>找不到这个页面</h1>
                    <p style={{ color: '#64748b', maxWidth: 360, margin: '0 0 32px', lineHeight: 1.7 }}>
                        您访问的页面可能已被移动或删除，或者您输入了错误的网址。
                    </p>
                    <a
                        href="/"
                        style={{ padding: '12px 28px', borderRadius: 12, background: '#059669', color: '#fff', fontWeight: 700, textDecoration: 'none' }}
                    >
                        返回首页
                    </a>
                    <p style={{ marginTop: 40, fontSize: 12, color: '#94a3b8' }}>新能源智库</p>
                </main>
        </div>
    );
}
