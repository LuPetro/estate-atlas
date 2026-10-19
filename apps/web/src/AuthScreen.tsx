'use client';

import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Compass,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
} from 'lucide-react';
import { ApiClient } from '@estate-atlas/api-client';
import type { User } from '@estate-atlas/shared';
import AccountActions from './AccountActions';
import styles from './AuthScreen.module.css';

const api = new ApiClient(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');

function Architecture() {
  return (
    <div className={styles.architecture} aria-hidden="true">
      <svg viewBox="0 50 640 410" fill="none" focusable="false">
        <path className={styles.ground} d="M30 282 318 117 610 282 322 449Z" fill="#e8e3d8" />
        <g stroke="#d4ccbd" strokeWidth=".8" className={styles.siteLines}>
          <path d="m6 259 319-182 309 180M9 297 326 116l309 181M48 320 365 139M92 345 409 164M140 370 456 191M3 222l313 179M55 192l315 180M107 162l313 180M159 132l313 180M211 102l313 180" />
        </g>
        <path d="m128 283 169-96 174 101-168 96Z" fill="#b8ad97" opacity=".2" />
        <g className={styles.buildingBack}>
          <path d="m313 131 98-56 107 61-98 57Z" fill="#f8f5ee" />
          <path d="m313 131 107 62v122l-107-62Z" fill="#e7dfcf" />
          <path d="m420 193 98-57v122l-98 57Z" fill="#c5baa6" />
          <path
            d="m313 160 107 62 98-57m-205 26 107 62 98-57m-205 26 107 62 98-57"
            stroke="#b1a58f"
            strokeWidth="1.2"
          />
          <path
            d="m337 158 0 83m27-66v82m28-65v82m52-79v82m26-98v83m25-97v83"
            stroke="#b1a58f"
            strokeWidth="1.2"
          />
          <path d="m331 132 80-45 88 50-79 45Z" stroke="#d3c8b5" strokeWidth="1.2" />
        </g>
        <g className={styles.buildingFront}>
          <path d="m141 165 112-64 115 66-112 65Z" fill="#de8e6e" />
          <path d="m141 165 115 67v113l-115-67Z" fill="#c16d50" />
          <path d="m256 232 112-65v113l-112 65Z" fill="#9d4e38" />
          <path d="m157 166 96-55 98 56-95 56Z" stroke="#edb296" strokeWidth="1.3" />
          <path
            d="m141 193 115 67 112-65m-227 26 115 67 112-65m-227 27 115 67 112-65"
            stroke="#f1b697"
            strokeWidth="1.5"
          />
          <path
            d="m165 197 0 76m31-58v77m31-58v76m55-69v77m29-95v78m29-95v77"
            stroke="#8e4937"
            strokeWidth="2"
          />
          <path d="m141 276 115 67 112-65" stroke="#81452f" strokeWidth="4" />
          <path d="m188 265 25 15v40l-25-15Z" fill="#f2cfaa" />
        </g>
        <g className={styles.drawingNotes} stroke="#b9af9e" strokeWidth="1">
          <path d="M101 138v132m-5-135 10 6m-10 126 10 6M390 328l116-67m-119 64 6 8m110-76 6 8" />
          <path d="M72 113h34m-17-17v34M536 303h24m-12-12v24" />
          <circle cx="106" cy="290" r="5" fill="#9b9d70" stroke="none" />
          <circle cx="120" cy="299" r="8" fill="#747e5d" stroke="none" />
          <circle cx="505" cy="221" r="9" fill="#9b9d70" stroke="none" />
          <path d="M505 229v14m-385 64v11" stroke="#747e5d" strokeWidth="2" />
        </g>
      </svg>
      <div className={styles.artCaption}>
        <span>ESTATEATLAS — 01</span>
        <span>Ein Ort für deinen Überblick.</span>
      </div>
    </div>
  );
}

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
  const [registrationMode, setRegistrationMode] = useState('open');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .accountConfig()
      .then((config) => setRegistrationMode(config.registration))
      .catch(() => {});
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
            invitation: String(form.get('invitation') ?? ''),
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
        <a href="/" className={styles.brand} aria-label="EstateAtlas Startseite">
          <span className={styles.brandMark}>
            <Compass size={23} strokeWidth={1.5} />
          </span>
          <span>
            EstateAtlas<span className={styles.brandPeriod}>.</span>
          </span>
        </a>
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
                {register && registrationMode === 'invite' && (
                  <div className={styles.field}>
                    <label htmlFor="auth-invitation">Einladungscode</label>
                    <input
                      id="auth-invitation"
                      name="invitation"
                      required
                      maxLength={128}
                      autoComplete="off"
                    />
                  </div>
                )}
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
