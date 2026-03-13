/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@aws-sdk/client-s3'],
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
}

export default nextConfig
