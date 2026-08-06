/** @type {import('next').NextConfig} */
const nextConfig = {
  // This application is deployed as a static export. Runtime headers,
  // redirects and rewrites are intentionally configured at the static host
  // (see public/_headers) rather than here.
  output: 'export',
  reactStrictMode: true,
  // pnpm workspace packages ship TypeScript source; let Next compile them.
  transpilePackages: [
    '@energy-intelligence/ui-web',
    '@energy-intel/ui-components',
    '@energy-intel/skills-sdk',
    '@energy-intelligence/api-client',
    '@energy-intelligence/design-tokens',
    '@energy-intelligence/i18n',
  ],
  // Image optimization — allow external domains for avatars. The static
  // export cannot run the optimizer, so images are served unoptimized.
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  trailingSlash: true,
};

module.exports = nextConfig;
