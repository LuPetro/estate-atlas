'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import type { ApiClient } from '@estate-atlas/api-client';
import type { PortfolioReminder, Property } from '@estate-atlas/shared';
import { localDateKey } from '@estate-atlas/shared';
import ReminderEmailControl, {
  ReminderEmailFields,
  reminderTimeZone,
} from './ReminderEmailControl';

const localDate = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString('de-AT', { timeZone: 'UTC' });

export default function PortfolioReminders({
  api,
  properties,
  onSelect,
  onAddProperty,
  onCountChange,
}: {
  api: ApiClient;
  properties: Property[];
  onSelect: (id: string) => void;
  onAddProperty: () => void;
  onCountChange: (count: number) => void;
}) {
  const editable = properties.filter(
    (property) => !property.archivedAt && property.access !== 'viewer',
  );
  const [reminders, setReminders] = useState<PortfolioReminder[]>([]);
  const [propertyId, setPropertyId] = useState(editable[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [mailEnabled, setMailEnabled] = useState(false);
  const [notify, setNotify] = useState(false);
  const [daysBefore, setDaysBefore] = useState<0 | 1 | 3 | 7>(1);
  const live = useRef(false);
  const readVersion = useRef(0);
  const canEdit = (reminder: PortfolioReminder) =>
    properties.some(
      (property) => property.id === reminder.propertyId && property.access !== 'viewer',
    );
  const reload = useCallback(async () => {
    const version = ++readVersion.current;
    const result = await api.reminders();
    if (!live.current || version !== readVersion.current) return;
    setReminders(result);
    onCountChange(result.filter((reminder) => !reminder.completedAt).length);
    setLoaded(true);
  }, [api, onCountChange]);
  useEffect(() => {
    live.current = true;
    void Promise.all([api.accountConfig(), api.me()])
      .then(([config, user]) => {
        if (live.current) {
          setMailEnabled(config.mailEnabled);
          setEmailAvailable(config.mailEnabled && !!user.emailVerifiedAt);
        }
      })
      .catch((e) => {
        if (live.current) setError(e.message);
      });
    void reload().catch((e) => {
      if (live.current) setError(e.message);
    });
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload().catch(() => {});
    }, 60000);
    return () => {
      live.current = false;
      window.clearInterval(poll);
    };
  }, [reload]);
  useEffect(() => {
    if (!editable.some((property) => property.id === propertyId))
      setPropertyId(editable[0]?.id ?? '');
  }, [editable, propertyId]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!propertyId) return;
    setBusy(true);
    setError('');
    try {
      await api.createReminder(propertyId, {
        title,
        dueDate,
        notes,
        emailNotification: notify ? { daysBefore, timeZone: reminderTimeZone() } : null,
      });
      if (!live.current) return;
      setTitle('');
      setDueDate('');
      setNotes('');
      setNotify(false);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const update = async (reminder: PortfolioReminder, completed: boolean) => {
    setBusy(true);
    setError('');
    try {
      await api.setReminderCompleted(reminder.propertyId, reminder.id, completed);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (reminder: PortfolioReminder) => {
    if (!window.confirm(`Wiedervorlage „${reminder.title}“ endgültig löschen?`)) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteReminder(reminder.propertyId, reminder.id);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const today = localDateKey();
  const setEmail = async (
    reminder: PortfolioReminder,
    input: import('@estate-atlas/shared').ReminderEmailPreference | null,
  ) => {
    setBusy(true);
    setError('');
    try {
      await api.setReminderEmail(reminder.propertyId, reminder.id, input);
      if (live.current) await reload();
    } catch (e) {
      if (live.current) setError((e as Error).message);
    } finally {
      if (live.current) setBusy(false);
    }
  };
  const open = reminders.filter((reminder) => !reminder.completedAt);
  const completed = reminders.filter((reminder) => reminder.completedAt);
  return (
    <div className="reminders-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DEIN PORTFOLIO</p>
          <h1>Wiedervorlagen</h1>
          <p>Termine und Aufgaben zu deinen Immobilien. Fälliges zuerst.</p>
          <p className="muted reminder-email-note">
            E-Mails sind freiwillig und gelten nur für dein Konto. Versand um 09:00 Uhr in deiner
            Zeitzone; ein bereits verstrichener Zeitpunkt wird zeitnah nachgeholt. Titel, Immobilie
            und Fälligkeit stehen in der E-Mail.
          </p>
          {loaded && !emailAvailable && (
            <p className="muted">
              {mailEnabled
                ? 'Bestätige deine E-Mail-Adresse im Konto, um Erinnerungen per E-Mail zu aktivieren.'
                : 'Der E-Mail-Versand ist für diese Installation nicht eingerichtet.'}
            </p>
          )}
        </div>
      </div>
      {error && (
        <p className="error banner" role="alert">
          {error}
        </p>
      )}
      {!properties.length && (
        <div className="empty-state">
          <h2>Erst eine Immobilie anlegen</h2>
          <p>Wiedervorlagen werden einer Immobilie zugeordnet.</p>
          <button className="button primary" onClick={onAddProperty}>
            Immobilie hinzufügen
          </button>
        </div>
      )}
      {!!properties.length && (
        <div className="reminders-layout">
          <section className="reminder-list">
            <div className="section-heading">
              <h2>
                Offen <span className="counter">{open.length}</span>
              </h2>
            </div>
            {!loaded && !error && (
              <p className="reminder-empty" role="status">
                Wiedervorlagen werden geladen …
              </p>
            )}
            {loaded && !open.length && (
              <p className="reminder-empty">Keine offenen Wiedervorlagen.</p>
            )}
            {open.map((reminder) => (
              <article
                className={`reminder-row ${reminder.dueDate < today ? 'overdue' : ''}`}
                key={reminder.id}
              >
                <button
                  className="reminder-check"
                  disabled={busy || !canEdit(reminder)}
                  role="checkbox"
                  aria-checked={false}
                  aria-label={`${reminder.title} erledigt markieren`}
                  onClick={() => void update(reminder, true)}
                >
                  <Check size={17} />
                </button>
                <div className="reminder-content">
                  <button className="reminder-copy" onClick={() => onSelect(reminder.propertyId)}>
                    <strong>{reminder.title}</strong>
                    <span>
                      {reminder.propertyTitle} ·{' '}
                      <time dateTime={reminder.dueDate}>{localDate(reminder.dueDate)}</time>
                      {reminder.dueDate < today
                        ? ' · Überfällig'
                        : reminder.dueDate === today
                          ? ' · Heute'
                          : ''}
                      {!canEdit(reminder) && ' · Nur lesen'}
                    </span>
                    {reminder.notes && <small>{reminder.notes}</small>}
                  </button>
                  <ReminderEmailControl
                    notification={reminder.emailNotification}
                    available={
                      emailAvailable &&
                      !properties.find((p) => p.id === reminder.propertyId)?.archivedAt &&
                      reminder.dueDate >= today
                    }
                    disabled={busy}
                    onChange={(input) => void setEmail(reminder, input)}
                  />
                </div>
                {canEdit(reminder) && (
                  <button
                    className="icon-button"
                    disabled={busy}
                    aria-label={`${reminder.title} löschen`}
                    onClick={() => void remove(reminder)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </article>
            ))}
            {!!completed.length && (
              <details className="reminder-completed">
                <summary>Erledigt ({completed.length})</summary>
                {completed.map((reminder) => (
                  <article className="reminder-row completed" key={reminder.id}>
                    <button
                      className="reminder-check checked"
                      disabled={busy || !canEdit(reminder)}
                      role="checkbox"
                      aria-checked={true}
                      aria-label={`${reminder.title} wieder öffnen`}
                      onClick={() => void update(reminder, false)}
                    >
                      <Check size={17} />
                    </button>
                    <button className="reminder-copy" onClick={() => onSelect(reminder.propertyId)}>
                      <strong>{reminder.title}</strong>
                      <span>
                        {reminder.propertyTitle} · {localDate(reminder.dueDate)}
                      </span>
                    </button>
                    {canEdit(reminder) && (
                      <button
                        className="icon-button"
                        disabled={busy}
                        aria-label={`${reminder.title} löschen`}
                        onClick={() => void remove(reminder)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </article>
                ))}
              </details>
            )}
          </section>
          {editable.length ? (
            <form className="reminder-form" onSubmit={(event) => void submit(event)}>
              <h2>
                <Plus size={18} /> Wiedervorlage hinzufügen
              </h2>
              <label>
                Immobilie
                <select
                  value={propertyId}
                  onChange={(event) => setPropertyId(event.target.value)}
                  required
                >
                  {editable.map((property) => (
                    <option value={property.id} key={property.id}>
                      {property.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Was möchtest du im Blick behalten?
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  minLength={2}
                  maxLength={120}
                  required
                  placeholder="z. B. Versicherung prüfen"
                />
              </label>
              <label>
                Fällig am
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  required
                />
              </label>
              <label>
                Notiz (optional)
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={1000}
                  rows={3}
                />
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  role="switch"
                  checked={notify}
                  disabled={!emailAvailable}
                  onChange={(event) => setNotify(event.target.checked)}
                />
                Mich per E-Mail erinnern
              </label>
              {notify && (
                <>
                  <ReminderEmailFields days={daysBefore} onDays={setDaysBefore} />
                  <p className="muted">
                    09:00 Uhr ({reminderTimeZone()}) · an deine bestätigte E-Mail-Adresse
                  </p>
                </>
              )}
              <button className="button primary" disabled={busy || !propertyId}>
                <Plus size={16} /> Speichern
              </button>
            </form>
          ) : (
            <aside className="reminder-form">
              <h2>Wiedervorlagen ansehen</h2>
              <p className="muted">
                Für neue Einträge brauchst du eine eigene Immobilie oder Bearbeitungsrechte für ein
                geteiltes Objekt.
              </p>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
