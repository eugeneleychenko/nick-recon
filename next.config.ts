import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle canvas for server-side PDF processing
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }

    // Handle PDF.js worker files
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    });

    return config;
  },
  serverExternalPackages: ['canvas'],
};

export default nextConfig;
