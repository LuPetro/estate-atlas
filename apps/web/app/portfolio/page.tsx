import type { Metadata } from 'next';
import Dashboard from '../../src/Dashboard';

export const metadata: Metadata = {
  title: 'Dein Portfolio | EstateAtlas',
  robots: { index: false, follow: false },
};

export default function PortfolioPage() {
  return <Dashboard />;
}
