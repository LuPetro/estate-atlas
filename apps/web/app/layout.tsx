import type { Metadata, Viewport } from 'next';
import PwaStatus from '../src/PwaStatus';
import SiteFooter from '../src/SiteFooter';
import LanguageControl from '../src/LanguageControl';
import './globals.css';
import './platform.css';
export const metadata: Metadata = {
  metadataBase: new URL('https://estateatlas.app'),
  title: { default: 'EstateAtlas · Dein Immobilienportfolio', template: '%s | EstateAtlas' },
  description:
    'Ordne Immobilien, eigene Wertnotizen, Mietzeiträume und Unterlagen in deinem privaten Portfolio.',
  applicationName: 'EstateAtlas',
  appleWebApp: { capable: true, title: 'EstateAtlas', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f5f3ed',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <PwaStatus />
        <LanguageControl />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
