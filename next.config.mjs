/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude heavy AWS SDK from Edge/server component bundles
  serverExternalPackages: ['@aws-sdk/client-s3'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
}

export default nextConfig
