/** @type {import('next').NextConfig} */
import path from "path";

const nextConfig = {
    transpilePackages: ['@repo/db'],
    typescript: {
        ignoreBuildErrors: true,
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
    webpack: (config) => {
        config.resolve.alias['@repo/db'] = path.join(process.cwd(), '../../packages/db/src/index.ts');
        return config;
    },
};

export default nextConfig;
