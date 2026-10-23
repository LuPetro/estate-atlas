'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { ApiClient, ApiError } from '@estate-atlas/api-client';
import {
  cashflowCategories,
  cashflowCategoryLabels,
  cashflowAmount,
  cashflowInputSchema,
  cashflowRequestKey,
  shiftCashflowMonth,
  currencies,
  formatMoney,
  isCashflowIncome,
  localDateKey,
  type CashflowCategory,
  type CashflowEntry,
  type CashflowReport,
  type Currency,
  type Property,
} from '@estate-atlas/shared';

type Draft = {
  propertyId: string;
  title: string;
  date: string;
  category: CashflowCategory;
  amount: string;
  currency: Currency;
  notes: string;
};
const draftFor = (property?: Property): Draft => ({
  propertyId: property?.id ?? '',
  title: '',
  date: localDateKey(),
  category: 'rent',
  amount: '',
  currency: property?.currency ?? 'EUR',
  notes: '',
});
const dateLabel = (value: string) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString('de-AT', { timeZone: 'UTC' });

export default function PortfolioCashflow({
  api,
  properties,
  onSelect,
  onDirty,
}: {
  api: ApiClient;
  properties: Property[];
  onSelect: (id: string) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const editable = properties.filter((p) => p.access !== 'viewer' && !p.archivedAt);
  const [month, setMonth] = useState(() => localDateKey().slice(0, 7));
  const [scope, setScope] = useState<'owned' | 'all'>('owned');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState<CashflowReport | null>(null);
  const [draft, setDraft] = useState<Draft>(() => draftFor(editable[0]));
  const [editing, setEditing] = useState<CashflowEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const requestKey = useRef(cashflowRequestKey());
  const alive = useRef(false);
  const dirty = !!(editing || draft.title || draft.amount || draft.notes);
  useEffect(() => {
    onDirty(dirty);
    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    if (dirty) window.addEventListener('beforeunload', leave);
    return () => {
      onDirty(false);
      window.removeEventListener('beforeunload', leave);
    };
  }, [dirty, onDirty]);
  const propertyRevision = properties.map((p) => `${p.id}:${p.updatedAt}:${p.access}`).join('|');
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setReport(null);
    void api
      .cashflow(month, propertyFilter, scope, page, controller.signal)
      .then((result) => {
        if (active) {
          setReport(result);
          if (page !== result.page) setPage(result.page);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [api, month, propertyFilter, scope, page, revision, propertyRevision]);
  useEffect(() => {
    if (!editable.some((p) => p.id === draft.propertyId)) {
      setDraft(draftFor(editable[0]));
      setEditing(null);
      requestKey.current = cashflowRequestKey();
    }
  }, [propertyRevision, draft.propertyId]);
  const visibleProperties = properties.filter(
    (p) => scope === 'all' || !p.access || p.access === 'owner',
  );
  const canEdit = (entry: CashflowEntry) => editable.some((p) => p.id === entry.propertyId);
  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setSuccess('');
  };
  const resetDraft = () => {
    setEditing(null);
    setDraft(draftFor(editable.find((p) => p.id === draft.propertyId) ?? editable[0]));
    requestKey.current = cashflowRequestKey();
  };
  const edit = (entry: CashflowEntry) => {
    if (
      (editing || draft.title || draft.amount || draft.notes) &&
      !window.confirm('Die bisherigen Eingaben verwerfen und diese Buchung bearbeiten?')
    )
      return;
    setEditing(entry);
    setError('');
    setSuccess('');
    setDraft({
      propertyId: entry.propertyId,
      title: entry.title,
      date: entry.date,
      category: entry.category,
      amount: String(entry.amount).replace('.', ','),
      currency: entry.currency,
      notes: entry.notes,
    });
    document.getElementById('cashflow-editor')?.scrollIntoView({ block: 'start' });
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const parsed = cashflowInputSchema.safeParse({
      title: draft.title,
      date: draft.date,
      category: draft.category,
      amount: cashflowAmount(draft.amount),
      currency: draft.currency,
      notes: draft.notes,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Bitte Eingaben prüfen.');
      return;
    }
    setBusy(true);
    try {
      const result = editing
        ? await api.updateCashflow(editing.propertyId, editing.id, parsed.data, editing.version)
        : await api.createCashflow(draft.propertyId, parsed.data, requestKey.current);
      if (!alive.current) return;
      resetDraft();
      setMonth(result.date.slice(0, 7));
      setPage(1);
      if (propertyFilter && propertyFilter !== result.propertyId)
        setPropertyFilter(result.propertyId);
      if (
        properties.find((p) => p.id === result.propertyId)?.access &&
        properties.find((p) => p.id === result.propertyId)?.access !== 'owner'
      )
        setScope('all');
      setRevision((value) => value + 1);
      setSuccess('Buchung gespeichert.');
    } catch (e) {
      if (alive.current) {
        setError((e as Error).message);
        if (e instanceof ApiError && e.status === 409) setRevision((value) => value + 1);
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const remove = async (entry: CashflowEntry) => {
    if (!window.confirm(`Buchung „${entry.title}“ endgültig löschen?`)) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api.deleteCashflow(entry.propertyId, entry.id, entry.version);
      if (!alive.current) return;
      if (editing?.id === entry.id) resetDraft();
      setRevision((value) => value + 1);
      setSuccess('Buchung gelöscht.');
    } catch (e) {
      if (alive.current) {
        setError((e as Error).message);
        setRevision((value) => value + 1);
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const pages = report ? Math.max(1, Math.ceil(report.total / report.pageSize)) : 1;
  return (
    <div className="cashflow-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DEIN PORTFOLIO</p>
          <h1>Einnahmen &amp; Ausgaben</h1>
          <p>Monatsübersicht deiner erfassten Buchungen – je Immobilie und Währung.</p>
        </div>
      </div>
      {error && (
        <p className="error banner" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="cashflow-success" role="status">
          {success}
        </p>
      )}
      <div className="cashflow-filters">
        <div className="cashflow-month">
          <button
            className="icon-button"
            aria-label="Vorheriger Monat"
            disabled={month === '1900-01'}
            onClick={() => {
              setMonth(shiftCashflowMonth(month, -1));
              setPage(1);
            }}
          >
            <ChevronLeft size={19} />
          </button>
          <label>
            Monat
            <input
              type="month"
              value={month}
              min="1900-01"
              max="9999-12"
              onChange={(e) => {
                if (/^(?:19|[2-9]\d)\d{2}-(?:0[1-9]|1[0-2])$/.test(e.target.value)) {
                  setMonth(e.target.value);
                  setPage(1);
                }
              }}
            />
          </label>
          <button
            className="icon-button"
            aria-label="Nächster Monat"
            disabled={month === '9999-12'}
            onClick={() => {
              setMonth(shiftCashflowMonth(month, 1));
              setPage(1);
            }}
          >
            <ChevronRight size={19} />
          </button>
        </div>
        <label>
          Immobilie
          <select
            value={propertyFilter}
            onChange={(e) => {
              setPropertyFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Alle Immobilien</option>
            {visibleProperties.map((p) => (
              <option value={p.id} key={p.id}>
                {p.title}
                {p.archivedAt ? ' · Archiv' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={scope === 'all'}
            onChange={(e) => {
              setScope(e.target.checked ? 'all' : 'owned');
              setPropertyFilter('');
              setPage(1);
            }}
          />
          Geteilte Immobilien einbeziehen
        </label>
        <button
          className="text-button"
          disabled={loading || busy}
          onClick={() => {
            setError('');
            setRevision((value) => value + 1);
          }}
        >
          <RotateCcw size={15} />
          Aktualisieren
        </button>
      </div>
      <p className="cashflow-scope muted">
        {scope === 'owned' ? 'Eigene Immobilien' : 'Eigene und freigegebene Immobilien'} ·
        Archivierte Immobilien sind für historische Buchungen enthalten.
      </p>
      {loading && (
        <p role="status" className="cashflow-loading">
          Monatsübersicht wird geladen …
        </p>
      )}
      {report && (
        <>
          {!report.totals.length && (
            <div className="cashflow-empty">
              <h2>Noch keine Buchungen in diesem Monat</h2>
              <p>
                Erfasse eine Einnahme oder Ausgabe für eine Immobilie. Die Monatsübersicht entsteht
                aus deinen Einträgen.
              </p>
            </div>
          )}
          <div className="cashflow-totals">
            {report.totals.map((total) => (
              <section
                className="cashflow-total"
                key={total.currency}
                aria-label={`Monatssummen ${total.currency}`}
              >
                <h2>{total.currency}</h2>
                <dl>
                  <div>
                    <dt>Einnahmen</dt>
                    <dd>{formatMoney(total.income, total.currency)}</dd>
                  </div>
                  <div>
                    <dt>Ausgaben</dt>
                    <dd>{formatMoney(total.expenses, total.currency)}</dd>
                  </div>
                  <div>
                    <dt>Überschuss / Fehlbetrag</dt>
                    <dd className={total.balance < 0 ? 'cashflow-negative' : 'cashflow-positive'}>
                      {formatMoney(total.balance, total.currency)}
                    </dd>
                  </div>
                </dl>
              </section>
            ))}
          </div>
          {!!report.byProperty.length && (
            <section className="cashflow-summary">
              <h2>Nach Immobilie</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Immobilie</th>
                      <th>Währung</th>
                      <th>Einnahmen</th>
                      <th>Ausgaben</th>
                      <th>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byProperty.map((row) => (
                      <tr key={`${row.propertyId}:${row.currency}`}>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => {
                              setPropertyFilter(row.propertyId);
                              setPage(1);
                            }}
                          >
                            {row.propertyTitle}
                          </button>
                        </td>
                        <td>{row.currency}</td>
                        <td>{formatMoney(row.income, row.currency)}</td>
                        <td>{formatMoney(row.expenses, row.currency)}</td>
                        <td className={row.balance < 0 ? 'cashflow-negative' : ''}>
                          {formatMoney(row.balance, row.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
      <div className="cashflow-layout">
        <section className="cashflow-ledger">
          <div className="section-heading">
            <h2>Buchungen {report && <span className="counter">{report.total}</span>}</h2>
          </div>
          {report?.entries.map((entry) => (
            <article className="cashflow-entry" key={entry.id}>
              <div className="cashflow-entry-copy">
                <strong>{entry.title}</strong>
                <button className="text-button" onClick={() => onSelect(entry.propertyId)}>
                  {entry.propertyTitle}
                </button>
                <span>
                  {dateLabel(entry.date)} · {cashflowCategoryLabels[entry.category]}
                </span>
                {entry.notes && <p>{entry.notes}</p>}
              </div>
              <strong
                className={
                  isCashflowIncome(entry.category) ? 'cashflow-positive' : 'cashflow-negative'
                }
              >
                {isCashflowIncome(entry.category) ? '+' : '−'}
                {formatMoney(entry.amount, entry.currency)}
              </strong>
              {canEdit(entry) ? (
                <div className="cashflow-actions">
                  <button
                    className="icon-button"
                    aria-label={`${entry.title} bearbeiten`}
                    disabled={busy}
                    onClick={() => edit(entry)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`${entry.title} löschen`}
                    disabled={busy}
                    onClick={() => void remove(entry)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <small className="muted">Nur lesen</small>
              )}
            </article>
          ))}
          {report && report.total > report.pageSize && (
            <nav className="cashflow-pagination" aria-label="Buchungsseiten">
              <button
                className="button secondary"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => value - 1)}
              >
                Zurück
              </button>
              <span>
                Seite {report.page} / {pages}
              </span>
              <button
                className="button secondary"
                disabled={page >= pages || loading}
                onClick={() => setPage((value) => value + 1)}
              >
                Weiter
              </button>
            </nav>
          )}
        </section>
        <form className="cashflow-form" id="cashflow-editor" onSubmit={(event) => void save(event)}>
          <h2>{editing ? 'Buchung bearbeiten' : 'Buchung hinzufügen'}</h2>
          {!editable.length ? (
            <p className="muted">
              Für neue Buchungen brauchst du eine aktive eigene Immobilie oder Bearbeitungsrechte.
            </p>
          ) : (
            <fieldset disabled={busy}>
              <label>
                Immobilie
                <select
                  value={draft.propertyId}
                  disabled={!!editing}
                  required
                  onChange={(e) => {
                    const property = editable.find((p) => p.id === e.target.value);
                    setDraft((value) => ({
                      ...value,
                      propertyId: e.target.value,
                      currency: property?.currency ?? value.currency,
                    }));
                  }}
                >
                  {editable.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.title}
                      {p.access === 'editor' ? ' · Geteilt' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Bezeichnung
                <input
                  value={draft.title}
                  minLength={2}
                  maxLength={120}
                  required
                  placeholder="z. B. Miete November"
                  onChange={(e) => change('title', e.target.value)}
                />
              </label>
              <label>
                Datum
                <input
                  type="date"
                  min="1900-01-01"
                  value={draft.date}
                  required
                  onChange={(e) => change('date', e.target.value)}
                />
              </label>
              <label>
                Kategorie
                <select
                  value={draft.category}
                  onChange={(e) => change('category', e.target.value as CashflowCategory)}
                >
                  <optgroup label="Einnahmen">
                    {cashflowCategories.filter(isCashflowIncome).map((category) => (
                      <option value={category} key={category}>
                        {cashflowCategoryLabels[category]}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Ausgaben">
                    {cashflowCategories
                      .filter((category) => !isCashflowIncome(category))
                      .map((category) => (
                        <option value={category} key={category}>
                          {cashflowCategoryLabels[category]}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </label>
              <div className="cashflow-amount-fields">
                <label>
                  Betrag (ohne Tausendertrennzeichen)
                  <input
                    inputMode="decimal"
                    value={draft.amount}
                    required
                    maxLength={20}
                    placeholder="0,00"
                    onChange={(e) => change('amount', e.target.value)}
                  />
                </label>
                <label>
                  Währung
                  <select
                    value={draft.currency}
                    onChange={(e) => change('currency', e.target.value as Currency)}
                  >
                    {currencies.map((currency) => (
                      <option key={currency}>{currency}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Notiz (optional)
                <textarea
                  value={draft.notes}
                  maxLength={1000}
                  rows={3}
                  onChange={(e) => change('notes', e.target.value)}
                />
              </label>
              <p className="muted">
                Betrag positiv eingeben. Die Kategorie bestimmt Einnahme oder Ausgabe.
              </p>
              <button className="button primary" disabled={!draft.propertyId}>
                <Plus size={16} />
                {busy ? 'Wird gespeichert …' : editing ? 'Änderung speichern' : 'Buchung speichern'}
              </button>
              {editing && (
                <button type="button" className="button secondary" onClick={resetDraft}>
                  <X size={16} />
                  Änderungen verwerfen
                </button>
              )}
            </fieldset>
          )}
        </form>
      </div>
    </div>
  );
}
