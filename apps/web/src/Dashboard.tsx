'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  PieChart,
  Users,
  ClipboardCheck,
  Calculator,
  Bell,
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
  dashboardWidgets,
  dashboardWidgetLabels,
  dashboardPreferencesSchema,
  type Property,
  type PropertyDetail,
  type Currency,
  type User,
} from '@estate-atlas/shared';
import PropertyEditor from './PropertyEditor';
import Brand from './Brand';
import PropertyArtwork from './PropertyArtwork';
import AccountPanel from './AccountPanel';
import Auth from './AuthScreen';
import AnalysisPanel from './AnalysisPanel';
import ValueHistory from './ValueHistory';
import PortfolioValues from './PortfolioValues';
import PortfolioDistribution from './PortfolioDistribution';
import Documents, { DocumentList, UploadDocument } from './Documents';
import {
  WorkspacePanels,
  SharingPanel,
  AcceptInvitation,
  type WorkspaceTab,
} from './WorkspacePanels';
import PortfolioReminders from './PortfolioReminders';
import PropertyCsvImport from './PropertyCsvImport';
import PortfolioReportDialog from './PortfolioReportDialog';
const PropertyMap = dynamic(() => import('./Map'), {
  ssr: false,
  loading: () => <div className="map-loading">Karte wird geladen …</div>,
});
const api = new ApiClient(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
type Section =
  | 'account'
  | 'dashboard'
  | 'properties'
  | 'map'
  | 'archive'
  | 'values'
  | 'distribution'
  | 'documents'
  | 'reminders'
  | 'shared';

function nameInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0]?.[0]?.toLocaleUpperCase('de-AT') ?? '?';
  return `${parts[0][0]}${parts.at(-1)?.[0]}`.toLocaleUpperCase('de-AT');
}

export default function Dashboard() {
  const accountEpoch = useRef(0);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [reminderCount, setReminderCount] = useState(0);
  const [section, setSection] = useState<Section>('dashboard');
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [type, setType] = useState('');
  const [rental, setRental] = useState('');
  const [filterCurrency, setFilterCurrency] = useState('');
  const [storageError, setStorageError] = useState('');
  const defaults = { metrics: true, map: true, insights: true, properties: true };
  const [preferences, setPreferences] = useState<{
    account: string;
    values: typeof defaults;
  } | null>(null);
  const widgets = preferences && preferences.account === user?.id ? preferences.values : defaults;
  useEffect(() => {
    if (!user) {
      setStorageError('');
      setPreferences(null);
      return;
    }
    try {
      const saved = dashboardPreferencesSchema.safeParse(
        JSON.parse(localStorage.getItem(`estateatlas-dashboard-${user.id}`) ?? 'null'),
      );
      setPreferences({ account: user.id, values: saved.success ? saved.data : defaults });
    } catch {
      setPreferences({ account: user.id, values: defaults });
    }
  }, [user?.id]);
  useEffect(() => {
    if (!user) {
      setReminderCount(0);
      return;
    }
    let live = true;
    api
      .reminders()
      .then((reminders) => {
        if (live) setReminderCount(reminders.filter((reminder) => !reminder.completedAt).length);
      })
      .catch(() => {
        if (live) setReminderCount(0);
      });
    return () => {
      live = false;
    };
  }, [user?.id]);
  const [view, setView] = useState<'grid' | 'list' | 'table'>('grid');
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [editor, setEditor] = useState<Property | 'new' | null>(null);
  const [detail, setDetail] = useState<PropertyDetail | null>(null);
  const [detailDirty, setDetailDirty] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const modalOpen = Boolean(editor || detail || csvImportOpen || reportOpen);
  useEffect(() => {
    if (!mobileNav) return;
    document.querySelector<HTMLButtonElement>('.nav-item.active')?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileNav(false);
      }
    };
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('keydown', close);
      document.querySelector<HTMLButtonElement>('.mobile-menu')?.focus();
    };
  }, [mobileNav]);
  const clearPrivateState = () => {
    accountEpoch.current++;
    setProperties([]);
    setDetail(null);
    setEditor(null);
    setDetailDirty(false);
    setSection('dashboard');
    setQuery('');
    setCountry('');
    setType('');
    setRental('');
    setFilterCurrency('');
    setCurrency('EUR');
    setView('grid');
    setMobileNav(false);
    setStorageError('');
    setPreferences(null);
    setBusy(false);
    setReminderCount(0);
    setCsvImportOpen(false);
    setReportOpen(false);
    setError('');
  };
  const reload = useCallback(async () => {
    const epoch = accountEpoch.current;
    const result = await api.properties();
    if (epoch === accountEpoch.current) setProperties(result);
  }, []);
  useEffect(() => {
    api
      .me()
      .then(async (u) => {
        setUser(u);
        await reload();
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          setUser(null);
          setProperties([]);
        } else {
          setError(e.message);
          if (e instanceof ApiError && e.status === 403) setSection('account');
        }
      })
      .finally(() => setReady(true));
  }, [reload]);
  const ownProperties = useMemo(
    () => properties.filter((p) => !p.access || p.access === 'owner'),
    [properties],
  );
  const sharedProperties = useMemo(
    () => properties.filter((p) => p.access && p.access !== 'owner'),
    [properties],
  );
  const activeProperties = useMemo(
    () => ownProperties.filter((p) => !p.archivedAt),
    [ownProperties],
  );
  const filtered = useMemo(() => {
    const filters = {
      query,
      country,
      type,
      rental,
      currency: filterCurrency,
      archived: section === 'archive',
    };
    const source = section === 'shared' ? sharedProperties : ownProperties;
    const active = filterProperties(source, filters);
    return section === 'values'
      ? [...active, ...filterProperties(source, { ...filters, archived: true })]
      : active;
  }, [ownProperties, sharedProperties, query, country, type, section, rental, filterCurrency]);
  const stats = useMemo(() => portfolioStats(filtered), [filtered]);
  const currencyStats =
    stats.byCurrency.find((s) => s.currency === currency) ?? stats.byCurrency[0];
  const select = useCallback(async (id: string) => {
    const epoch = accountEpoch.current;
    try {
      setError('');
      const result = await api.detail(id);
      if (epoch === accountEpoch.current) setDetail(result);
    } catch (e) {
      if (epoch === accountEpoch.current) setError((e as Error).message);
    }
  }, []);
  const act = async (fn: () => Promise<unknown>, refresh = true) => {
    const epoch = accountEpoch.current;
    setError('');
    setBusy(true);
    try {
      await fn();
      if (refresh && epoch === accountEpoch.current) await reload();
    } catch (e) {
      if (epoch === accountEpoch.current) setError((e as Error).message);
    } finally {
      if (epoch === accountEpoch.current) setBusy(false);
    }
  };
  useEffect(() => {
    if (!modalOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    document
      .querySelector<HTMLElement>('.modal')
      ?.querySelector<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
      )
      ?.focus();
    return () => previousFocus?.focus();
  }, [modalOpen]);
  useEffect(() => {
    if (!editor && !detail && !csvImportOpen && !reportOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (
          detail &&
          detailDirty &&
          !window.confirm('Ungespeicherte Änderungen verwerfen und schließen?')
        )
          return;
        setEditor(null);
        setDetail(null);
        setDetailDirty(false);
        setCsvImportOpen(false);
        setReportOpen(false);
      }
      if (e.key === 'Tab') {
        const dialog = document.querySelector('.modal');
        const nodes = Array.from(
          dialog?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], summary, input:not(:disabled):not([type=file]), select:not(:disabled), textarea:not(:disabled)',
          ) ?? [],
        ).filter((node) => node.getClientRects().length > 0);
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
    };
  }, [editor, detail, detailDirty, csvImportOpen, reportOpen]);
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
          clearPrivateState();
          setUser(u);
          setError('');
          try {
            await reload();
          } catch (e) {
            setError((e as Error).message);
            if (e instanceof ApiError && e.status === 403) setSection('account');
          }
        }}
        error={error}
      />
    );
  const nav = [
    { key: 'dashboard', label: 'Übersicht', icon: LayoutDashboard },
    { key: 'values', label: 'Wertentwicklung', icon: ChartNoAxesCombined },
    { key: 'distribution', label: 'Verteilung', icon: PieChart },
    { key: 'properties', label: 'Immobilien', icon: Building2 },
    { key: 'map', label: 'Weltkarte', icon: Map },
    { key: 'documents', label: 'Dokumente', icon: FolderOpen },
    { key: 'reminders', label: 'Wiedervorlagen', icon: Bell },
    { key: 'shared', label: 'Geteilt mit mir', icon: Users },
    { key: 'archive', label: 'Archiv', icon: Archive },
    { key: 'account', label: 'Mein Konto', icon: ShieldCheck },
  ] as const;
  const goto = (key: Section) => {
    setSection(key);
    setQuery('');
    setCountry('');
    setType('');
    setRental('');
    setFilterCurrency('');
    setMobileNav(false);
  };
  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          className="nav-scrim"
          aria-label="Navigation schließen"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`sidebar ${mobileNav ? 'open' : ''}`}
        inert={modalOpen}
      >
        <Brand />
        <p className="sidebar-label">DEIN PORTFOLIO</p>
        <nav aria-label="Portfolio">
          {nav.map((n) => (
            <button
              key={n.key}
              className={`nav-item ${section === n.key ? 'active' : ''}`}
              aria-current={section === n.key ? 'page' : undefined}
              onClick={() => goto(n.key)}
            >
              <n.icon size={19} />
              {n.label}
              {n.key === 'properties' && (
                <span className="nav-count">{activeProperties.length}</span>
              )}
              {n.key === 'reminders' && reminderCount > 0 && (
                <span className="nav-count">{reminderCount}</span>
              )}
            </button>
          ))}
        </nav>
        {user.role && user.role !== 'user' && (
          <a className="nav-item" href="/admin">
            <ShieldCheck size={19} />
            Verwaltung
          </a>
        )}
        <div className="sidebar-note">
          <div className="note-icon">
            <ShieldCheck size={20} />
          </div>
          <strong>Deine Immobilien. Geordnet.</strong>
          <p>Werte, Unterlagen und Zusammenarbeit an einem Ort.</p>
          <span>
            <span className="status-dot" /> Persönlicher Workspace
          </span>
        </div>
        <div className="sidebar-user">
          <span className="avatar">{nameInitials(user.name)}</span>
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
                clearPrivateState();
                setUser(null);
              }, false)
            }
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell" inert={modalOpen}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Navigation öffnen"
              aria-expanded={mobileNav}
              aria-controls="workspace-navigation"
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
            <button
              type="button"
              className="avatar small profile-avatar"
              aria-label={`Profil von ${user.name} öffnen`}
              title="Profil öffnen"
              onClick={() => goto('account')}
            >
              {nameInitials(user.name)}
            </button>
          </div>
        </header>
        <main>
          {section === 'account' ? (
            <AccountPanel
              api={api}
              onUser={(u) => setUser((current) => (current?.id === u.id ? u : current))}
              onExit={() => {
                clearPrivateState();
                setUser(null);
                setSection('dashboard');
              }}
            />
          ) : (
            <>
              {section !== 'reminders' && (
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">DEIN IMMOBILIENPORTFOLIO</p>
                    <h1>
                      {section === 'dashboard'
                        ? 'Portfolioübersicht'
                        : section === 'values'
                          ? 'Wertentwicklung'
                          : section === 'distribution'
                            ? 'Portfolio-Verteilung'
                            : section === 'documents'
                              ? 'Dokumente'
                              : section === 'shared'
                                ? 'Geteilt mit mir'
                                : section === 'map'
                                  ? 'Deine Immobilien auf der Karte'
                                  : section === 'archive'
                                    ? 'Archiv'
                                    : 'Deine Immobilien'}
                    </h1>
                    <p>
                      {section === 'dashboard'
                        ? 'Die wichtigsten Zahlen und Objekte deines eigenen Bestands.'
                        : section === 'values'
                          ? 'Gespeicherte Werte deiner Immobilien im direkten Vergleich.'
                          : section === 'distribution'
                            ? 'Erkenne, wie sich dein Bestand auf Länder, Objektarten und Vermietung verteilt.'
                            : section === 'documents'
                              ? 'Deine Unterlagen, passend zur Immobilie und jederzeit griffbereit.'
                              : section === 'shared'
                                ? 'Arbeite gemeinsam an freigegebenen Immobilien. Dein eigener Bestand bleibt getrennt.'
                                : section === 'archive'
                                  ? 'Archivierte Immobilien bleiben erhalten und zählen nicht zu den Gesamtwerten.'
                                  : 'Verwalte deine Immobilien mit einer klaren Perspektive.'}
                    </p>
                  </div>
                  <div className="page-heading-actions">
                    <button className="button primary" onClick={() => setEditor('new')}>
                      <Plus size={18} /> Immobilie hinzufügen
                    </button>
                    <button className="button secondary" onClick={() => setCsvImportOpen(true)}>
                      <Upload size={16} /> CSV / Excel importieren
                    </button>
                    <button
                      className="button secondary"
                      disabled={!ownProperties.length}
                      onClick={() => setReportOpen(true)}
                    >
                      <FileText size={16} /> PDF-Bericht
                    </button>
                  </div>
                </div>
              )}
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
              {section === 'dashboard' && ownProperties.length === 0 && (
                <section className="quick-start" aria-labelledby="quick-start-title">
                  <div className="quick-start-intro">
                    <span className="quick-start-icon">
                      <Sparkles size={21} />
                    </span>
                    <div>
                      <p className="eyebrow">DEIN ERSTER SCHRITT</p>
                      <h2 id="quick-start-title">Dein Portfolio beginnt hier.</h2>
                      <p>Trage deinen Bestand ein oder übernimm eine vorbereitete Liste.</p>
                    </div>
                  </div>
                  <div className="quick-start-steps">
                    <article>
                      <span>01</span>
                      <div>
                        <strong>Einzeln eintragen</strong>
                        <p>Adresse, Fläche und deine eigenen Werte hinzufügen.</p>
                      </div>
                      <button className="text-button" onClick={() => setEditor('new')}>
                        Immobilie anlegen <ArrowRight size={15} />
                      </button>
                    </article>
                    <article>
                      <span>02</span>
                      <div>
                        <strong>Liste importieren</strong>
                        <p>Bis zu 50 Objekte aus einer CSV- oder Excel-Datei übernehmen.</p>
                      </div>
                      <button className="text-button" onClick={() => setCsvImportOpen(true)}>
                        CSV / Excel importieren <ArrowRight size={15} />
                      </button>
                    </article>
                    <article>
                      <span>03</span>
                      <div>
                        <strong>EstateAtlas ansehen</strong>
                        <p>Mit klar markierten Beispieldaten starten.</p>
                      </div>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => act(() => api.seed())}
                      >
                        Testdaten laden <ArrowRight size={15} />
                      </button>
                    </article>
                  </div>
                  <p className="quick-start-note">
                    <ShieldCheck size={15} /> Dateien werden auf deinem Gerät gelesen. Adressen
                    werden nicht an einen Geocoder gesendet. Koordinaten müssen in der Datei stehen.
                  </p>
                </section>
              )}
              {section !== 'documents' &&
                section !== 'reminders' &&
                !(section === 'dashboard' && ownProperties.length === 0) && (
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
                    <select
                      aria-label="Währung filtern"
                      value={filterCurrency}
                      onChange={(e) => setFilterCurrency(e.target.value)}
                    >
                      <option value="">Alle Währungen</option>
                      {[...new Set(properties.map((p) => p.currency))].sort().map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Vermietung filtern"
                      value={rental}
                      onChange={(e) => setRental(e.target.value)}
                    >
                      <option value="">Alle Vermietungsangaben</option>
                      <option value="rented">Mietvertrag hinterlegt</option>
                      <option value="vacant">Nicht vermietet</option>
                      <option value="unknown">Nicht angegeben</option>
                    </select>
                    <button
                      className="text-button"
                      onClick={() => {
                        setQuery('');
                        setCountry('');
                        setType('');
                        setRental('');
                        setFilterCurrency('');
                      }}
                    >
                      Filter zurücksetzen
                    </button>
                    <button className="text-button" disabled={busy} onClick={() => act(reload)}>
                      <RotateCcw size={15} /> Aktualisieren
                    </button>
                  </div>
                )}
              {section === 'reminders' && (
                <PortfolioReminders
                  api={api}
                  properties={properties}
                  onSelect={(id) => {
                    void select(id);
                    setSection('dashboard');
                  }}
                  onAddProperty={() => setEditor('new')}
                  onCountChange={setReminderCount}
                />
              )}
              {section === 'distribution' && (
                <PortfolioDistribution properties={filtered} onSelect={select} />
              )}
              {section === 'documents' && (
                <Documents
                  properties={properties}
                  api={api}
                  onSelect={select}
                  revision={properties.map((p) => `${p.id}:${p.updatedAt}`).join('|')}
                />
              )}
              {section === 'shared' && <AcceptInvitation api={api} onAccepted={reload} />}
              {section === 'values' && (
                <PortfolioValues
                  properties={filtered}
                  revision={properties.map((p) => `${p.id}:${p.updatedAt}`).join('|')}
                  api={api}
                  onSelect={select}
                />
              )}
              {section === 'dashboard' && ownProperties.length > 0 && (
                <details className="dashboard-customize">
                  <summary>Dashboard anpassen</summary>
                  <div>
                    {dashboardWidgets.map((w) => (
                      <label className="inline-check" key={w}>
                        <input
                          type="checkbox"
                          checked={widgets[w]}
                          onChange={(e) => {
                            const values = { ...widgets, [w]: e.target.checked };
                            setPreferences({ account: user.id, values });
                            setStorageError('');
                            try {
                              localStorage.setItem(
                                `estateatlas-dashboard-${user.id}`,
                                JSON.stringify(values),
                              );
                            } catch {
                              setStorageError(
                                'Die Ansicht gilt für diese Sitzung; Speichern im Browser ist nicht verfügbar.',
                              );
                            }
                          }}
                        />
                        {dashboardWidgetLabels[w]}
                      </label>
                    ))}
                  </div>
                  {storageError && (
                    <p role="status" className="muted">
                      {storageError}
                    </p>
                  )}
                  <p className="muted">
                    Deine Auswahl bleibt in diesem Browser für dein Konto gespeichert. Filter gelten
                    für alle sichtbaren Bereiche.
                  </p>
                </details>
              )}
              {section === 'dashboard' && (ownProperties.length > 0 || widgets.map) && (
                <>
                  {widgets.metrics && ownProperties.length > 0 && (
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
                        <p>{ownProperties.filter((p) => p.archivedAt).length} im Archiv</p>
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
                        <p>Über die gefilterten aktiven Immobilien</p>
                      </article>
                    </div>
                  )}
                  <div className="overview-grid">
                    {widgets.map && (
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
                        <PropertyMap properties={filtered} onSelect={select} />
                        <div className="map-caption">
                          <span className="status-dot" />
                          {stats.count} Immobilien · {stats.countries} Länder
                          <span>OpenStreetMap</span>
                        </div>
                      </section>
                    )}
                    {widgets.insights && ownProperties.length > 0 && (
                      <section className="panel insights">
                        <div className="panel-heading">
                          <div>
                            <h2>Werte & Perspektiven</h2>
                            <p>{currencyStats?.currency ?? 'EUR'} · eigene Angaben</p>
                          </div>
                          <ChartNoAxesCombined size={20} />
                        </div>
                        <div className="gain-value">
                          {currencyStats
                            ? formatMoney(currencyStats.gain, currencyStats.currency)
                            : '—'}
                          <span
                            className={currencyStats && currencyStats.gain < 0 ? 'negative' : ''}
                          >
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
                            const total = filtered
                              .filter(
                                (p) =>
                                  !p.archivedAt &&
                                  p.type === t &&
                                  p.currency === currencyStats?.currency,
                              )
                              .reduce((a, p) => a + p.marketValue, 0);
                            return (
                              <div key={t}>
                                <div>
                                  <span>{propertyTypeLabels[t]}</span>
                                  <strong>
                                    {currencyStats
                                      ? formatMoney(total, currencyStats.currency)
                                      : '—'}
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
                              Vergleichsangebote, nachvollziehbare Preisspannen und Quellen direkt
                              bei deiner Immobilie.
                            </p>
                          </div>
                        </div>
                      </section>
                    )}
                  </div>
                </>
              )}
              {!['values', 'distribution', 'documents', 'reminders'].includes(section) &&
                !(section === 'dashboard' && ownProperties.length === 0) &&
                (section !== 'dashboard' || widgets.properties) && (
                  <section className={`property-section ${section === 'map' ? 'map-section' : ''}`}>
                    <div className="section-heading">
                      <div>
                        <h2>
                          {section === 'archive'
                            ? 'Archivierte Immobilien'
                            : section === 'shared'
                              ? 'Freigegebene Immobilien'
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
                          {section === 'shared'
                            ? 'Gemeinsam beginnt mit einer Einladung.'
                            : ownProperties.length
                              ? 'Hier ist noch Platz.'
                              : 'Dein Portfolio beginnt hier.'}
                        </h3>
                        <p>
                          {section === 'shared'
                            ? 'Nimm oben eine Einladung an, um freigegebene Immobilien zu sehen.'
                            : ownProperties.length
                              ? 'Keine Immobilien passen zu dieser Auswahl.'
                              : 'Füge deine erste Immobilie hinzu oder erkunde EstateAtlas mit klar gekennzeichneten Testdaten.'}
                        </p>
                        {section !== 'shared' && (
                          <div className="empty-actions">
                            <button className="button primary" onClick={() => setEditor('new')}>
                              <Plus size={16} /> Erste Immobilie hinzufügen
                            </button>
                            {!ownProperties.length && (
                              <>
                                <button
                                  className="button secondary"
                                  onClick={() => setCsvImportOpen(true)}
                                >
                                  <Upload size={16} /> CSV / Excel importieren
                                </button>
                                <button
                                  className="button secondary"
                                  disabled={busy}
                                  onClick={() => act(() => api.seed())}
                                >
                                  Testdaten laden
                                </button>
                              </>
                            )}
                          </div>
                        )}
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
                              <PropertyArtwork type={p.type} />
                              <span className="location-badge">{p.country}</span>
                              {p.isTestData && <span className="sample-badge">TESTDATEN</span>}
                            </div>
                            <div className="property-content">
                              <div className="property-type">
                                {propertyTypeLabels[p.type]}
                                {p.access && p.access !== 'owner' && (
                                  <span className="access-badge">
                                    {p.access === 'editor' ? 'Bearbeiten' : 'Ansehen'}
                                  </span>
                                )}
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
                )}
              <footer className="page-footer">
                <span>EstateAtlas · Klarheit für deine Immobilien.</span>
                <span>¹ Marktwerte sind deine Angaben, keine KI-Bewertung.</span>
              </footer>
            </>
          )}
        </main>
      </div>
      <PropertyCsvImport
        api={api}
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        onImported={reload}
      />
      <PortfolioReportDialog
        properties={ownProperties}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />
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
          key={detail.id}
          property={detail}
          busy={busy}
          actionError={error}
          onDirtyChange={setDetailDirty}
          onClose={() => {
            if (
              !detailDirty ||
              window.confirm('Ungespeicherte Änderungen verwerfen und schließen?')
            )
              setDetail(null);
          }}
          onEdit={() => {
            if (
              detailDirty &&
              !window.confirm('Ungespeicherte Änderungen verwerfen und Immobilie bearbeiten?')
            )
              return;
            setEditor(detail);
            setDetail(null);
          }}
          onRefresh={async () => {
            await reload();
            await select(detail.id);
          }}
          onArchive={() => {
            if (
              detailDirty &&
              !window.confirm('Ungespeicherte Änderungen verwerfen und Archivstatus ändern?')
            )
              return;
            void act(async () => {
              await api.archive(detail.id, !detail.archivedAt);
              setDetail(null);
            });
          }}
          onDelete={() => {
            if (
              detailDirty &&
              !window.confirm('Ungespeicherte Änderungen verwerfen und mit dem Löschen fortfahren?')
            )
              return;
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
function Detail({
  property: p,
  onClose,
  onEdit,
  onRefresh,
  onArchive,
  onDelete,
  busy,
  actionError,
  onDirtyChange,
}: {
  property: PropertyDetail;
  onClose: () => void;
  onEdit: () => void;
  onRefresh: () => Promise<void>;
  onArchive: () => void;
  onDelete: () => void;
  busy: boolean;
  actionError: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const owner = !p.access || p.access === 'owner';
  const editable = p.access !== 'viewer';
  const tabs: { id: WorkspaceTab; label: string; icon: typeof Building2 }[] = [
    { id: 'overview', label: 'Übersicht', icon: Building2 },
    { id: 'values', label: 'Werte', icon: ChartNoAxesCombined },
    { id: 'documents', label: 'Dokumente', icon: FolderOpen },
    { id: 'handover', label: 'Übergabe', icon: ClipboardCheck },
    { id: 'purchase', label: 'Kaufcheck', icon: Calculator },
    { id: 'sharing', label: 'Zusammenarbeit', icon: Users },
  ];
  return (
    <div className="modal-backdrop">
      <section
        className="modal detail property-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">
              {propertyTypeLabels[p.type]} · {p.country} {p.isTestData ? '· TESTDATEN' : ''}
              {!owner ? ` · ${p.access === 'editor' ? 'Bearbeitungsrechte' : 'Leserechte'}` : ''}
            </p>
            <h2 id="detail-title">{p.title}</h2>
            <p>{p.address}</p>
          </div>
          <button className="icon-button" aria-label="Schließen" onClick={onClose} autoFocus>
            <X size={20} />
          </button>
        </div>
        <div className="workspace-tabs" role="tablist" aria-label="Immobilienbereiche">
          {tabs.map((item, index) => (
            <button
              key={item.id}
              id={`workspace-tab-${item.id}`}
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`workspace-content-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                  event.preventDefault();
                  const next =
                    tabs[
                      (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
                    ];
                  setTab(next.id);
                  document.getElementById(`workspace-tab-${next.id}`)?.focus();
                }
              }}
              onClick={() => setTab(item.id)}
            >
              <item.icon size={16} />
              {item.label}
              {item.id === 'documents' && p.assets.length > 0 && <span>{p.assets.length}</span>}
            </button>
          ))}
        </div>
        <div className="detail-body">
          {(error || actionError) && (
            <p role="alert" className="error workspace-feedback">
              {error || actionError}
            </p>
          )}
          <WorkspacePanels property={p} api={api} tab={tab} onDirtyChange={onDirtyChange} />
          <div
            id="workspace-content-overview"
            role="tabpanel"
            aria-labelledby="workspace-tab-overview"
            hidden={tab !== 'overview'}
          >
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
            <AnalysisPanel
              key={p.id}
              property={p}
              api={api}
              onApplied={onRefresh}
              onError={setError}
            />
            <div className="object-facts">
              <h3>Objektangaben</h3>
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
              {p.notes && (
                <div className="detail-notes">
                  <h3>Notizen</h3>
                  <p>{p.notes}</p>
                </div>
              )}
            </div>
            <div className="object-shortcuts">
              <button onClick={() => setTab('handover')}>
                <ClipboardCheck size={20} />
                <span>
                  <strong>Übergabe vorbereiten</strong>
                  <small>Checklisten & Protokollnotizen</small>
                </span>
                <ChevronRight size={17} />
              </button>
              <button onClick={() => setTab('purchase')}>
                <Calculator size={20} />
                <span>
                  <strong>Kauf durchrechnen</strong>
                  <small>Nebenkosten & Kapitalbedarf</small>
                </span>
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
          <div
            id="workspace-content-values"
            role="tabpanel"
            aria-labelledby="workspace-tab-values"
            hidden={tab !== 'values'}
          >
            <ValueHistory
              key={`${p.id}-${p.currency}`}
              values={p.valuations}
              currency={p.currency}
            />
          </div>
          <div
            id="workspace-content-documents"
            role="tabpanel"
            aria-labelledby="workspace-tab-documents"
            hidden={tab !== 'documents'}
          >
            <div className="detail-subheading">
              <div>
                <h3>Fotos & Dokumente</h3>
                <p className="muted">Optional speichern · JPEG, PNG, WebP oder PDF · bis 10 MB</p>
              </div>
              {editable && (
                <UploadDocument
                  propertyId={p.id}
                  api={api}
                  onUploaded={onRefresh}
                  onError={setError}
                />
              )}
            </div>
            <p className="workspace-hint">
              Dateien sind für dich und Personen mit Zugriff auf diese Immobilie sichtbar.
            </p>
            {p.assets.length ? (
              <DocumentList
                assets={p.assets}
                properties={[p]}
                api={api}
                busy={uploading}
                onError={setError}
                onDelete={async (id) => {
                  setUploading(true);
                  setError('');
                  try {
                    await api.deleteAsset(id);
                    await onRefresh();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            ) : (
              <div className="workspace-empty">
                <FolderOpen size={30} />
                <h3>Platz für alles Wichtige</h3>
                <p>Lege hier bei Bedarf Exposés, Verträge, Übergabeprotokolle und Fotos ab.</p>
              </div>
            )}
          </div>
          <div
            id="workspace-content-sharing"
            role="tabpanel"
            aria-labelledby="workspace-tab-sharing"
            hidden={tab !== 'sharing'}
          >
            <SharingPanel property={p} api={api} onError={setError} />
          </div>
        </div>
        <footer className="modal-footer detail-actions">
          {owner && (
            <>
              <button className="button danger" disabled={busy} onClick={onDelete}>
                <Trash2 size={16} />
                Löschen
              </button>
              <button className="button secondary" disabled={busy} onClick={onArchive}>
                <Archive size={16} />
                {p.archivedAt ? 'Wiederherstellen' : 'Archivieren'}
              </button>
            </>
          )}
          {editable ? (
            <button className="button primary" onClick={onEdit}>
              <Pencil size={16} />
              Bearbeiten
            </button>
          ) : (
            <span className="muted">Du hast Leserechte für diese Immobilie.</span>
          )}
        </footer>
      </section>
    </div>
  );
}
