import type { MetadataRoute } from 'next';

const site = 'https://estateatlas.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site, changeFrequency: 'monthly', priority: 1 },
    { url: `${site}/install`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${site}/support`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${site}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${site}/legal`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${site}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${site}/delete-account`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
