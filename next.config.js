/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js'],
  },
  images: {
    unoptimized: true,
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
  async headers() {
    return [
      {
        source: '/',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      {
        source: '/admin/marketing/products',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
        ],
      },
      {
        source: '/dashboard/customer/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://auran.kr' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
