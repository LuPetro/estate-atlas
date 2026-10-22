'use client';

import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
} from 'lucide-react';
import { ApiClient } from '@estate-atlas/api-client';
import type { User } from '@estate-atlas/shared';
import AccountActions from './AccountActions';
import Brand from './Brand';
import Architecture from './AuthArchitecture';
import styles from './AuthScreen.module.css';

const api = new ApiClient(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');

export default function AuthScreen({
  onSuccess,
  error: globalError,
}: {
  onSuccess: (user: User) => Promise<void>;
  error: string;
}) {
  const [register, setRegister] = useState(false);
  const [recover, setRecover] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('register') === '1') setRegister(true);
  }, []);

  function changeMode(next: boolean) {
    setRegister(next);
    setShowPassword(false);
    setError('');
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? false : event.key === 'End' ? true : !register;
    changeMode(next);
    document.getElementById(next ? 'auth-register-tab' : 'auth-login-tab')?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const input = { email: String(form.get('email')), password: String(form.get('password')) };
      const result = register
        ? await api.register({
            ...input,
            name: String(form.get('name')),
          })
        : await api.login({ ...input, code: String(form.get('code') ?? '') });
      await onSuccess(result.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (recover) return <AccountActions onBack={() => setRecover(false)} />;

  return (
    <div className={styles.shell} data-auth-screen>
      <header className={styles.header}>
        <Brand className={styles.brand} />
        <a href="/support" className={styles.helpLink}>
          Hilfe <ArrowUpRight size={14} />
        </a>
      </header>

      <div className={styles.layout}>
        <section className={styles.story} aria-labelledby="auth-story-heading">
          <div className={styles.storyCopy}>
            <p className={styles.eyebrow}>
              <span /> RAUM FÜR DEINE WERTE
            </p>
            <h1 id="auth-story-heading">
              <span>Deine Immobilien.</span>
              <span>Eine klare</span>
              <em>Perspektive.</em>
            </h1>
            <p className={styles.intro}>Werte, Unterlagen und Zusammenarbeit an einem Ort.</p>
          </div>
          <Architecture />
          <div className={styles.storyFooter}>
            <span>
              <LockKeyhole size={14} /> Persönlich. Sicher.
            </span>
            <span>DEINE WELT. DEIN ATLAS.</span>
          </div>
        </section>

        <section className={styles.formPanel} aria-label="Anmeldung und Registrierung">
          <div className={styles.card}>
            <div className={styles.modeTabs} role="tablist" aria-label="Zugang wählen">
              <span className={styles.tabIndicator} data-register={register} aria-hidden="true" />
              <button
                id="auth-login-tab"
                type="button"
                role="tab"
                aria-selected={!register}
                aria-controls="auth-content"
                tabIndex={register ? -1 : 0}
                onClick={() => changeMode(false)}
                onKeyDown={onTabKey}
                disabled={busy}
              >
                Anmelden
              </button>
              <button
                id="auth-register-tab"
                type="button"
                role="tab"
                aria-selected={register}
                aria-controls="auth-content"
                tabIndex={register ? 0 : -1}
                onClick={() => changeMode(true)}
                onKeyDown={onTabKey}
                disabled={busy}
              >
                Registrieren
              </button>
            </div>

            <div
              id="auth-content"
              role="tabpanel"
              aria-labelledby={register ? 'auth-register-tab' : 'auth-login-tab'}
            >
              <div className={styles.formHeading} key={register ? 'register' : 'login'}>
                <p className={styles.formEyebrow}>DEIN ZUGANG</p>
                <h2>{register ? 'Ein neuer Anfang.' : 'Schön, dass du da bist.'}</h2>
                <p>
                  {register
                    ? 'Erstelle dein persönliches Konto und starte dein Portfolio.'
                    : 'Melde dich an, um dein Portfolio zu verwalten.'}
                </p>
              </div>

              <form onSubmit={submit} className={styles.form} aria-busy={busy}>
                {register && (
                  <div className={styles.field}>
                    <label htmlFor="auth-name">Dein Name</label>
                    <input
                      id="auth-name"
                      name="name"
                      required
                      minLength={2}
                      maxLength={80}
                      autoComplete="name"
                      placeholder="Vor- und Nachname"
                    />
                  </div>
                )}
                <div className={styles.field}>
                  <label htmlFor="auth-email">E-Mail-Adresse</label>
                  <input
                    id="auth-email"
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    placeholder="du@beispiel.at"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="auth-password">Passwort</label>
                  <div className={styles.passwordInput}>
                    <input
                      id="auth-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={12}
                      maxLength={128}
                      autoComplete={register ? 'new-password' : 'current-password'}
                      placeholder="Mindestens 12 Zeichen"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                      aria-controls="auth-password"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                {!register && (
                  <div className={`${styles.field} ${styles.codeField}`}>
                    <label htmlFor="auth-code">
                      <KeyRound size={13} /> Zwei-Faktor-Code (falls eingerichtet)
                    </label>
                    <input
                      id="auth-code"
                      name="code"
                      autoComplete="one-time-code"
                      maxLength={80}
                      placeholder="Code oder Wiederherstellungscode"
                      aria-describedby="auth-code-help"
                    />
                    <p id="auth-code-help">
                      Nur nötig, wenn du die Zwei-Faktor-Anmeldung aktiviert hast.
                    </p>
                  </div>
                )}
                {(error || globalError) && (
                  <p role="alert" className={styles.error}>
                    {error || globalError}
                  </p>
                )}
                <button className={styles.submit} disabled={busy} type="submit">
                  <span>{busy ? 'Bitte warten …' : register ? 'Konto erstellen' : 'Anmelden'}</span>
                  {busy ? (
                    <Loader2 size={18} className={styles.spinner} />
                  ) : (
                    <ArrowRight size={18} />
                  )}
                </button>
              </form>

              <div className={styles.secondaryActions}>
                <button
                  type="button"
                  className={styles.recover}
                  onClick={() => setRecover(true)}
                  disabled={busy}
                >
                  Passwort vergessen / E-Mail bestätigen <ArrowUpRight size={13} />
                </button>
                <p className={styles.switchMode}>
                  <span>{register ? 'Schon ein Konto?' : 'Neu bei EstateAtlas?'}</span>
                  <button type="button" onClick={() => changeMode(!register)} disabled={busy}>
                    {register ? 'Anmelden' : 'Konto erstellen'}
                  </button>
                </p>
              </div>
            </div>
          </div>
          <p className={styles.privateNote}>
            <LockKeyhole size={13} /> Deine Immobilien gehören dir.
          </p>
        </section>
      </div>
    </div>
  );
}
