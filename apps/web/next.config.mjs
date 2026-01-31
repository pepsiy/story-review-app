/** @type {import('next').NextConfig} */
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
};

export default nextConfig;
