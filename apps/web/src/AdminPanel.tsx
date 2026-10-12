'use client';
import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Users, Mail, Activity, ArrowLeft, Search, Plus } from 'lucide-react';
import { ApiClient } from '@estate-atlas/api-client';
import type {
  User,
  AdminOverview,
  AdminUser,
  AuditEvent,
  BetaInvitation,
} from '@estate-atlas/shared';
import { SecurityFields, security } from './AccountPanel';
const api = new ApiClient(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
const date = (value: string | null) => (value ? new Date(value).toLocaleString('de-AT') : '—');
export default function AdminPanel() {
  const [user, setUser] = useState<User | null>(null),
    [overview, setOverview] = useState<AdminOverview | null>(null),
    [tab, setTab] = useState<'users' | 'invitations' | 'audit'>('users');
  const [query, setQuery] = useState(''),
    [status, setStatus] = useState(''),
    [verified, setVerified] = useState(''),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0);
  const [users, setUsers] = useState<AdminUser[]>([]),
    [invitations, setInvitations] = useState<BetaInvitation[]>([]),
    [events, setEvents] = useState<AuditEvent[]>([]),
    [selected, setSelected] = useState<AdminUser | null>(null);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [inviteCode, setInviteCode] = useState(''),
    [auditPage, setAuditPage] = useState(1);
  const [action, setAction] = useState('revoke-sessions');
  const reload = useCallback(async () => {
    const [o, list, i] = await Promise.all([
      api.adminOverview(),
      api.adminUsers(query, status, verified, page),
      api.adminInvitations(),
    ]);
    setOverview(o);
    setUsers(list.users);
    setTotal(list.total);
    setInvitations(i);
  }, [query, status, verified, page]);
  useEffect(() => {
    let active = true;
    api
      .me()
      .then((u) => {
        if (active) setUser(u);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      reload().catch((e) => {
        if (active) setError(e.message);
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [reload]);
  useEffect(() => {
    let active = true;
    if (tab === 'audit')
      api
        .adminAudit(auditPage)
        .then((e) => {
          if (active) setEvents(e);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [tab, auditPage]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      await reload();
      if (tab === 'audit') setEvents(await api.adminAudit(auditPage));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const isAdmin = user?.role === 'admin';
  if (!overview)
    return (
      <div className="account-action-shell">
        <section className="account-card">
          <ShieldCheck size={30} />
          <h1>Verwaltung</h1>
          <p role="alert">{error || 'Zugangsberechtigung wird geprüft …'}</p>
          <p>Verwaltungskonten benötigen eine eingerichtete Zwei-Faktor-Anmeldung.</p>
          <a href="/account">Mein Konto öffnen</a>
          <a href="/">Zurück zum Portfolio</a>
        </section>
      </div>
    );
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <a href="/" className="brand">
          EstateAtlas <span>Verwaltung</span>
        </a>
        <a href="/">
          <ArrowLeft size={16} />
          Zum Portfolio
        </a>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <p className="eyebrow">PLATTFORMVERWALTUNG</p>
            <h1>Menschen. Zugang. Überblick.</h1>
            <p>Konten sicher verwalten und Änderungen nachvollziehen.</p>
          </div>
          <span className="badge">{isAdmin ? 'Administrator' : 'Support'} · 2FA</span>
        </div>
        {error && (
          <p role="alert" className="error banner">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="account-notice">
            {notice}
          </p>
        )}
        <div className="admin-metrics">
          {[
            [Users, 'Nutzer', overview.users],
            [ShieldCheck, 'Gesperrt', overview.suspended],
            [Mail, 'Unbestätigt', overview.unverified],
            [Activity, 'Offene Einladungen', overview.invitations],
          ].map(([Icon, label, value]) => {
            const I = Icon as typeof Users;
            return (
              <div className="account-card" key={String(label)}>
                <I size={21} />
                <span>{String(label)}</span>
                <strong>{String(value)}</strong>
              </div>
            );
          })}
        </div>
        <nav className="admin-tabs" aria-label="Verwaltungsbereiche">
          {(['users', 'invitations', ...(isAdmin ? ['audit'] : [])] as const).map((t) => (
            <button
              className={`button ${tab === t ? 'primary' : 'secondary'}`}
              key={t}
              onClick={() => setTab(t as typeof tab)}
            >
              {t === 'users' ? 'Nutzer' : t === 'invitations' ? 'Einladungen' : 'Auditprotokoll'}
            </button>
          ))}
        </nav>
        {tab === 'users' && (
          <>
            <section className="account-card">
              <div className="admin-filters">
                <label>
                  Suche
                  <input
                    aria-label="Nutzer suchen"
                    placeholder="Name oder E-Mail"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <label>
                  Status
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Alle</option>
                    <option value="active">Aktiv</option>
                    <option value="suspended">Gesperrt</option>
                  </select>
                </label>
                <label>
                  E-Mail
                  <select
                    value={verified}
                    onChange={(e) => {
                      setVerified(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Alle</option>
                    <option value="yes">Bestätigt</option>
                    <option value="no">Unbestätigt</option>
                  </select>
                </label>
              </div>
              <div className="admin-user-list">
                {users.map((u) => (
                  <button
                    key={u.id}
                    className={`admin-user ${selected?.id === u.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelected(u);
                      setAction('revoke-sessions');
                    }}
                  >
                    <span className="avatar">{u.name.slice(0, 2).toUpperCase()}</span>
                    <span>
                      <strong>{u.name}</strong>
                      <small>{u.email}</small>
                    </span>
                    <span className="badge">
                      {u.status === 'active' ? 'Aktiv' : 'Gesperrt'} · {u.role}
                    </span>
                    <span>{u.properties} Immobilien</span>
                  </button>
                ))}
                {!users.length && <p>Keine passenden Nutzer.</p>}
              </div>
              <div className="account-actions">
                <button
                  className="button secondary"
                  disabled={page <= 1 || busy}
                  onClick={() => setPage(page - 1)}
                >
                  Zurück
                </button>
                <span>
                  Seite {page} · {total} Konten
                </span>
                <button
                  className="button secondary"
                  disabled={page * 25 >= total || busy}
                  onClick={() => setPage(page + 1)}
                >
                  Weiter
                </button>
              </div>
            </section>
            {selected && (
              <section className="account-card">
                <h2>{selected.name}</h2>
                <p>{selected.email}</p>
                <dl className="admin-details">
                  <div>
                    <dt>Registriert</dt>
                    <dd>{date(selected.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Letzte Anmeldung</dt>
                    <dd>{date(selected.lastLoginAt)}</dd>
                  </div>
                  <div>
                    <dt>E-Mail bestätigt</dt>
                    <dd>{date(selected.emailVerifiedAt)}</dd>
                  </div>
                  <div>
                    <dt>Zwei-Faktor-Anmeldung</dt>
                    <dd>{selected.mfaEnabled ? 'Aktiv' : 'Nicht eingerichtet'}</dd>
                  </div>
                  <div>
                    <dt>Bestand / Freigaben / Sitzungen</dt>
                    <dd>
                      {selected.properties} / {selected.shared} / {selected.sessions}
                    </dd>
                  </div>
                </dl>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget);
                    if (
                      ['delete', 'suspend', 'role'].includes(action) &&
                      !window.confirm(
                        `${action === 'delete' ? 'Konto endgültig löschen' : action === 'suspend' ? 'Konto sperren' : 'Rolle ändern'}: ${selected.email}?`,
                      )
                    )
                      return;
                    void run(async () => {
                      const result = await api.adminAction(selected.id, {
                        ...security(d),
                        action,
                        reason: String(d.get('reason')),
                        role: String(d.get('role') ?? 'user') as 'user' | 'support' | 'admin',
                        confirmation: String(d.get('confirmation') ?? ''),
                      });
                      setNotice(result.message);
                      setSelected(null);
                    });
                  }}
                >
                  <label>
                    Aktion
                    <select value={action} onChange={(e) => setAction(e.target.value)}>
                      <option value="revoke-sessions">Alle Sitzungen widerrufen</option>
                      <option value="resend-verification">Bestätigung erneut senden</option>
                      <option value="reset-password">Reset-Link an Nutzer senden</option>
                      {isAdmin && (
                        <>
                          <option value="suspend">Konto sperren</option>
                          <option value="restore">Konto entsperren</option>
                          <option value="role">Plattformrolle ändern</option>
                          <option value="delete">Leeres Konto endgültig löschen</option>
                        </>
                      )}
                    </select>
                  </label>
                  {action === 'role' && (
                    <label>
                      Neue Plattformrolle
                      <select name="role" defaultValue={selected.role}>
                        <option value="user">Nutzer</option>
                        <option value="support">Support</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </label>
                  )}
                  {action === 'delete' && (
                    <label>
                      Zur Bestätigung: KONTO LÖSCHEN
                      <input
                        name="confirmation"
                        required
                        pattern="KONTO LÖSCHEN"
                        autoComplete="off"
                      />
                    </label>
                  )}
                  <label>
                    Begründung
                    <textarea name="reason" required minLength={5} maxLength={500} />
                  </label>
                  <SecurityFields mfa />
                  <button
                    className="button primary"
                    disabled={
                      busy ||
                      (['resend-verification', 'reset-password'].includes(action) &&
                        !overview.mailEnabled)
                    }
                  >
                    Aktion bestätigen
                  </button>
                </form>
                <p className="account-muted">
                  Private Immobilien und Dokumente sind hier nicht einsehbar. Konten mit eigenen
                  Immobilien können nur durch den Besitzer vollständig gelöscht werden.
                </p>
              </section>
            )}
          </>
        )}
        {tab === 'invitations' && (
          <div className="account-grid">
            <section className="account-card">
              <h2>Beta-Einladungen</h2>
              <p>
                Registrierung: {overview.registration === 'invite' ? 'Nur mit Einladung' : 'Offen'}.
                Einladungen sind einmal verwendbar.
              </p>
              {isAdmin && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget);
                    void run(async () => {
                      const result = await api.accountPost<{ code: string }>('/admin/invitations', {
                        ...security(d),
                        ...(String(d.get('email')).trim()
                          ? { email: String(d.get('email')).trim() }
                          : {}),
                        days: Number(d.get('days')),
                      });
                      setInviteCode(result.code);
                    });
                  }}
                >
                  <label>
                    E-Mail-Bindung (optional)
                    <input name="email" type="email" maxLength={254} />
                  </label>
                  <label>
                    Gültigkeit in Tagen
                    <input name="days" type="number" min={1} max={30} defaultValue={7} required />
                  </label>
                  <SecurityFields mfa />
                  <button className="button primary" disabled={busy}>
                    <Plus size={16} />
                    Einladung erstellen
                  </button>
                </form>
              )}
              {inviteCode && (
                <div className="recovery-box">
                  <strong>Einladungscode · nur jetzt sichtbar</strong>
                  <code className="secret-code">{inviteCode}</code>
                  <button className="button secondary" onClick={() => setInviteCode('')}>
                    Weitergegeben
                  </button>
                </div>
              )}
            </section>
            <section className="account-card">
              <h2>Letzte Einladungen</h2>
              {invitations.map((i) => (
                <div className="account-session" key={i.id}>
                  <div>
                    <strong>{i.email ?? 'Ohne E-Mail-Bindung'}</strong>
                    <p>
                      {i.acceptedAt
                        ? 'Verwendet'
                        : i.revokedAt
                          ? 'Widerrufen'
                          : new Date(i.expiresAt) < new Date()
                            ? 'Abgelaufen'
                            : 'Offen'}{' '}
                      · bis {date(i.expiresAt)}
                    </p>
                  </div>
                  {isAdmin && !i.acceptedAt && !i.revokedAt && (
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await api.revokeBetaInvitation(i.id);
                          setNotice('Einladung widerrufen.');
                        })
                      }
                    >
                      Widerrufen
                    </button>
                  )}
                </div>
              ))}
            </section>
            {isAdmin && (
              <section className="account-card">
                <h2>Registrierung steuern</h2>
                <p>
                  Öffnen ist erst mit verpflichtender E-Mail-Bestätigung und eingerichtetem
                  Mailversand möglich. Deployment-Vorgaben haben Vorrang.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget);
                    void run(async () => {
                      const result = await api.request<{ message: string }>('/admin/registration', {
                        method: 'PATCH',
                        body: JSON.stringify({
                          ...security(d),
                          mode: String(d.get('mode')),
                          reason: String(d.get('reason')),
                        }),
                      });
                      setNotice(result.message);
                    });
                  }}
                >
                  <label>
                    Modus
                    <select name="mode" defaultValue={overview.registration}>
                      <option value="invite">Nur mit Einladung</option>
                      <option value="open">Öffentliche Registrierung</option>
                    </select>
                  </label>
                  <label>
                    Begründung
                    <input name="reason" required minLength={5} maxLength={500} />
                  </label>
                  <SecurityFields mfa />
                  <button className="button secondary" disabled={busy}>
                    Registrierungsmodus ändern
                  </button>
                </form>
              </section>
            )}
          </div>
        )}
        {tab === 'audit' && (
          <section className="account-card">
            <h2>Änderungen nachvollziehen</h2>
            <p>
              Kontometadaten und Verwaltungsaktionen. Keine Passwörter, Codes oder
              Immobilieninhalte.
            </p>
            {events.map((e) => (
              <div className="audit-event" key={e.id}>
                <strong>{e.action}</strong>
                <time>{date(e.createdAt)}</time>
                <p>{e.reason ?? 'Kontosicherheitsereignis'}</p>
                <small>
                  Akteur: {e.actorId ?? 'entfernt / Betreiber'} · Ziel:{' '}
                  {e.targetId ?? 'entfernt / Plattform'}
                </small>
                {Object.keys(e.metadata).length > 0 && <pre>{JSON.stringify(e.metadata)}</pre>}
              </div>
            ))}
            <div className="account-actions">
              <button
                className="button secondary"
                disabled={auditPage <= 1}
                onClick={() => setAuditPage(auditPage - 1)}
              >
                Zurück
              </button>
              <span>Seite {auditPage}</span>
              <button
                className="button secondary"
                disabled={events.length < 50}
                onClick={() => setAuditPage(auditPage + 1)}
              >
                Weiter
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
