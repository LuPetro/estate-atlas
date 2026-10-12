'use client';
import { useEffect, useState } from 'react';
import { ApiClient } from '@estate-atlas/api-client';
const api = new ApiClient(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
export default function AccountActions({ onBack }: { onBack?: () => void }) {
  const [mode, setMode] = useState('forgot'),
    [token, setToken] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const readLink = () => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      if (params.get('token')) {
        setToken(params.get('token')!);
        setMode(params.get('purpose') === 'reset' ? 'reset' : 'verify');
        setError('');
        setNotice('');
        window.history.replaceState(null, '', window.location.pathname);
      }
    };
    readLink();
    window.addEventListener('hashchange', readLink);
    return () => window.removeEventListener('hashchange', readLink);
  }, []);
  return (
    <div className="account-action-shell">
      <a className="brand" href="/">
        EstateAtlas
      </a>
      <section className="account-card">
        <p className="eyebrow">DEIN ZUGANG</p>
        <h1>
          {mode === 'forgot'
            ? 'Passwort vergessen?'
            : mode === 'reset'
              ? 'Neues Passwort festlegen'
              : 'E-Mail bestätigen'}
        </h1>
        <p>
          {mode === 'forgot'
            ? 'Wir senden dir einen Link, falls ein aktives Konto existiert.'
            : 'Gib den Code aus deiner E-Mail ein. Links werden erst durch deine Bestätigung verwendet.'}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            setBusy(true);
            setError('');
            setNotice('');
            try {
              const result =
                mode === 'forgot'
                  ? await api.forgotPassword(String(d.get('email')))
                  : mode === 'reset'
                    ? await api.resetPassword(token, String(d.get('password')))
                    : await api.verifyEmail(token);
              setNotice(result.message);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === 'forgot' ? (
            <label>
              E-Mail-Adresse
              <input name="email" type="email" required autoComplete="email" />
            </label>
          ) : (
            <label>
              Linkcode
              <input
                name="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                maxLength={128}
                autoComplete="off"
              />
            </label>
          )}
          {mode === 'reset' && (
            <label>
              Neues Passwort
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          <button className="button primary" disabled={busy}>
            {busy ? 'Bitte warten …' : 'Bestätigen'}
          </button>
        </form>
        <div className="account-actions">
          <button
            className="button secondary"
            onClick={() => {
              setMode('reset');
              setError('');
              setNotice('');
            }}
          >
            Reset-Code eingeben
          </button>
          <button
            className="button secondary"
            onClick={() => {
              setMode('verify');
              setError('');
              setNotice('');
            }}
          >
            E-Mail bestätigen
          </button>
        </div>
        {onBack ? (
          <button className="button secondary" onClick={onBack}>
            Zurück zur Anmeldung
          </button>
        ) : (
          <a href="/">Zurück zu EstateAtlas</a>
        )}
      </section>
    </div>
  );
}
