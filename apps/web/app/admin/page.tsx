import type { Metadata } from 'next';
import AdminPanel from '../../src/AdminPanel';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default function Page() {
  return <AdminPanel />;
}
