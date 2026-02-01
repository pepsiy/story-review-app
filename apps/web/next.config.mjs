/** @type {import('next').NextConfig} */
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
    transpilePackages: ['@repo/db'],
    typescript: {
        ignoreBuildErrors: true,
    },
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
    webpack: (config) => {
        config.resolve.alias['@repo/db'] = path.join(__dirname, '../../packages/db/src/index.ts');
        return config;
    },
};

export default nextConfig;
