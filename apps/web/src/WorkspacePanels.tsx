'use client';
import { useEffect, useState } from 'react';
import { ApiError, type ApiClient } from '@estate-atlas/api-client';
import {
  checklistTemplates,
  workspaceContentSchema,
  purchaseCheckSchema,
  calculatePurchaseCheck,
  formatMoney,
  type Checklist,
  type Property,
  type PropertyWorkspace,
  type PurchaseCheckInput,
  type PropertyShares,
} from '@estate-atlas/shared';
import {
  Check,
  Plus,
  Trash2,
  ClipboardCheck,
  Calculator,
  Copy,
  Users,
  Save,
  RotateCcw,
} from 'lucide-react';
export type WorkspaceTab =
  | 'overview'
  | 'values'
  | 'documents'
  | 'handover'
  | 'purchase'
  | 'sharing';
export function WorkspacePanels({
  property,
  api,
  tab,
  onDirtyChange,
}: {
  property: Property;
  api: ApiClient;
  tab: WorkspaceTab;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [saved, setSaved] = useState<PropertyWorkspace | null>(null);
  const [draft, setDraft] = useState<PropertyWorkspace | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [accessLost, setAccessLost] = useState(false);
  const canEdit = property.access !== 'viewer' && !accessLost;
  const dirty = Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved));
  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const value = await api.propertyWorkspace(property.id);
      setSaved(value);
      setDraft(value);
      setConflict(false);
      setAccessLost(false);
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && [403, 404].includes(e.status)) setAccessLost(true);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, [property.id]);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  const save = async () => {
    if (!draft || !canEdit) return;
    const checked = workspaceContentSchema.safeParse({
      checklists: draft.checklists,
      purchaseCheck: draft.purchaseCheck,
    });
    if (!checked.success) {
      setError(checked.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api.savePropertyWorkspace(property.id, {
        expectedVersion: draft.version,
        ...checked.data,
      });
      setSaved(result);
      setDraft(result);
      setConflict(false);
      setNotice('Änderungen gespeichert.');
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 409) setConflict(true);
      if (e instanceof ApiError && [403, 404].includes(e.status)) setAccessLost(true);
    } finally {
      setBusy(false);
    }
  };
  const updateList = (id: string, update: Partial<Checklist>) =>
    setDraft(
      (current) =>
        current && {
          ...current,
          checklists: current.checklists.map((list) =>
            list.id === id ? { ...list, ...update } : list,
          ),
        },
    );
  const addList = (template: (typeof checklistTemplates)[number] | null) => {
    if (!draft) return;
    setNotice('');
    setDraft({
      ...draft,
      checklists: [
        ...draft.checklists,
        {
          id: crypto.randomUUID(),
          title: template?.title ?? 'Neue Checkliste',
          date: null,
          notes: '',
          items: (template?.items ?? []).map((label) => ({
            id: crypto.randomUUID(),
            label,
            done: false,
            note: '',
          })),
        },
      ],
    });
  };
  const startPurchase = () => {
    if (draft)
      setDraft({
        ...draft,
        purchaseCheck: {
          currency: property.currency,
          purchasePrice: property.purchasePrice,
          transferTaxPercent: 0,
          notaryPercent: 0,
          agentPercent: 0,
          otherCosts: 0,
          renovationBudget: 0,
          equity: 0,
        },
      });
  };
  const checkedPurchase = purchaseCheckSchema.safeParse(draft?.purchaseCheck);
  const calculation = checkedPurchase.success ? calculatePurchaseCheck(checkedPurchase.data) : null;
  const active = tab === 'handover' || tab === 'purchase';
  const purchaseFields: {
    key: Exclude<keyof PurchaseCheckInput, 'currency'>;
    label: string;
    percent?: boolean;
  }[] = [
    { key: 'purchasePrice', label: 'Angenommener Kaufpreis' },
    { key: 'transferTaxPercent', label: 'Grunderwerbsteuer', percent: true },
    { key: 'notaryPercent', label: 'Notar & Grundbuch', percent: true },
    { key: 'agentPercent', label: 'Vermittlung', percent: true },
    { key: 'otherCosts', label: 'Weitere Kaufnebenkosten' },
    { key: 'renovationBudget', label: 'Renovierungsbudget' },
    { key: 'equity', label: 'Verfügbares Eigenkapital' },
  ];
  return (
    <>
      {error && (
        <div role="alert" className="error workspace-feedback">
          {error}
          {conflict && (
            <p>
              Dein Entwurf bleibt erhalten. Prüfe ihn vor dem Neuladen; dabei werden lokale
              Änderungen verworfen.
            </p>
          )}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              if (
                !dirty ||
                window.confirm('Lokale Änderungen verwerfen und aktuellen Stand laden?')
              )
                void load();
            }}
          >
            <RotateCcw size={14} /> Aktuellen Stand laden
          </button>
        </div>
      )}
      {(active || dirty) && (
        <div className="workspace-savebar">
          <span role="status">
            {!draft
              ? busy
                ? 'Objektdaten werden geladen …'
                : 'Objektdaten nicht verfügbar'
              : dirty
                ? 'Ungespeicherte Änderungen an Übergabe oder Kaufcheck'
                : notice ||
                  (canEdit
                    ? 'Alle Änderungen gespeichert'
                    : 'Leserechte · Änderungen sind nicht möglich')}
          </span>
          {canEdit && (
            <button
              className="button primary"
              disabled={!dirty || busy || conflict}
              onClick={() => void save()}
            >
              <Save size={15} />
              {busy ? 'Wird gespeichert …' : 'Änderungen speichern'}
            </button>
          )}
        </div>
      )}
      <section
        id="workspace-content-handover"
        role="tabpanel"
        aria-labelledby="workspace-tab-handover"
        hidden={tab !== 'handover'}
        aria-label="Objekt-Checklisten"
        className="workspace-panel"
      >
        <div className="workspace-panel-heading">
          <div>
            <p className="eyebrow">VORBEREITEN & FESTHALTEN</p>
            <h3>Übergabe & Checklisten</h3>
            <p>Schlüssel, Zählerstände und Zustand — Schritt für Schritt dokumentieren.</p>
          </div>
          <ClipboardCheck size={24} />
        </div>
        {canEdit && draft && (
          <div className="template-actions">
            {checklistTemplates.map((template) => (
              <button
                key={template.id}
                className="button secondary"
                disabled={busy || draft.checklists.length >= 12}
                onClick={() => addList(template)}
              >
                <Plus size={15} />
                {template.id === 'handover' ? 'Übergabe vorbereiten' : 'Besichtigung vorbereiten'}
              </button>
            ))}
            <button
              className="text-button"
              disabled={busy || draft.checklists.length >= 12}
              onClick={() => addList(null)}
            >
              Eigene Checkliste
            </button>
          </div>
        )}
        {draft && !draft.checklists.length && (
          <div className="workspace-empty">
            <ClipboardCheck size={30} />
            <h3>Gut vorbereitet zum nächsten Termin</h3>
            <p>
              {canEdit
                ? 'Starte mit einer Vorlage oder erstelle eine eigene Liste.'
                : 'Für diese Immobilie sind noch keine Checklisten hinterlegt.'}
            </p>
          </div>
        )}
        {draft?.checklists.map((list) => (
          <article className="checklist-card" key={list.id}>
            <div className="checklist-heading">
              <label>
                Titel der Checkliste
                <input
                  aria-label="Titel der Checkliste"
                  value={list.title}
                  maxLength={120}
                  disabled={!canEdit || busy}
                  onChange={(e) => updateList(list.id, { title: e.target.value })}
                />
              </label>
              <label>
                Termin
                <input
                  type="date"
                  aria-label="Checklisten-Termin"
                  value={list.date ?? ''}
                  disabled={!canEdit || busy}
                  onChange={(e) => updateList(list.id, { date: e.target.value || null })}
                />
              </label>
              {canEdit && (
                <button
                  className="icon-button"
                  aria-label={`${list.title} löschen`}
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Diese Checkliste entfernen? Die Änderung wird beim Speichern übernommen.',
                      )
                    )
                      setDraft({
                        ...draft,
                        checklists: draft.checklists.filter((l) => l.id !== list.id),
                      });
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <div className="checklist-progress">
              <div
                style={{
                  width: `${list.items.length ? (list.items.filter((i) => i.done).length / list.items.length) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="muted">
              {list.items.filter((i) => i.done).length} von {list.items.length} erledigt
            </p>
            <div className="checklist-items">
              {list.items.map((item, index) => (
                <div className={`checklist-item ${item.done ? 'done' : ''}`} key={item.id}>
                  <input
                    type="checkbox"
                    aria-label={item.label || `Punkt ${index + 1} erledigt`}
                    checked={item.done}
                    disabled={!canEdit || busy}
                    onChange={(e) =>
                      updateList(list.id, {
                        items: list.items.map((i) =>
                          i.id === item.id ? { ...i, done: e.target.checked } : i,
                        ),
                      })
                    }
                  />
                  <div>
                    <input
                      aria-label={`Checklistenpunkt ${index + 1}`}
                      value={item.label}
                      maxLength={200}
                      disabled={!canEdit || busy}
                      placeholder="Was ist zu prüfen?"
                      onChange={(e) =>
                        updateList(list.id, {
                          items: list.items.map((i) =>
                            i.id === item.id ? { ...i, label: e.target.value } : i,
                          ),
                        })
                      }
                    />
                    <input
                      aria-label={`Notiz zu ${item.label || `Punkt ${index + 1}`}`}
                      value={item.note}
                      maxLength={1000}
                      disabled={!canEdit || busy}
                      placeholder="Notiz, Zählerstand oder Schlüsselanzahl …"
                      onChange={(e) =>
                        updateList(list.id, {
                          items: list.items.map((i) =>
                            i.id === item.id ? { ...i, note: e.target.value } : i,
                          ),
                        })
                      }
                    />
                  </div>
                  {canEdit && (
                    <button
                      className="icon-button"
                      aria-label={`Checklistenpunkt ${index + 1} entfernen`}
                      disabled={busy}
                      onClick={() =>
                        updateList(list.id, { items: list.items.filter((i) => i.id !== item.id) })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <button
                className="text-button"
                disabled={busy || list.items.length >= 80}
                onClick={() =>
                  updateList(list.id, {
                    items: [
                      ...list.items,
                      { id: crypto.randomUUID(), label: 'Neuer Punkt', done: false, note: '' },
                    ],
                  })
                }
              >
                <Plus size={15} />
                Punkt hinzufügen
              </button>
            )}
            <label className="checklist-notes">
              Weitere Notizen
              <textarea
                aria-label={`Notizen zu ${list.title}`}
                value={list.notes}
                maxLength={3000}
                rows={3}
                disabled={!canEdit || busy}
                placeholder="Beteiligte, offene Fragen und vereinbarte nächste Schritte …"
                onChange={(e) => updateList(list.id, { notes: e.target.value })}
              />
            </label>
          </article>
        ))}
        {draft && (
          <p className="muted">
            Die Checkliste hält deine Angaben fest. Fotos und unterschriebene Protokolle kannst du
            optional unter Dokumente speichern.
          </p>
        )}
      </section>
      <section
        id="workspace-content-purchase"
        role="tabpanel"
        aria-labelledby="workspace-tab-purchase"
        hidden={tab !== 'purchase'}
        aria-label="Kaufcheck"
        className="workspace-panel"
      >
        <div className="workspace-panel-heading">
          <div>
            <p className="eyebrow">DEIN KAUFSZENARIO</p>
            <h3>Was kostet die Immobilie insgesamt?</h3>
            <p>Plane Kaufpreis, Nebenkosten, Renovierung und Eigenkapital gemeinsam.</p>
          </div>
          <Calculator size={24} />
        </div>
        {draft && !draft.purchaseCheck && (
          <div className="workspace-empty">
            <Calculator size={30} />
            <h3>Den Kauf durchrechnen</h3>
            <p>
              Dein Szenario wird separat gespeichert. Der Kaufpreis der Immobilie bleibt erhalten.
            </p>
            {canEdit && (
              <button className="button primary" onClick={startPurchase}>
                Kaufcheck erstellen
              </button>
            )}
          </div>
        )}
        {draft?.purchaseCheck && (
          <>
            <p className="workspace-hint">
              Alle Beträge in <strong>{draft.purchaseCheck.currency}</strong>. Prozentwerte sind
              deine Annahmen; die vorbelegten 0 % sind keine länderspezifischen Steuersätze.
            </p>
            {draft.purchaseCheck.currency !== property.currency && (
              <p className="workspace-hint">
                Die Immobilienwährung wurde geändert. Dieses Szenario bleibt in{' '}
                {draft.purchaseCheck.currency}; für die neue Währung bitte einen neuen Kaufcheck
                erstellen.
              </p>
            )}
            <div className="purchase-layout">
              <div className="purchase-fields">
                {purchaseFields.map((field) => (
                  <label key={field.key}>
                    {field.label}
                    <span className="input-suffix">
                      <input
                        type="number"
                        aria-label={field.label}
                        min="0"
                        max={field.percent ? 100 : 1e12}
                        step={
                          field.percent
                            ? '0.01'
                            : draft.purchaseCheck!.currency === 'JPY'
                              ? '1'
                              : '0.01'
                        }
                        value={
                          Number.isNaN(draft.purchaseCheck![field.key])
                            ? ''
                            : draft.purchaseCheck![field.key]
                        }
                        disabled={!canEdit || busy}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            purchaseCheck: {
                              ...draft.purchaseCheck!,
                              [field.key]: e.target.value === '' ? NaN : Number(e.target.value),
                            },
                          })
                        }
                      />
                      <span>{field.percent ? '%' : draft.purchaseCheck!.currency}</span>
                    </span>
                  </label>
                ))}
              </div>
              <aside className="purchase-result" aria-label="Kaufcheck-Ergebnis">
                <span>Gesamter Kapitalbedarf</span>
                <strong>
                  {calculation
                    ? formatMoney(calculation.totalInvestment, draft.purchaseCheck.currency)
                    : '—'}
                </strong>
                {calculation ? (
                  <>
                    <dl>
                      <dt>Kaufpreis</dt>
                      <dd>
                        {formatMoney(
                          draft.purchaseCheck.purchasePrice,
                          draft.purchaseCheck.currency,
                        )}
                      </dd>
                      <dt>Grunderwerbsteuer</dt>
                      <dd>{formatMoney(calculation.transferTax, draft.purchaseCheck.currency)}</dd>
                      <dt>Notar & Grundbuch</dt>
                      <dd>{formatMoney(calculation.notaryCosts, draft.purchaseCheck.currency)}</dd>
                      <dt>Vermittlung</dt>
                      <dd>{formatMoney(calculation.agentCosts, draft.purchaseCheck.currency)}</dd>
                      <dt>Weitere Kosten</dt>
                      <dd>
                        {formatMoney(draft.purchaseCheck.otherCosts, draft.purchaseCheck.currency)}
                      </dd>
                      <dt>Renovierung</dt>
                      <dd>
                        {formatMoney(
                          draft.purchaseCheck.renovationBudget,
                          draft.purchaseCheck.currency,
                        )}
                      </dd>
                    </dl>
                    <div className="purchase-gap">
                      <span>Noch zu finanzieren</span>
                      <strong>
                        {formatMoney(calculation.fundingGap, draft.purchaseCheck.currency)}
                      </strong>
                    </div>
                    {calculation.equitySurplus > 0 && (
                      <p>
                        Verbleibendes Eigenkapital:{' '}
                        {formatMoney(calculation.equitySurplus, draft.purchaseCheck.currency)}
                      </p>
                    )}
                    <p>
                      Finanzierungsbedarf vor Zinsen und laufenden Kosten. Keine
                      Finanzierungszusage.
                    </p>
                  </>
                ) : (
                  <p role="status">Bitte gültige, vollständige Beträge eingeben.</p>
                )}
              </aside>
            </div>
            {canEdit && (
              <button
                className="text-button danger-text"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      'Kaufcheck entfernen? Die Änderung wird beim Speichern übernommen.',
                    )
                  )
                    setDraft({ ...draft, purchaseCheck: null });
                }}
              >
                Kaufcheck entfernen
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}

export function SharingPanel({
  property,
  api,
  onError,
}: {
  property: Property;
  api: ApiClient;
  onError?: (message: string) => void;
}) {
  const [data, setData] = useState<PropertyShares | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [invite, setInvite] = useState<{ id: string; code: string; expiresAt: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (error) onError?.(error);
  }, [error, onError]);
  const owner = !property.access || property.access === 'owner';
  const load = async () => {
    setData(await api.shares(property.id));
  };
  useEffect(() => {
    if (owner) void load().catch((e) => setError(e.message));
  }, [property.id, owner]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    if (error) onError?.('');
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="workspace-panel" aria-label="Zusammenarbeit">
      <div className="workspace-panel-heading">
        <div>
          <p className="eyebrow">GEMEINSAM VERWALTEN</p>
          <h3>Die richtigen Menschen. Der passende Zugriff.</h3>
          <p>Du bestimmst, wer diese Immobilie sehen und bearbeiten kann.</p>
        </div>
        <Users size={24} />
      </div>
      {!owner ? (
        <div className="workspace-hint">
          Du hast {property.access === 'editor' ? 'Bearbeitungsrechte' : 'Leserechte'} für diese
          Immobilie. Freigaben verwaltet der Eigentümer.
        </div>
      ) : (
        <>
          <div className="share-create">
            <label>
              Zugriff für die Einladung
              <select
                aria-label="Einladungsrolle"
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
              >
                <option value="viewer">Ansehen</option>
                <option value="editor">Bearbeiten</option>
              </select>
            </label>
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const created = await api.createInvitation(property.id, role);
                  setInvite(created);
                  setCopied(false);
                })
              }
            >
              <Plus size={15} />
              Einladung erstellen
            </button>
          </div>
          <p className="muted">
            Der Code gilt 7 Tage und kann einmal von einem angemeldeten Konto angenommen werden.
            Teile ihn persönlich mit der gewünschten Person. Einladungen werden nicht automatisch
            per E-Mail verschickt.
          </p>
          <p className="workspace-hint">
            Die Freigabe umfasst Objektangaben, Wertverlauf, Dokumente, Checklisten und Kaufcheck.
            Bearbeitende können diese Angaben und Dateien ändern. Löschen, Archivieren, Freigaben
            und kostenpflichtige Recherche bleiben beim Eigentümer.
          </p>
          {invite && (
            <div className="invite-code">
              <label>
                Einladungscode
                <input
                  aria-label="Einladungscode"
                  readOnly
                  value={invite.code}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <button
                className="button secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(invite.code);
                    setCopied(true);
                  } catch {
                    setError(
                      'Kopieren ist hier nicht verfügbar. Markiere den Code und kopiere ihn manuell.',
                    );
                  }
                }}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}{' '}
                {copied ? 'Kopiert' : 'Code kopieren'}
              </button>
              <small>
                Gültig bis {new Date(invite.expiresAt).toLocaleDateString('de-AT')}. Der
                vollständige Code wird nur jetzt angezeigt.
              </small>
            </div>
          )}
          <h4>Personen mit Zugriff</h4>
          {data?.members.length ? (
            data.members.map((member) => (
              <div className="member-row" key={member.userId}>
                <span className="avatar">{member.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{member.name}</strong>
                  <small>
                    {member.email} · {member.role === 'editor' ? 'Bearbeiten' : 'Ansehen'}
                  </small>
                </div>
                <button
                  className="text-button danger-text"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Zugriff für ${member.name} entfernen?`))
                      void run(() => api.revokeShare(property.id, member.userId));
                  }}
                >
                  Zugriff entfernen
                </button>
              </div>
            ))
          ) : (
            <p className="muted">
              {data
                ? 'Bisher hat nur dein Konto Zugriff.'
                : error
                  ? 'Freigaben konnten nicht geladen werden.'
                  : 'Freigaben werden geladen …'}
            </p>
          )}
          {!!data?.invitations.length && (
            <>
              <h4>Offene Einladungen</h4>
              {data.invitations.map((item) => (
                <div className="member-row" key={item.id}>
                  <div>
                    <strong>{item.role === 'editor' ? 'Bearbeiten' : 'Ansehen'}</strong>
                    <small>Gültig bis {new Date(item.expiresAt).toLocaleDateString('de-AT')}</small>
                  </div>
                  <button
                    className="text-button danger-text"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api.revokeInvitation(property.id, item.id);
                        if (invite?.id === item.id) setInvite(null);
                      })
                    }
                  >
                    Einladung widerrufen
                  </button>
                </div>
              ))}
            </>
          )}
        </>
      )}
      {owner && error && (
        <button className="text-button" disabled={busy} onClick={() => void run(async () => {})}>
          <RotateCcw size={14} />
          Freigaben erneut laden
        </button>
      )}
      {error && !onError && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
export function AcceptInvitation({
  api,
  onAccepted,
}: {
  api: ApiClient;
  onAccepted: () => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  return (
    <form
      className="accept-invitation panel"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        setSuccess('');
        try {
          const p = await api.acceptInvitation(code.trim());
          setCode('');
          await onAccepted();
          setSuccess(`Du hast jetzt Zugriff auf „${p.title}“.`);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <Users size={21} />
        <h2>Zu einer Immobilie eingeladen?</h2>
        <p>Gib den Code ein, den der Eigentümer mit dir geteilt hat.</p>
      </div>
      <label>
        Einladungscode
        <input
          aria-label="Einladung annehmen: Code"
          value={code}
          maxLength={100}
          required
          autoComplete="off"
          placeholder="Code einfügen"
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      <button className="button primary" disabled={busy || !code.trim()}>
        {busy ? 'Wird angenommen …' : 'Einladung annehmen'}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="success-message">
          {success}
        </p>
      )}
    </form>
  );
}
