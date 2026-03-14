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
  webpack: (config, { nextRuntime }) => {
    if (nextRuntime === 'edge') {
      // @supabase/realtime-js depends on `ws` (Node.js WebSocket library)
      // which uses __dirname — a CommonJS global unavailable in the Edge runtime.
      // Middleware only needs Supabase auth, not realtime, so exclude ws entirely.
      config.resolve.alias = {
        ...config.resolve.alias,
        ws: false,
      }
    }
    return config
  },
}

export default nextConfig
