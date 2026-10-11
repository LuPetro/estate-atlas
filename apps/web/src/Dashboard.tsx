'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Building2,
  LayoutDashboard,
  Map,
  Archive,
  LogOut,
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Globe2,
  Landmark,
  Maximize2,
  ChevronRight,
  Grid2X2,
  List,
  Table2,
  X,
  Pencil,
  Trash2,
  FolderOpen,
  ShieldCheck,
  ArrowRight,
  Compass,
  ChartNoAxesCombined,
  Upload,
  FileText,
  Sparkles,
  Menu,
  RotateCcw,
} from 'lucide-react';
import { ApiClient, ApiError } from '@estate-atlas/api-client';
import {
  portfolioStats,
  filterProperties,
  formatMoney,
  propertyTypeLabels,
  propertyTypes,
  conditionLabels,
  rentalSummary,
  type Property,
  type PropertyDetail,
  type Currency,
  type User,
} from '@estate-atlas/shared';
import PropertyEditor from './PropertyEditor';
import AnalysisPanel from './AnalysisPanel';
import ValueHistory from './ValueHistory';
const PropertyMap = dynamic(() => import('./Map'), {
  ssr: false,
  loading: () => <div className="map-loading">Karte wird geladen …</div>,
});
const api = new ApiClient(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
type Section = 'dashboard' | 'properties' | 'map' | 'archive';
export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [section, setSection] = useState<Section>('dashboard');
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [type, setType] = useState('');
  const [view, setView] = useState<'grid' | 'list' | 'table'>('grid');
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [editor, setEditor] = useState<Property | 'new' | null>(null);
  const [detail, setDetail] = useState<PropertyDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const reload = useCallback(async () => {
    setProperties(await api.properties());
  }, []);
  useEffect(() => {
    api
      .me()
      .then(async (u) => {
        setUser(u);
        await reload();
      })
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) setError(e.message);
      })
      .finally(() => setReady(true));
  }, [reload]);
  const activeProperties = useMemo(() => properties.filter((p) => !p.archivedAt), [properties]);
  const stats = useMemo(() => portfolioStats(properties), [properties]);
  const currencyStats =
    stats.byCurrency.find((s) => s.currency === currency) ?? stats.byCurrency[0];
  const filtered = useMemo(
    () => filterProperties(properties, { query, country, type, archived: section === 'archive' }),
    [properties, query, country, type, section],
  );
  const select = useCallback(async (id: string) => {
    try {
      setError('');
      setDetail(await api.detail(id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  const act = async (fn: () => Promise<unknown>, refresh = true) => {
    setError('');
    setBusy(true);
    try {
      await fn();
      if (refresh) await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!editor && !detail) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const previousFocus = document.activeElement as HTMLElement | null;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditor(null);
        setDetail(null);
      }
      if (e.key === 'Tab') {
        const dialog = document.querySelector('.modal');
        const nodes = dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled):not([type=file]), select:not(:disabled), textarea:not(:disabled)',
        );
        if (nodes?.length) {
          const first = nodes[0],
            last = nodes[nodes.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', handler);
      previousFocus?.focus();
    };
  }, [editor, detail]);
  if (!ready)
    return (
      <div className="splash">
        <Compass size={32} />
        <p>EstateAtlas wird geladen …</p>
      </div>
    );
  if (!user)
    return (
      <Auth
        onSuccess={async (u) => {
          setUser(u);
          setError('');
          await reload();
        }}
        error={error}
      />
    );
  const nav = [
    { key: 'dashboard', label: 'Übersicht', icon: LayoutDashboard },
    { key: 'properties', label: 'Immobilien', icon: Building2 },
    { key: 'map', label: 'Weltkarte', icon: Map },
    { key: 'archive', label: 'Archiv', icon: Archive },
  ] as const;
  const goto = (key: Section) => {
    setSection(key);
    setQuery('');
    setCountry('');
    setType('');
    setMobileNav(false);
  };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`} inert={Boolean(editor || detail)}>
        <a className="brand" href="/" aria-label="EstateAtlas Startseite">
          <span className="brand-mark">
            <Compass size={24} />
          </span>
          Estate<span>Atlas</span>
        </a>
        <p className="sidebar-label">WORKSPACE</p>
        <nav>
          {nav.map((n) => (
            <button
              key={n.key}
              className={`nav-item ${section === n.key ? 'active' : ''}`}
              onClick={() => goto(n.key)}
            >
              <n.icon size={19} />
              {n.label}
              {n.key === 'properties' && <span className="nav-count">{stats.count}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="note-icon">
            <ShieldCheck size={20} />
          </div>
          <strong>Dein privater Raum.</strong>
          <p>Ein Portfolio. Auf Web, Android und iOS.</p>
          <span>
            <span className="status-dot" /> Mit deiner API verbunden
          </span>
        </div>
        <div className="sidebar-user">
          <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small>Privates Portfolio</small>
          </div>
          <button
            aria-label="Abmelden"
            className="icon-button"
            onClick={() =>
              act(async () => {
                await api.logout();
                setUser(null);
                setProperties([]);
                setDetail(null);
              }, false)
            }
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell" inert={Boolean(editor || detail)}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Navigation öffnen"
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Menu size={21} />
            </button>
            <span>Mein Workspace</span>
            <ChevronRight size={14} />
            <strong>{nav.find((n) => n.key === section)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="privacy">
              <ShieldCheck size={14} /> Privat & geschützt
            </span>
            <span className="avatar small">{user.name.slice(0, 2).toUpperCase()}</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">DEIN IMMOBILIENPORTFOLIO</p>
              <h1>
                {section === 'dashboard'
                  ? 'Alles im Blick.'
                  : section === 'map'
                    ? 'Ein Portfolio. Die ganze Welt.'
                    : section === 'archive'
                      ? 'Dein Immobilienarchiv.'
                      : 'Raum für deine Werte.'}
              </h1>
              <p>
                {section === 'dashboard'
                  ? 'Deine Immobilien, ihre Werte und neue Perspektiven — an einem Ort.'
                  : section === 'archive'
                    ? 'Archivierte Immobilien bleiben erhalten und zählen nicht zu den Gesamtwerten.'
                    : 'Verwalte deine Immobilien mit einer klaren Perspektive.'}
              </p>
            </div>
            <button className="button primary" onClick={() => setEditor('new')}>
              <Plus size={18} /> Immobilie hinzufügen
            </button>
          </div>
          {error && (
            <div className="error banner" role="alert">
              {error}
              <button
                className="icon-button"
                aria-label="Meldung schließen"
                onClick={() => setError('')}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {properties.some((p) => p.isTestData) && (
            <div className="test-banner">
              <span className="badge">TESTDATEN</span> Synthetische Immobilien und Beispielwerte
              sind gekennzeichnet. Keine recherchierten Bewertungen.
            </div>
          )}
          {section === 'dashboard' && (
            <>
              <div className="stat-grid">
                <article className="stat-card value-card">
                  <div className="stat-label">
                    Geschätzter Portfoliowert
                    <Landmark size={18} />
                  </div>
                  <strong>
                    {currencyStats
                      ? formatMoney(currencyStats.marketValue, currencyStats.currency)
                      : '—'}
                  </strong>
                  <div className="stat-bottom">
                    <span>Eigene Marktwertangaben</span>
                    {stats.byCurrency.length > 1 && (
                      <select
                        aria-label="Dashboard-Währung"
                        value={currencyStats?.currency}
                        onChange={(e) => setCurrency(e.target.value as Currency)}
                      >
                        {stats.byCurrency.map((s) => (
                          <option key={s.currency}>{s.currency}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </article>
                <article className="stat-card">
                  <div className="stat-label">
                    Immobilien
                    <Building2 size={18} />
                  </div>
                  <strong>{stats.count.toString().padStart(2, '0')}</strong>
                  <p>{properties.filter((p) => p.archivedAt).length} im Archiv</p>
                </article>
                <article className="stat-card">
                  <div className="stat-label">
                    Länder
                    <Globe2 size={18} />
                  </div>
                  <strong>{stats.countries.toString().padStart(2, '0')}</strong>
                  <p>Dein Portfolio, international</p>
                </article>
                <article className="stat-card">
                  <div className="stat-label">
                    Gesamtfläche
                    <Maximize2 size={18} />
                  </div>
                  <strong>
                    {stats.area.toLocaleString('de-AT')}
                    <small> m²</small>
                  </strong>
                  <p>Über alle aktiven Immobilien</p>
                </article>
              </div>
              <div className="overview-grid">
                <section className="panel map-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Dein Portfolio auf der Karte</h2>
                      <p>Neue Perspektiven beginnen mit Überblick.</p>
                    </div>
                    <button className="text-button" onClick={() => goto('map')}>
                      Karte öffnen <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <PropertyMap properties={activeProperties} onSelect={select} />
                  <div className="map-caption">
                    <span className="status-dot" />
                    {stats.count} Immobilien · {stats.countries} Länder<span>OpenStreetMap</span>
                  </div>
                </section>
                <section className="panel insights">
                  <div className="panel-heading">
                    <div>
                      <h2>Werte & Perspektiven</h2>
                      <p>{currencyStats?.currency ?? 'EUR'} · eigene Angaben</p>
                    </div>
                    <ChartNoAxesCombined size={20} />
                  </div>
                  <div className="gain-value">
                    {currencyStats ? formatMoney(currencyStats.gain, currencyStats.currency) : '—'}
                    <span className={currencyStats && currencyStats.gain < 0 ? 'negative' : ''}>
                      {currencyStats?.gainPercent != null ? (
                        <>
                          {currencyStats.gain >= 0 ? (
                            <ArrowUpRight size={14} />
                          ) : (
                            <ArrowDownRight size={14} />
                          )}{' '}
                          {currencyStats.gainPercent.toFixed(1)} %
                        </>
                      ) : (
                        'Noch keine Werte'
                      )}
                    </span>
                  </div>
                  <p className="muted">Differenz zu deinen Kaufpreisen</p>
                  <div className="distribution">
                    {propertyTypes.map((t) => {
                      const total = properties
                        .filter(
                          (p) =>
                            !p.archivedAt && p.type === t && p.currency === currencyStats?.currency,
                        )
                        .reduce((a, p) => a + p.marketValue, 0);
                      return (
                        <div key={t}>
                          <div>
                            <span>{propertyTypeLabels[t]}</span>
                            <strong>
                              {currencyStats ? formatMoney(total, currencyStats.currency) : '—'}
                            </strong>
                          </div>
                          <div className="bar">
                            <i
                              style={{
                                width: `${currencyStats?.marketValue ? (100 * total) / currencyStats.marketValue : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="research-note">
                    <Sparkles size={18} />
                    <div>
                      <strong>KI-Marktpreis recherchieren</strong>
                      <p>
                        Vergleichsangebote, nachvollziehbare Preisspannen und Quellen direkt bei
                        deiner Immobilie.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}
          <section className={`property-section ${section === 'map' ? 'map-section' : ''}`}>
            <div className="section-heading">
              <div>
                <h2>
                  {section === 'archive'
                    ? 'Archivierte Immobilien'
                    : section === 'map'
                      ? 'Immobilien weltweit'
                      : 'Deine Immobilien'}{' '}
                  <span className="counter">{filtered.length}</span>
                </h2>
                <p>
                  {section === 'dashboard'
                    ? 'Jede Immobilie hat ihren Platz.'
                    : 'Suchen, filtern und direkt verwalten.'}
                </p>
              </div>
              {section !== 'map' && (
                <div className="view-switch" aria-label="Ansicht wählen">
                  {(
                    [
                      { value: 'grid', icon: Grid2X2, label: 'Kachelansicht' },
                      { value: 'list', icon: List, label: 'Listenansicht' },
                      { value: 'table', icon: Table2, label: 'Tabellenansicht' },
                    ] as const
                  ).map((v) => (
                    <button
                      key={v.value}
                      aria-label={v.label}
                      aria-pressed={view === v.value}
                      className={view === v.value ? 'selected' : ''}
                      onClick={() => setView(v.value)}
                    >
                      <v.icon size={17} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="filters">
              <label className="search">
                <Search size={17} />
                <input
                  aria-label="Immobilien suchen"
                  placeholder="Immobilien oder Orte suchen …"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <select
                aria-label="Land filtern"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="">Alle Länder</option>
                {[...new Set(properties.map((p) => p.country))].sort().map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                aria-label="Immobilienart filtern"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="">Alle Immobilienarten</option>
                {propertyTypes.map((t) => (
                  <option key={t} value={t}>
                    {propertyTypeLabels[t]}
                  </option>
                ))}
              </select>
              <button className="text-button" disabled={busy} onClick={() => act(reload)}>
                <RotateCcw size={15} /> Aktualisieren
              </button>
            </div>
            {section === 'map' ? (
              <section className="panel full-map">
                <PropertyMap properties={filtered} onSelect={select} />
                <p className="map-caption">
                  Filter gelten auch für die Kartenmarker. Klicke einen Marker für Details.
                </p>
              </section>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <FolderOpen size={28} />
                </div>
                <h3>
                  {properties.length ? 'Hier ist noch Platz.' : 'Dein Portfolio beginnt hier.'}
                </h3>
                <p>
                  {properties.length
                    ? 'Keine Immobilien passen zu dieser Auswahl.'
                    : 'Füge deine erste Immobilie hinzu oder erkunde EstateAtlas mit klar gekennzeichneten Testdaten.'}
                </p>
                <div className="empty-actions">
                  <button className="button primary" onClick={() => setEditor('new')}>
                    <Plus size={16} /> Erste Immobilie hinzufügen
                  </button>
                  {!properties.length && (
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => act(() => api.seed())}
                    >
                      Testdaten laden
                    </button>
                  )}
                </div>
              </div>
            ) : view === 'table' ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Immobilie</th>
                      <th>Land</th>
                      <th>Art</th>
                      <th>Fläche</th>
                      <th>Kaufpreis</th>
                      <th>Marktwert¹</th>
                      <th>Vermietung</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <button className="table-title" onClick={() => select(p.id)}>
                            {p.title}
                          </button>
                          {p.isTestData && <span className="test-tag">TEST</span>}
                          <small>{p.address}</small>
                        </td>
                        <td>{p.country}</td>
                        <td>{propertyTypeLabels[p.type]}</td>
                        <td>{p.area} m²</td>
                        <td>{formatMoney(p.purchasePrice, p.currency)}</td>
                        <td>{formatMoney(p.marketValue, p.currency)}</td>
                        <td>
                          {rentalSummary(p.rental).label}
                          <small>{rentalSummary(p.rental).period}</small>
                        </td>
                        <td>
                          <button
                            aria-label={`${p.title} öffnen`}
                            className="icon-button"
                            onClick={() => select(p.id)}
                          >
                            <ArrowUpRight size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={`property-cards ${view === 'list' ? 'as-list' : ''}`}>
                {filtered.map((p) => (
                  <button className="property-card" key={p.id} onClick={() => select(p.id)}>
                    <div className={`property-art art-${p.type}`}>
                      <Building2 size={52} strokeWidth={1} />
                      <span className="location-badge">{p.country}</span>
                      {p.isTestData && <span className="sample-badge">TESTDATEN</span>}
                      <span className="art-lines" />
                    </div>
                    <div className="property-content">
                      <div className="property-type">
                        {propertyTypeLabels[p.type]}
                        <ArrowUpRight size={17} />
                      </div>
                      <h3>{p.title}</h3>
                      <p>{p.address}</p>
                      <div className="property-meta">
                        <span>{p.area} m²</span>
                        <span>{p.yearBuilt ?? 'Baujahr offen'}</span>
                        <span>{conditionLabels[p.condition]}</span>
                      </div>
                      <div className="rental-badge">
                        {rentalSummary(p.rental).label}
                        {rentalSummary(p.rental).period && (
                          <small>{rentalSummary(p.rental).period}</small>
                        )}
                      </div>
                      <div className="property-price">
                        <strong>{formatMoney(p.marketValue, p.currency)}</strong>
                        <span>Eigener Marktwert</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
          <footer className="page-footer">
            <span>EstateAtlas · Klarheit für deine Immobilien.</span>
            <span>¹ Marktwerte sind deine Angaben, keine KI-Bewertung.</span>
          </footer>
        </main>
      </div>
      {editor && (
        <PropertyEditor
          property={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
          onSave={async (input) => {
            if (editor === 'new') await api.create(input);
            else await api.update(editor.id, input);
            await reload();
            setEditor(null);
          }}
        />
      )}
      {detail && (
        <Detail
          property={detail}
          busy={busy}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditor(detail);
            setDetail(null);
          }}
          onRefresh={() => select(detail.id)}
          onArchive={() =>
            act(async () => {
              await api.archive(detail.id, !detail.archivedAt);
              setDetail(null);
            })
          }
          onDelete={() => {
            if (window.confirm('Diese Immobilie einschließlich aller Anhänge endgültig löschen?'))
              act(async () => {
                await api.delete(detail.id);
                setDetail(null);
              });
          }}
        />
      )}
    </div>
  );
}
function Auth({
  onSuccess,
  error: globalError,
}: {
  onSuccess: (u: User) => Promise<void>;
  error: string;
}) {
  const [register, setRegister] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const input = { email: String(form.get('email')), password: String(form.get('password')) };
      const result = register
        ? await api.register({ ...input, name: String(form.get('name')) })
        : await api.login(input);
      await onSuccess(result.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-mark">
            <Compass size={25} />
          </span>
          Estate<span>Atlas</span>
        </div>
        <div className="auth-story-content">
          <p className="eyebrow">RAUM FÜR DEINE WERTE</p>
          <h1>
            Deine Immobilien.
            <br />
            Eine klare
            <br />
            <em>Perspektive.</em>
          </h1>
          <p>
            Ein Zuhause für dein Immobilienportfolio.
            <br />
            Über Ländergrenzen hinweg. Immer bei dir.
          </p>
          <div className="auth-features">
            <span>
              <Globe2 size={17} /> Weltweiter Überblick
            </span>
            <span>
              <ShieldCheck size={17} /> Private Portfolios
            </span>
            <span>
              <Building2 size={17} /> Web · Android · iOS
            </span>
          </div>
        </div>
        <div className="auth-orbit orbit-one" />
        <div className="auth-orbit orbit-two" />
        <div className="auth-coordinate">
          48.2082° N &nbsp; 16.3738° E <span>DEINE WELT. DEIN ATLAS.</span>
        </div>
      </section>
      <section className="auth-form">
        <div className="auth-form-inner">
          <span className="auth-kicker">
            <span className="status-dot" /> Willkommen bei EstateAtlas
          </span>
          <h2>{register ? 'Ein neuer Anfang.' : 'Schön, dass du da bist.'}</h2>
          <p>
            {register
              ? 'Erstelle dein persönliches Konto und starte dein Portfolio.'
              : 'Melde dich an, um dein Portfolio zu verwalten.'}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                Dein Name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  placeholder="Vor- und Nachname"
                />
              </label>
            )}
            <label>
              E-Mail-Adresse
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                placeholder="du@beispiel.at"
              />
            </label>
            <label>
              Passwort
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete={register ? 'new-password' : 'current-password'}
                placeholder="Mindestens 12 Zeichen"
              />
            </label>
            {(error || globalError) && (
              <p role="alert" className="error">
                {error || globalError}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? 'Bitte warten …' : register ? 'Konto erstellen' : 'Anmelden'}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="auth-toggle">
            {register ? 'Schon ein Konto?' : 'Neu bei EstateAtlas?'}{' '}
            <button
              onClick={() => {
                setRegister(!register);
                setError('');
              }}
            >
              {register ? 'Anmelden' : 'Konto erstellen'}
            </button>
          </div>
          <div className="auth-private">
            <ShieldCheck size={18} />
            <p>
              Deine Immobilien gehören dir.
              <br />
              Andere Benutzer sehen dein Portfolio nicht.
            </p>
          </div>
        </div>
        <small>ESTATEATLAS · DEIN PRIVATER IMMOBILIEN-WORKSPACE</small>
      </section>
    </div>
  );
}
function Detail({
  property: p,
  onClose,
  onEdit,
  onRefresh,
  onArchive,
  onDelete,
  busy,
}: {
  property: PropertyDetail;
  onClose: () => void;
  onEdit: () => void;
  onRefresh: () => Promise<void>;
  onArchive: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const task = async (fn: () => Promise<unknown>) => {
    setError('');
    setUploading(true);
    try {
      await fn();
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <section
        className="modal detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">
              {propertyTypeLabels[p.type]} · {p.country} {p.isTestData ? '· TESTDATEN' : ''}
            </p>
            <h2 id="detail-title">{p.title}</h2>
            <p>{p.address}</p>
          </div>
          <button className="icon-button" aria-label="Schließen" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="detail-body">
          <div className="detail-values">
            <div>
              <span>Eigener Marktwert</span>
              <strong>{formatMoney(p.marketValue, p.currency)}</strong>
            </div>
            <div>
              <span>Kaufpreis</span>
              <strong>{formatMoney(p.purchasePrice, p.currency)}</strong>
            </div>
            <div>
              <span>Fläche</span>
              <strong>{p.area} m²</strong>
            </div>
          </div>
          <dl>
            <dt>Vermietung</dt>
            <dd>
              {rentalSummary(p.rental).label}
              {rentalSummary(p.rental).period && (
                <small className="rental-period">{rentalSummary(p.rental).period}</small>
              )}
            </dd>
            <dt>Zustand</dt>
            <dd>{conditionLabels[p.condition]}</dd>
            <dt>Baujahr</dt>
            <dd>{p.yearBuilt ?? 'Nicht angegeben'}</dd>
            <dt>GPS-Position</dt>
            <dd>
              {p.latitude}, {p.longitude}
            </dd>
            <dt>Ausstattung</dt>
            <dd>{p.amenities.join(', ') || 'Nicht angegeben'}</dd>
          </dl>
          {p.notes && <p className="detail-notes">{p.notes}</p>}
          <ValueHistory key={`${p.id}-${p.currency}`} values={p.valuations} currency={p.currency} />
          <div className="detail-subheading">
            <h3>Fotos & Dokumente</h3>
            <label className="button secondary upload-button">
              <Upload size={16} />
              {uploading ? 'Wird hochgeladen …' : 'Datei hinzufügen'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) task(() => api.upload(p.id, file));
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <p className="muted">JPEG, PNG, WebP oder PDF · bis 10 MB · privat gespeichert</p>
          <div className="assets">
            {p.assets.map((a) => (
              <div className="asset" key={a.id}>
                {a.mimeType.startsWith('image/') ? (
                  <img src={api.assetUrl(a.id)} alt={a.name} />
                ) : (
                  <FileText size={28} />
                )}
                <a href={api.assetUrl(a.id)} target="_blank" rel="noreferrer">
                  {a.name}
                </a>
                <small>{(a.size / 1024).toFixed(1)} KB</small>
                <button
                  className="icon-button"
                  aria-label={`${a.name} löschen`}
                  disabled={uploading}
                  onClick={() => {
                    if (window.confirm('Anhang endgültig löschen?'))
                      task(() => api.deleteAsset(a.id));
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <AnalysisPanel key={p.id} property={p} api={api} onApplied={onRefresh} />
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </div>
        <footer className="modal-footer detail-actions">
          <button className="button danger" disabled={busy} onClick={onDelete}>
            <Trash2 size={16} /> Löschen
          </button>
          <button className="button secondary" disabled={busy} onClick={onArchive}>
            <Archive size={16} />
            {p.archivedAt ? 'Wiederherstellen' : 'Archivieren'}
          </button>
          <button className="button primary" onClick={onEdit}>
            <Pencil size={16} /> Bearbeiten
          </button>
        </footer>
      </section>
    </div>
  );
}
