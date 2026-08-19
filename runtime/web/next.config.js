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
  output: 'standalone',
}

module.exports = withNextIntl(nextConfig)
