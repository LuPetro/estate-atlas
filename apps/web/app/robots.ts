import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/portfolio', '/account', '/account-action', '/admin', '/api/'],
    },
    sitemap: 'https://estateatlas.app/sitemap.xml',
  };
}
