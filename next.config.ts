import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pg'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.valorant-api.com',
        pathname: '/**',
      },
    ],
  },

  turbopack: {},

  // Forzar polling para Hot Reload en Docker/Windows (Webpack fallback)
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
