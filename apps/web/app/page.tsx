import type { Metadata } from 'next';
import Dashboard from '../src/Dashboard';

export const metadata: Metadata = {
  title: 'Dein Immobilienportfolio',
  description:
    'Immobilien, Werte und Unterlagen an einem Ort. Melde dich bei EstateAtlas an oder erstelle dein privates Portfolio.',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Deine Immobilien. Eine klare Perspektive. | EstateAtlas',
    description: 'Dein privates Immobilienportfolio mit EstateAtlas.',
    url: 'https://estateatlas.app/',
    siteName: 'EstateAtlas',
    locale: 'de_AT',
    type: 'website',
  },
};

export default function HomePage() {
  return <Dashboard />;
}
