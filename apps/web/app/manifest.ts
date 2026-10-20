import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/portfolio',
    name: 'EstateAtlas · Dein Immobilienportfolio',
    short_name: 'EstateAtlas',
    description: 'Deine Immobilien, Werte und Dokumente in einem privaten Portfolio.',
    lang: 'de',
    start_url: '/portfolio',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f3ed',
    theme_color: '#f5f3ed',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
