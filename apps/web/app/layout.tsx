import type { Metadata, Viewport } from 'next';
import PwaStatus from '../src/PwaStatus';
import SiteFooter from '../src/SiteFooter';
import './globals.css';
export const metadata: Metadata = {
  title: 'EstateAtlas · Dein Immobilienportfolio',
  description:
    'Deine Immobilien. Eine klare Perspektive. Private Portfolios auf Web, Android und iOS.',
  robots: { index: false, follow: false },
  applicationName: 'EstateAtlas',
  appleWebApp: { capable: true, title: 'EstateAtlas', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#172e35',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <PwaStatus />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
