'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Bell, Check, Plus, Trash2 } from 'lucide-react';
import type { ApiClient } from '@estate-atlas/api-client';
import type { PortfolioReminder, Property } from '@estate-atlas/shared';

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
  const reload = useCallback(async () => {
    const result = await api.reminders();
    setReminders(result);
    onCountChange(result.filter((reminder) => !reminder.completedAt).length);
  }, [api, onCountChange]);
  useEffect(() => {
    void reload().catch((e) => setError(e.message));
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
      await api.createReminder(propertyId, { title, dueDate, notes });
      setTitle('');
      setDueDate('');
      setNotes('');
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
  const today = new Date().toISOString().slice(0, 10);
  const open = reminders.filter((reminder) => !reminder.completedAt);
  const completed = reminders.filter((reminder) => reminder.completedAt);
  return (
    <div className="reminders-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DEIN PORTFOLIO</p>
          <h1>Wiedervorlagen</h1>
          <p>Behalte wichtige Termine je Immobilie im Blick.</p>
        </div>
        <Bell size={30} />
      </div>
      {error && (
        <p className="error banner" role="alert">
          {error}
        </p>
      )}
      {!editable.length ? (
        <div className="empty-state">
          <h2>Erst eine Immobilie anlegen</h2>
          <p>Wiedervorlagen werden einer Immobilie zugeordnet.</p>
          <button className="button primary" onClick={onAddProperty}>
            Immobilie hinzufügen
          </button>
        </div>
      ) : (
        <div className="reminders-layout">
          <section className="reminder-list">
            <div className="section-heading">
              <h2>
                Offen <span className="counter">{open.length}</span>
              </h2>
            </div>
            {!open.length && <p className="reminder-empty">Noch keine offenen Wiedervorlagen.</p>}
            {open.map((reminder) => (
              <article
                className={`reminder-row ${reminder.dueDate < today ? 'overdue' : ''}`}
                key={reminder.id}
              >
                <button
                  className="reminder-check"
                  disabled={busy}
                  aria-label={`${reminder.title} erledigt markieren`}
                  onClick={() => void update(reminder, true)}
                >
                  <Check size={17} />
                </button>
                <button className="reminder-copy" onClick={() => onSelect(reminder.propertyId)}>
                  <strong>{reminder.title}</strong>
                  <span>
                    {reminder.propertyTitle} · {localDate(reminder.dueDate)}
                  </span>
                  {reminder.notes && <small>{reminder.notes}</small>}
                </button>
                <button
                  className="icon-button"
                  disabled={busy}
                  aria-label={`${reminder.title} löschen`}
                  onClick={() => void remove(reminder)}
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
            {!!completed.length && (
              <details className="reminder-completed">
                <summary>Erledigt ({completed.length})</summary>
                {completed.map((reminder) => (
                  <article className="reminder-row completed" key={reminder.id}>
                    <button
                      className="reminder-check checked"
                      disabled={busy}
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
                    <button
                      className="icon-button"
                      disabled={busy}
                      aria-label={`${reminder.title} löschen`}
                      onClick={() => void remove(reminder)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))}
              </details>
            )}
          </section>
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
            <button className="button primary" disabled={busy || !propertyId}>
              <Plus size={16} /> Speichern
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
