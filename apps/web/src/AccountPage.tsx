'use client';
import { useEffect, useState } from 'react';
import { ApiClient } from '@estate-atlas/api-client';
import AccountPanel from './AccountPanel';
import Brand from './Brand';
import type { User } from '@estate-atlas/shared';
const api = new ApiClient(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Brand />
        <a href="/">Zum Portfolio</a>
      </header>
      <main>
        {user ? (
          <AccountPanel api={api} onUser={setUser} onExit={() => window.location.assign('/')} />
        ) : (
          <p role={error ? 'alert' : 'status'}>
            {error || 'Konto wird geladen …'} <a href="/">Zur Anmeldung</a>
          </p>
        )}
      </main>
    </div>
  );
}
