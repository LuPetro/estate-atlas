import type { Metadata } from 'next';
import AccountActions from '../../src/AccountActions';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default function Page() {
  return <AccountActions />;
}
