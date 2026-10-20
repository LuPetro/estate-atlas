import type { Metadata } from 'next';
import AccountPage from '../../src/AccountPage';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default function Page() {
  return <AccountPage />;
}
