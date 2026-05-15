/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js'],
  },
  images: {
    unoptimized: false,
    domains: [
      'xxxxxxxxxxxxxxxx.supabase.co',
      'k.kakaocdn.net',
      'phinf.pstatic.net',
      'lh3.googleusercontent.com',
      'won.duchess.kr',
      'duchess.kr',
      'bhpcqgedhfawlehobphq.supabase.co',
    ],
    remotePatterns: [
      { protocol: 'https', hostname: '**', pathname: '/**' },
      { protocol: 'http', hostname: '**', pathname: '/**' },
      { protocol: 'https', hostname: 'won.duchess.kr', pathname: '/**' },
      { protocol: 'http', hostname: 'won.duchess.kr', pathname: '/**' },
      { protocol: 'https', hostname: 'duchess.kr', pathname: '/**' },
      { protocol: 'https', hostname: '**.duchess.kr', pathname: '/**' },
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/**' },
      { protocol: 'https', hostname: 'bhpcqgedhfawlehobphq.supabase.co', pathname: '/**' },
    ],
  },
  async redirects() {
    return []
  },
  async rewrites() {
    return [
      { source: '/community/write', destination: '/dashboard/customer/community/write' },
      { source: '/community/new', destination: '/dashboard/customer/community/new' },
      { source: '/community/:path*', destination: '/dashboard/customer/community/:path*' },
    ]
  },
  async headers() {
    return [
      {
        source: '/',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=30, stale-while-revalidate=60' },
        ],
      },
      {
        source: '/admin/marketing/products',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=30' },
        ],
      },
      {
        source: '/dashboard/customer/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=10' },
        ],
      },
      {
        source: '/products/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' },
        ],
      },
      {
        source: '/brands/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=30' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://auran.kr' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
        ],
      },
      {
        source: '/checkout/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
      {
        source: '/auth/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
