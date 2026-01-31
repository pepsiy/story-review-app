import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile monorepo packages for Vercel deployment
  transpilePackages: ['@repo/db'],

  typescript: {
    ignoreBuildErrors: true,
  },
  // @ts-ignore
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      }
    ],
  },
};

export default nextConfig;
