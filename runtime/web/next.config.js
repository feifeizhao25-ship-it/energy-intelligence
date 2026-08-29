const withNextIntl = require('next-intl/plugin')(
  './src/i18n/request.ts'
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
    return [
      {
        source: '/api/backend/:path*',
        destination: `${backend}/api/:path*`,
      },
    ];
  },
}

module.exports = withNextIntl(nextConfig)
