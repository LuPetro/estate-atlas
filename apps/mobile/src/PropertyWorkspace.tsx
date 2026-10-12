import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { ApiError, type ApiClient } from '@estate-atlas/api-client';
import {
  checklistTemplates,
  workspaceSaveSchema,
  purchaseCheckSchema,
  calculatePurchaseCheck,
  currencies,
  formatMoney,
  type Property,
  type PropertyWorkspace as Workspace,
  type Checklist,
  type PurchaseCheckInput,
} from '@estate-atlas/shared';
import { Card, Input, Action, ErrorMessage, ui, palette } from './WorkspaceUI';
import { Chips } from './PortfolioTools';

// These identifiers distinguish draft rows; they never grant access to a resource.
const rowId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
const amountFields = [
  'purchasePrice',
  'transferTaxPercent',
  'notaryPercent',
  'agentPercent',
  'otherCosts',
  'renovationBudget',
  'equity',
] as const;
type AmountField = (typeof amountFields)[number];
type PurchaseDraft = { currency: PurchaseCheckInput['currency'] } & Record<AmountField, string>;
const labels: Record<AmountField, string> = {
  purchasePrice: 'Geplanter Kaufpreis',
  transferTaxPercent: 'Grunderwerbsteuer (%)',
  notaryPercent: 'Notar / Vertrag (%)',
  agentPercent: 'Vermittlung (%)',
  otherCosts: 'Weitere Kaufnebenkosten',
  renovationBudget: 'Renovierungsbudget',
  equity: 'Eigenkapital',
};
const toDraft = (value: PurchaseCheckInput): PurchaseDraft => ({
  currency: value.currency,
  purchasePrice: String(value.purchasePrice),
  transferTaxPercent: String(value.transferTaxPercent),
  notaryPercent: String(value.notaryPercent),
  agentPercent: String(value.agentPercent),
  otherCosts: String(value.otherCosts),
  renovationBudget: String(value.renovationBudget),
  equity: String(value.equity),
});
const toPurchase = (draft: PurchaseDraft) => ({
  currency: draft.currency,
  ...Object.fromEntries(
    amountFields.map((key) => [
      key,
      draft[key].trim() === '' ? Number.NaN : Number(draft[key].replace(',', '.')),
    ]),
  ),
});

export default function PropertyWorkspace({
  property,
  section,
  api,
  onDirtyChange,
}: {
  property: Property;
  section: string;
  api: ApiClient;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [purchase, setPurchase] = useState<PurchaseDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [newItems, setNewItems] = useState<Record<string, string>>({});
  const hasPendingItems = Object.values(newItems).some((value) => value.trim());
  const editable = property.access !== 'viewer';
  const disabled = !editable || busy;
  const adopt = (value: Workspace) => {
    setWorkspace(value);
    setPurchase(value.purchaseCheck ? toDraft(value.purchaseCheck) : null);
    setDirty(false);
    setConflict(false);
    setNewItems({});
  };
  const load = async () => {
    setBusy(true);
    setError('');
    try {
      adopt(await api.propertyWorkspace(property.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let live = true;
    setBusy(true);
    api
      .propertyWorkspace(property.id)
      .then((value) => {
        if (live) adopt(value);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [api, property.id]);
  useEffect(() => {
    onDirtyChange(dirty || hasPendingItems);
  }, [dirty, hasPendingItems, onDirtyChange]);
  const changed = () => {
    setDirty(true);
    setSaved(false);
  };
  const editList = (id: string, change: Partial<Checklist>) => {
    if (!workspace || disabled) return;
    setWorkspace({
      ...workspace,
      checklists: workspace.checklists.map((list) =>
        list.id === id ? { ...list, ...change } : list,
      ),
    });
    changed();
  };
  const save = async () => {
    if (!workspace) return;
    if (hasPendingItems) {
      setError('Bitte den neuen Punkt erst zur Checkliste hinzufügen oder das Eingabefeld leeren.');
      return;
    }
    const input = workspaceSaveSchema.safeParse({
      expectedVersion: workspace.version,
      checklists: workspace.checklists,
      purchaseCheck: purchase ? toPurchase(purchase) : null,
    });
    if (!input.success) {
      setError(`Bitte die Angaben prüfen: ${input.error.issues[0]?.message ?? 'Ungültige Werte'}`);
      return;
    }
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      adopt(await api.savePropertyWorkspace(property.id, input.data));
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 409) setConflict(true);
    } finally {
      setBusy(false);
    }
  };
  const addChecklist = (templateId?: string) => {
    if (!workspace || disabled || workspace.checklists.length >= 12) return;
    const template = checklistTemplates.find((item) => item.id === templateId);
    setWorkspace({
      ...workspace,
      checklists: [
        ...workspace.checklists,
        {
          id: rowId(),
          title: template?.title ?? 'Eigene Checkliste',
          date: null,
          notes: '',
          items: (template?.items ?? []).map((label) => ({
            id: rowId(),
            label,
            done: false,
            note: '',
          })),
        },
      ],
    });
    changed();
  };
  const parsedPurchase = purchase ? purchaseCheckSchema.safeParse(toPurchase(purchase)) : null;
  const calculation = parsedPurchase?.success ? calculatePurchaseCheck(parsedPurchase.data) : null;
  return (
    <View
      style={{
        display: section === 'checklists' || section === 'purchase' ? 'flex' : 'none',
        gap: 16,
      }}
    >
      <ErrorMessage error={error} />
      {!workspace && (
        <Card>
          <Text style={ui.note}>
            {busy ? 'Arbeitsbereich wird geladen …' : 'Arbeitsbereich konnte nicht geladen werden.'}
          </Text>
          {!busy && (
            <Action secondary onPress={load}>
              Erneut laden
            </Action>
          )}
        </Card>
      )}
      {workspace && section === 'checklists' && (
        <>
          <Card
            title="Übergabe & Checklisten"
            note="Vorbereiten, abhaken und Beobachtungen festhalten. Speichere Fotos und unterschriebene Protokolle bei den Dokumenten."
          >
            <Text style={ui.note}>
              {workspace.checklists.length} von 12 Checklisten ·{' '}
              {editable ? 'Änderungen anschließend speichern.' : 'Du hast Lesezugriff.'}
            </Text>
            {editable && (
              <>
                <View style={{ gap: 8 }}>
                  {checklistTemplates.map((template) => (
                    <Action
                      key={template.id}
                      secondary
                      disabled={disabled || workspace.checklists.length >= 12}
                      onPress={() => addChecklist(template.id)}
                    >
                      + {template.title}
                    </Action>
                  ))}
                </View>
                <Action
                  secondary
                  disabled={disabled || workspace.checklists.length >= 12}
                  onPress={() => addChecklist()}
                >
                  + Eigene Checkliste
                </Action>
              </>
            )}
          </Card>
          {!workspace.checklists.length && (
            <Text style={ui.note}>Noch keine Checkliste angelegt.</Text>
          )}
          {workspace.checklists.map((list) => (
            <Card key={list.id}>
              <Input
                label="Titel der Checkliste"
                value={list.title}
                onChange={(title) => editList(list.id, { title })}
                disabled={disabled}
              />
              <Text style={ui.note}>
                {list.items.filter((item) => item.done).length} von {list.items.length} Punkten
                erledigt
              </Text>
              <View style={{ height: 5, backgroundColor: '#EDF1EF', borderRadius: 3 }}>
                <View
                  style={{
                    height: 5,
                    width: `${list.items.length ? (list.items.filter((item) => item.done).length / list.items.length) * 100 : 0}%`,
                    backgroundColor: palette.accent,
                    borderRadius: 3,
                  }}
                />
              </View>
              <Input
                label="Termin (JJJJ-MM-TT, optional)"
                value={list.date ?? ''}
                onChange={(date) => editList(list.id, { date: date || null })}
                disabled={disabled}
              />
              {list.items.map((item) => (
                <View
                  key={item.id}
                  style={{
                    gap: 10,
                    borderTopWidth: 1,
                    borderTopColor: palette.line,
                    paddingTop: 14,
                  }}
                >
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.done, disabled }}
                    disabled={disabled}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}
                    onPress={() =>
                      editList(list.id, {
                        items: list.items.map((row) =>
                          row.id === item.id ? { ...row, done: !row.done } : row,
                        ),
                      })
                    }
                  >
                    <View
                      style={{
                        borderWidth: 1,
                        borderColor: item.done ? palette.accent : '#ADB9B7',
                        borderRadius: 5,
                        width: 23,
                        height: 23,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: item.done ? palette.accent : '#fff',
                      }}
                    >
                      <Text style={{ color: '#fff' }}>{item.done ? '✓' : ''}</Text>
                    </View>
                    <Text
                      style={[
                        ui.label,
                        { flex: 1, color: item.done ? palette.muted : palette.ink },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                  {!!item.note && !expandedItems[item.id] && (
                    <Text style={ui.note}>{item.note}</Text>
                  )}
                  {editable && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: !!expandedItems[item.id] }}
                      onPress={() =>
                        setExpandedItems({ ...expandedItems, [item.id]: !expandedItems[item.id] })
                      }
                      style={{ minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' }}
                    >
                      <Text style={{ color: palette.accent, fontSize: 12 }}>
                        {expandedItems[item.id] ? 'Details schließen' : 'Notiz & Bearbeiten'}
                      </Text>
                    </Pressable>
                  )}
                  {editable && expandedItems[item.id] && (
                    <Input
                      label="Punkt bearbeiten"
                      value={item.label}
                      disabled={disabled}
                      onChange={(label) =>
                        editList(list.id, {
                          items: list.items.map((row) =>
                            row.id === item.id ? { ...row, label } : row,
                          ),
                        })
                      }
                    />
                  )}
                  {editable && expandedItems[item.id] && (
                    <Input
                      label={`Notiz: ${item.label}`}
                      value={item.note}
                      disabled={disabled}
                      multiline
                      onChange={(note) =>
                        editList(list.id, {
                          items: list.items.map((row) =>
                            row.id === item.id ? { ...row, note } : row,
                          ),
                        })
                      }
                    />
                  )}
                  {editable && expandedItems[item.id] && (
                    <Action
                      secondary
                      disabled={disabled}
                      onPress={() =>
                        editList(list.id, { items: list.items.filter((row) => row.id !== item.id) })
                      }
                    >
                      Punkt entfernen
                    </Action>
                  )}
                </View>
              ))}
              {editable && (
                <>
                  <Input
                    label="Neuer Checklistenpunkt"
                    value={newItems[list.id] ?? ''}
                    disabled={disabled}
                    onChange={(value) => {
                      setNewItems({ ...newItems, [list.id]: value });
                      setSaved(false);
                    }}
                  />
                  <Action
                    secondary
                    disabled={
                      disabled || !(newItems[list.id] ?? '').trim() || list.items.length >= 80
                    }
                    onPress={() => {
                      editList(list.id, {
                        items: [
                          ...list.items,
                          { id: rowId(), label: newItems[list.id].trim(), done: false, note: '' },
                        ],
                      });
                      setNewItems({ ...newItems, [list.id]: '' });
                    }}
                  >
                    Punkt hinzufügen
                  </Action>
                </>
              )}
              <Input
                label="Allgemeine Notizen"
                value={list.notes}
                disabled={disabled}
                multiline
                onChange={(notes) => editList(list.id, { notes })}
              />
              {editable && (
                <Action
                  secondary
                  danger
                  disabled={disabled}
                  onPress={() =>
                    Alert.alert('Checkliste entfernen?', list.title, [
                      { text: 'Behalten', style: 'cancel' },
                      {
                        text: 'Entfernen',
                        style: 'destructive',
                        onPress: () => {
                          setWorkspace({
                            ...workspace,
                            checklists: workspace.checklists.filter((row) => row.id !== list.id),
                          });
                          setNewItems((previous) => ({ ...previous, [list.id]: '' }));
                          changed();
                        },
                      },
                    ])
                  }
                >
                  Checkliste entfernen
                </Action>
              )}
            </Card>
          ))}
        </>
      )}
      {workspace && section === 'purchase' && (
        <>
          <Card
            title="Kaufcheck"
            note="Plane deinen gesamten Kapitalbedarf mit eigenen Annahmen. Die Rechnung verändert weder Kaufpreis noch Marktwert der Immobilie."
          >
            {!purchase ? (
              <>
                <Text style={ui.note}>
                  Noch keine Kaufplanung gespeichert. Prozentsätze und Kosten bestimmst du selbst.
                </Text>
                {editable && (
                  <Action
                    disabled={disabled}
                    onPress={() => {
                      setPurchase(
                        toDraft({
                          currency: property.currency,
                          purchasePrice: property.purchasePrice,
                          transferTaxPercent: 0,
                          notaryPercent: 0,
                          agentPercent: 0,
                          otherCosts: 0,
                          renovationBudget: 0,
                          equity: 0,
                        }),
                      );
                      changed();
                    }}
                  >
                    Kaufcheck anlegen
                  </Action>
                )}
              </>
            ) : (
              <>
                <Text style={ui.note}>
                  Alle Beträge in {purchase.currency}. Startwerte von 0 bedeuten „noch nicht
                  eingeplant“; trage die für deinen Kauf passenden Kosten ein.
                </Text>
                {editable ? (
                  <Chips
                    label="Währung der Planung"
                    value={purchase.currency}
                    onChange={(value) => {
                      if (!disabled) {
                        setPurchase({
                          ...purchase,
                          currency: value as PurchaseCheckInput['currency'],
                        });
                        changed();
                      }
                    }}
                    values={currencies.map((value) => ({ value, label: value }))}
                  />
                ) : (
                  <Text style={ui.label}>Währung: {purchase.currency}</Text>
                )}
                <Text style={ui.note}>
                  Ein Wechsel der Währung rechnet eingegebene Beträge nicht um.
                </Text>
                {amountFields.map((key) => (
                  <Input
                    key={key}
                    label={labels[key]}
                    value={purchase[key]}
                    disabled={disabled}
                    keyboardType="decimal-pad"
                    onChange={(value) => {
                      setPurchase({ ...purchase, [key]: value });
                      changed();
                    }}
                  />
                ))}
              </>
            )}
          </Card>
          {purchase && calculation && (
            <Card title="Dein Kapitalbedarf">
              <Text style={ui.value}>
                {formatMoney(calculation.totalInvestment, purchase.currency)}
              </Text>
              {(
                [
                  ['Grunderwerbsteuer', calculation.transferTax],
                  ['Notar / Vertrag', calculation.notaryCosts],
                  ['Vermittlung', calculation.agentCosts],
                  ['Nebenkosten gesamt', calculation.additionalCosts],
                  ['Benötigte Finanzierung', calculation.fundingGap],
                  ...(calculation.equitySurplus
                    ? [['Verbleibendes Eigenkapital', calculation.equitySurplus]]
                    : []),
                ] as [string, number][]
              ).map(([label, value]) => (
                <View key={label} style={ui.row}>
                  <Text style={[ui.note, { flex: 1 }]}>{label}</Text>
                  <Text style={ui.label}>{formatMoney(value, purchase.currency)}</Text>
                </View>
              ))}
              <Text style={ui.note}>Eigene Planung ohne Zinsen, Tilgung und laufende Kosten.</Text>
            </Card>
          )}
          {purchase && parsedPurchase && !parsedPurchase.success && (
            <Text style={ui.note}>
              Für die Berechnung bitte gültige Beträge und Prozentsätze eingeben.
            </Text>
          )}
          {purchase && editable && (
            <Action
              secondary
              danger
              disabled={disabled}
              onPress={() =>
                Alert.alert(
                  'Kaufcheck entfernen?',
                  'Nach dem Speichern wird diese Planung entfernt.',
                  [
                    { text: 'Behalten', style: 'cancel' },
                    {
                      text: 'Entfernen',
                      style: 'destructive',
                      onPress: () => {
                        setPurchase(null);
                        changed();
                      },
                    },
                  ],
                )
              }
            >
              Kaufplanung entfernen
            </Action>
          )}
        </>
      )}
      {workspace && editable && (
        <Card>
          <Text style={ui.note}>
            {dirty || hasPendingItems
              ? 'Ungespeicherte Änderungen'
              : saved
                ? 'Änderungen gespeichert.'
                : 'Alle Änderungen gespeichert.'}
          </Text>
          <Action disabled={busy || !dirty || hasPendingItems || conflict} onPress={save}>
            {busy ? 'Wird gespeichert …' : 'Arbeitsbereich speichern'}
          </Action>
          {hasPendingItems ? (
            <Text style={ui.note}>
              Bitte neue Checklistenpunkte unter „Übergabe“ hinzufügen oder deren Eingabefelder
              leeren. Danach kannst du den Arbeitsbereich speichern.
            </Text>
          ) : (
            <Text style={ui.note}>Speichert Checklisten und Kaufcheck gemeinsam.</Text>
          )}
          {conflict && (
            <>
              <Text style={ui.note}>
                Eine andere Person hat diesen Arbeitsbereich geändert. Deine Eingaben bleiben
                sichtbar. Notiere sie bei Bedarf, bevor du den aktuellen Stand lädst.
              </Text>
              <Action
                secondary
                disabled={busy}
                onPress={() =>
                  Alert.alert(
                    'Aktuellen Stand laden?',
                    'Deine ungespeicherten Eingaben werden verworfen.',
                    [
                      { text: 'Abbrechen', style: 'cancel' },
                      { text: 'Neu laden', style: 'destructive', onPress: load },
                    ],
                  )
                }
              >
                Aktuellen Stand laden
              </Action>
            </>
          )}
        </Card>
      )}
    </View>
  );
}
