import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/products/', '/journal/', '/ranking/'],
      disallow: ['/dashboard/', '/admin/', '/super-console/'],
    },
    sitemap: 'https://auran.kr/sitemap.xml',
  }
}
