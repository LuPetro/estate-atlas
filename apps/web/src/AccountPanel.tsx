'use client';
import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  UserRound,
  KeyRound,
  Monitor,
  Download,
  Trash2,
  Check,
  Mail,
} from 'lucide-react';
import { ApiClient } from '@estate-atlas/api-client';
import type { AccountInfo, AccountSession, AccountConfig, User } from '@estate-atlas/shared';
export function SecurityFields({ mfa = false }: { mfa?: boolean }) {
  return (
    <div className="account-fields">
      <label>
        Aktuelles Passwort
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={12}
          maxLength={128}
        />
      </label>
      {mfa && (
        <label>
          Zwei-Faktor- oder Wiederherstellungscode
          <input name="code" autoComplete="one-time-code" required maxLength={80} />
        </label>
      )}
    </div>
  );
}
export function security(form: FormData) {
  return {
    password: String(form.get('password') ?? ''),
    code: String(form.get('code') ?? '').trim(),
  };
}
export default function AccountPanel({
  api,
  onUser,
  onExit,
}: {
  api: ApiClient;
  onUser: (user: User) => void;
  onExit: () => void;
}) {
  const [account, setAccount] = useState<AccountInfo | null>(null),
    [sessions, setSessions] = useState<AccountSession[]>([]),
    [config, setConfig] = useState<AccountConfig | null>(null);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null),
    [codes, setCodes] = useState<string[]>([]);
  async function reload() {
    const [a, s, c] = await Promise.all([api.account(), api.sessions(), api.accountConfig()]);
    setAccount(a);
    setSessions(s);
    setConfig(c);
    onUser(a);
  }
  useEffect(() => {
    let active = true;
    Promise.all([api.account(), api.sessions(), api.accountConfig()])
      .then(([a, s, c]) => {
        if (active) {
          setAccount(a);
          setSessions(s);
          setConfig(c);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function form(fn: (data: FormData) => Promise<void>) {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      void action(() => fn(data));
    };
  }
  if (!account)
    return (
      <div className="account-page">
        <p role="alert">{error || 'Konto wird geladen …'}</p>
      </div>
    );
  const post = async (path: string, data: unknown, exit = false) => {
    const result = await api.accountPost(path, data);
    setNotice(result.message);
    if (exit) onExit();
    else await reload();
  };
  return (
    <div className="account-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DEIN KONTO</p>
          <h1>Persönlich. Sicher.</h1>
          <p>Profil, Zugänge und Kontrolle über deine Daten.</p>
        </div>
        <ShieldCheck size={32} />
      </div>
      {config?.verificationRequired && !account.emailVerifiedAt && (
        <p className="account-notice" role="status">
          Bestätige deine E-Mail-Adresse, um dein Portfolio zu öffnen. Prüfe dein Postfach oder
          fordere die Bestätigung erneut an.
        </p>
      )}
      {error && (
        <p className="error banner" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="account-notice" role="status">
          <Check size={18} />
          {notice}
        </p>
      )}
      <div className="account-grid">
        <section className="account-card">
          <h2>
            <UserRound size={20} />
            Profil
          </h2>
          <form
            onSubmit={form(async (d) => {
              const a = await api.profile(String(d.get('name')));
              setAccount(a);
              onUser(a);
              setNotice('Profil gespeichert.');
            })}
          >
            <label>
              Dein Name
              <input
                name="name"
                defaultValue={account.name}
                minLength={2}
                maxLength={80}
                required
                autoComplete="name"
              />
            </label>
            <p>{account.email}</p>
            <span className="badge">
              {account.emailVerifiedAt ? 'E-Mail bestätigt' : 'E-Mail noch nicht bestätigt'}
            </span>
            <button className="button primary" disabled={busy}>
              Profil speichern
            </button>
          </form>
        </section>
        <section className="account-card">
          <h2>
            <Mail size={20} />
            E-Mail-Adresse
          </h2>
          {!account.emailVerifiedAt && (
            <button
              className="button secondary"
              disabled={busy || !config?.mailEnabled}
              onClick={() => action(() => post('/account/resend-verification', {}))}
            >
              Bestätigung erneut senden
            </button>
          )}
          {!config?.mailEnabled && (
            <p className="account-muted">
              E-Mail-Funktionen sind in dieser Testversion noch nicht verfügbar.
            </p>
          )}
          {account.pendingEmail && <p>Bestätigung ausstehend: {account.pendingEmail}</p>}
          <form
            onSubmit={form((d) =>
              post('/account/email', { ...security(d), email: String(d.get('email')) }),
            )}
          >
            <label>
              Neue E-Mail-Adresse
              <input name="email" type="email" autoComplete="email" required maxLength={254} />
            </label>
            <SecurityFields mfa={account.mfaEnabled} />
            <button className="button secondary" disabled={busy || !config?.mailEnabled}>
              Neue Adresse bestätigen
            </button>
          </form>
          <a href="/account-action">Bestätigungscode aus einer E-Mail eingeben</a>
        </section>
        <section className="account-card">
          <h2>
            <KeyRound size={20} />
            Passwort
          </h2>
          <form
            onSubmit={form((d) =>
              post(
                '/account/password',
                { ...security(d), newPassword: String(d.get('newPassword')) },
                true,
              ),
            )}
          >
            <SecurityFields mfa={account.mfaEnabled} />
            <label>
              Neues Passwort
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
            </label>
            <p className="account-muted">Nach der Änderung werden alle Sitzungen beendet.</p>
            <button className="button secondary" disabled={busy}>
              Passwort ändern
            </button>
          </form>
        </section>
        <section className="account-card">
          <h2>
            <ShieldCheck size={20} />
            Zwei-Faktor-Anmeldung
          </h2>
          <p>
            {account.mfaEnabled
              ? 'Aktiv · Dein Konto ist zusätzlich geschützt.'
              : 'Verbinde eine Authenticator-App. Für Verwaltungskonten ist dies erforderlich.'}
          </p>
          {!setup && (
            <form
              onSubmit={form(async (d) => {
                setSetup(await api.accountPost('/account/mfa/setup', security(d)));
              })}
            >
              <SecurityFields mfa={account.mfaEnabled} />
              <button className="button primary" disabled={busy || !config?.mfaAvailable}>
                {account.mfaEnabled ? 'Authenticator wechseln' : 'Authenticator verbinden'}
              </button>
            </form>
          )}
          {setup && (
            <>
              <p>
                In deiner Authenticator-App „Schlüssel manuell eingeben“ wählen und diesen Schlüssel
                hinterlegen:
              </p>
              <code className="secret-code">{setup.secret}</code>
              <form
                onSubmit={form(async (d) => {
                  const result = await api.accountPost<{ recoveryCodes: string[] }>(
                    '/account/mfa/confirm',
                    { code: String(d.get('code')) },
                  );
                  setCodes(result.recoveryCodes);
                  setSetup(null);
                  await reload();
                })}
              >
                <label>
                  Sechsstelliger Code
                  <input
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    required
                  />
                </label>
                <button className="button primary" disabled={busy}>
                  Einrichtung bestätigen
                </button>
              </form>
            </>
          )}
          {codes.length > 0 && (
            <div className="recovery-box">
              <strong>Wiederherstellungscodes jetzt sicher speichern</strong>
              <p>Jeder Code ist einmal verwendbar und wird nur jetzt angezeigt.</p>
              <pre>{codes.join('\n')}</pre>
              <button
                className="button secondary"
                onClick={() => {
                  const blob = new Blob([codes.join('\n')], { type: 'text/plain' });
                  download(blob, 'estateatlas-recovery-codes.txt');
                }}
              >
                Codes herunterladen
              </button>
              <button className="button secondary" onClick={() => setCodes([])}>
                Sicher gespeichert
              </button>
            </div>
          )}
          {account.mfaEnabled && account.role === 'user' && (
            <form onSubmit={form((d) => post('/account/mfa/disable', security(d), true))}>
              <SecurityFields mfa />
              <button className="button secondary" disabled={busy}>
                Zwei-Faktor-Anmeldung deaktivieren
              </button>
            </form>
          )}
        </section>
        <section className="account-card account-wide">
          <h2>
            <Monitor size={20} />
            Aktive Sitzungen
          </h2>
          <div className="account-session-list">
            {sessions.map((s) => (
              <div className="account-session" key={s.id}>
                <div>
                  <strong>{s.current ? 'Diese Sitzung' : 'Weitere Sitzung'}</strong>
                  <p>{s.userAgent || 'Gerät unbekannt'}</p>
                  <small>Zuletzt aktiv: {new Date(s.lastSeenAt).toLocaleString('de-AT')}</small>
                </div>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      await api.revokeSession(s.id);
                      if (s.current) onExit();
                      else await reload();
                    })
                  }
                >
                  Beenden
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={form((d) => post('/account/logout-all', security(d), true))}>
            <SecurityFields mfa={account.mfaEnabled} />
            <button className="button secondary" disabled={busy}>
              Alle Sitzungen beenden
            </button>
          </form>
        </section>
        <section className="account-card">
          <h2>
            <Download size={20} />
            Deine Daten mitnehmen
          </h2>
          <p>
            JSON-Archiv mit deinen eigenen Immobilien, Wertverläufen, Recherchen, Checklisten und
            Dokumenten. Dateien sind als Base64 enthalten.
          </p>
          <form
            onSubmit={form(async (d) => {
              const result = await api.accountPost<unknown>('/account/export', security(d));
              download(
                new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }),
                'estateatlas-export.json',
              );
              setNotice('Export heruntergeladen.');
            })}
          >
            <SecurityFields mfa={account.mfaEnabled} />
            <button className="button secondary" disabled={busy}>
              Daten exportieren
            </button>
          </form>
        </section>
        <section className="account-card account-danger">
          <h2>
            <Trash2 size={20} />
            Konto löschen
          </h2>
          <p>
            Dein Konto, eigene Immobilien und ihre Dokumente werden endgültig gelöscht. Fremde, mit
            dir geteilte Immobilien bleiben erhalten. Eigene geteilte Immobilien musst du vorher
            übertragen oder deren Freigaben entfernen.
          </p>
          <form
            onSubmit={form(async (d) => {
              if (window.confirm('Konto und eigene Inhalte unwiderruflich löschen?'))
                await post(
                  '/account/delete',
                  { ...security(d), confirmation: String(d.get('confirmation')) },
                  true,
                );
            })}
          >
            <SecurityFields mfa={account.mfaEnabled} />
            <label>
              Zur Bestätigung: KONTO LÖSCHEN
              <input name="confirmation" pattern="KONTO LÖSCHEN" required autoComplete="off" />
            </label>
            <button className="button danger" disabled={busy}>
              Konto endgültig löschen
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
