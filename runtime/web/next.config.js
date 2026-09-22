const withNextIntl = require('next-intl/plugin')(
  './src/i18n/request.ts'
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Playwright CI binds the dev server on localhost and opens it through
  // 127.0.0.1. Next 16 otherwise blocks its own chunks and renders an empty body.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  env: {
    CUSTOM_KEY: 'solarwind-pro',
  },
  transpilePackages: ['@react-pdf/renderer'],
  // pdf-parse 含 pdfjs worker，保持在服务端外部依赖，避免打包期动态依赖告警
  serverExternalPackages: ['pdf-parse'],
  output: 'standalone',
  async rewrites() {
    const backend = process.env.BACKEND_INTERNAL_URL || 'http://backend:8000';
    // 浏览器只需要后端的一个公开接口：权益注册表（会员页）。原来整个 /api/backend/*
    // 都转给 FastAPI——后端自带的注册、登录、支付宝下单与回调等一整套与 web 平行的账号
    // 和支付体系也就经本站公开出去了（写的是另一个库，web 的会员永远看不到）。
    return [
      { source: '/api/backend/entitlements', destination: `${backend}/api/entitlements` },
    ];
  },
}

module.exports = withNextIntl(nextConfig)
