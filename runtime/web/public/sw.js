// Service Worker for 新能源智库 PWA
const CACHE_NAME = 'xinnengyuan-v1';
const STATIC_CACHE = 'xinnengyuan-static-v1';
const DYNAMIC_CACHE = 'xinnengyuan-dynamic-v1';

// 需要预缓存的静态资源
const STATIC_ASSETS = [
    '/',
    '/dashboard',
    '/calculator',
    '/assistant',
    '/manifest.json',
    '/offline.html'
];

// 需要缓存的API路由（支持离线查看）
const CACHEABLE_API_ROUTES = [
    '/api/dashboard',
    '/api/projects',
    '/api/user/points'
];

// 安装事件 - 预缓存静态资源
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log('[SW] Pre-caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                    .map((key) => {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    })
            );
        })
    );
    self.clients.claim();
});

// 请求拦截 - 缓存策略
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 跳过非GET请求
    if (request.method !== 'GET') return;

    // 跳过Chrome扩展等非http请求
    if (!url.protocol.startsWith('http')) return;

    // API请求 - Network First策略
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // 静态资源 - Cache First策略
    if (
        url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2|woff)$/) ||
        url.pathname.startsWith('/_next/')
    ) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // 页面请求 - Stale While Revalidate策略
    event.respondWith(staleWhileRevalidate(request));
});

// Network First - 优先网络，失败时使用缓存
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        // 返回离线页面或错误JSON
        if (request.headers.get('Accept')?.includes('application/json')) {
            return new Response(
                JSON.stringify({ error: 'OFFLINE', message: '当前离线，请检查网络连接' }),
                { headers: { 'Content-Type': 'application/json' } }
            );
        }
        return caches.match('/offline.html');
    }
}

// Cache First - 优先缓存，没有则请求网络
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        return new Response('Resource not available offline', { status: 503 });
    }
}

// Stale While Revalidate - 返回缓存同时更新
async function staleWhileRevalidate(request) {
    const cached = await caches.match(request);

    const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
            caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, response.clone());
            });
        }
        return response;
    }).catch(() => {
        return caches.match('/offline.html');
    });

    return cached || fetchPromise;
}

// ---------------------------------------------------------
// Background Sync (后台同步)
// ---------------------------------------------------------

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-calculations') {
        event.waitUntil(syncCalculations());
    }
});

async function syncCalculations() {
    console.log('[Service Worker] Syncing calculations...');

    // 发送推送通知告知同步开始
    await self.registration.showNotification('同步启动', {
        body: '正在后台处理您离线时提交的计算请求...',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'sync-status'
    });

    // 模拟同步过程
    return new Promise((resolve) => {
        setTimeout(async () => {
            console.log('[Service Worker] Sync complete!');

            // 发送完成通知
            await self.registration.showNotification('同步完成', {
                body: '离线计算任务已处理完毕，您可以查看结果。',
                icon: '/icons/icon-192x192.png',
                vibrate: [200, 100, 200],
                tag: 'sync-complete',
                data: { url: '/dashboard' }
            });

            resolve();
        }, 3000);
    });
}

// ---------------------------------------------------------
// Push Notifications (推送通知)
// ---------------------------------------------------------

self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push Received.');
    let data = {
        title: '新能源智库',
        body: '为您推送最新的行业动态和计算报告。'
    };

    try {
        if (event.data) {
            data = event.data.json();
        }
    } catch (e) {
        console.warn('Push data is not JSON:', event.data?.text());
    }

    const options = {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        data: { url: data.url || '/' },
        actions: [
            { action: 'view', title: '立即查看' },
            { action: 'close', title: '忽略' }
        ]
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'close') return;

    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === url && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
