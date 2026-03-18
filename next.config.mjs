import nextPWA from 'next-pwa'

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=()',
          },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      // Cloudflare R2 public buckets (pub-*.r2.dev)
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      // Custom R2 domains via Cloudflare Workers / custom hostnames
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
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
      // Exclude Node.js-only packages that use __dirname or native bindings,
      // which are unavailable in the Edge runtime.
      config.resolve.alias = {
        ...config.resolve.alias,
        ws: false,
        bufferutil: false,
        'utf-8-validate': false,
      }
    }
    return config
  },
}

const withPWA = nextPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  fallbacks: {
    document: '/offline.html',
  },
})

export default withPWA(nextConfig)
