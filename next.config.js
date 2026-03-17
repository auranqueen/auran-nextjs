/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'xxxxxxxxxxxxxxxx.supabase.co',  // Supabase Storage
      'k.kakaocdn.net',                // 카카오 프로필
      'phinf.pstatic.net',             // 네이버 프로필
      'lh3.googleusercontent.com',    // 구글 프로필
    ],
  },
  async headers() {
    return [
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
