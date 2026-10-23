import React, { useEffect, useRef, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { ApiError, type ApiClient } from '@estate-atlas/api-client';
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
import { Chips } from './PortfolioTools';
import { Action, Card, ErrorMessage, Input, palette, ui } from './WorkspaceUI';

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
export default function CashflowPanel({
  api,
  properties,
  refreshVersion,
  onSelect,
  onDirty,
  onEditStart,
}: {
  api: ApiClient;
  properties: Property[];
  refreshVersion: number;
  onSelect: (id: string) => void;
  onDirty: (dirty: boolean) => void;
  onEditStart: () => void;
}) {
  const editable = properties.filter((p) => !p.archivedAt && p.access !== 'viewer');
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
  const key = useRef(cashflowRequestKey());
  const alive = useRef(false);
  const dirty = !!(editing || draft.title || draft.amount || draft.notes);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  const propertyRevision = properties.map((p) => `${p.id}:${p.updatedAt}:${p.access}`).join('|');
  const validMonth = /^(?:19|[2-9]\d)\d{2}-(?:0[1-9]|1[0-2])$/.test(month);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!validMonth) {
      setReport(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setReport(null);
    void api
      .cashflow(month, propertyFilter, scope, page, controller.signal)
      .then((value) => {
        if (active) {
          setReport(value);
          if (page !== value.page) setPage(value.page);
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
  }, [api, month, propertyFilter, scope, page, revision, propertyRevision, refreshVersion]);
  useEffect(() => {
    if (!editable.some((p) => p.id === draft.propertyId)) {
      setDraft(draftFor(editable[0]));
      setEditing(null);
      key.current = cashflowRequestKey();
    }
  }, [propertyRevision, draft.propertyId]);
  const change = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    if (busy) return;
    setDraft((previous) => ({ ...previous, [field]: value }));
    setSuccess('');
  };
  const clear = () => {
    setDraft(draftFor(editable.find((p) => p.id === draft.propertyId) ?? editable[0]));
    setEditing(null);
    key.current = cashflowRequestKey();
  };
  const save = async () => {
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
        : await api.createCashflow(draft.propertyId, parsed.data, key.current);
      if (!alive.current) return;
      clear();
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
  const edit = (entry: CashflowEntry) => {
    const apply = () => {
      onEditStart();
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
    };
    if (editing || draft.title || draft.amount || draft.notes)
      Alert.alert(
        'Bisherige Eingaben verwerfen?',
        'Die ausgewählte Buchung wird zum Bearbeiten geladen.',
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Buchung laden', onPress: apply },
        ],
      );
    else apply();
  };
  const remove = (entry: CashflowEntry) =>
    Alert.alert('Buchung löschen?', `„${entry.title}“ wird endgültig gelöscht.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            setError('');
            setSuccess('');
            try {
              await api.deleteCashflow(entry.propertyId, entry.id, entry.version);
              if (alive.current) {
                if (editing?.id === entry.id) clear();
                setRevision((value) => value + 1);
                setSuccess('Buchung gelöscht.');
              }
            } catch (e) {
              if (alive.current) {
                setError((e as Error).message);
                setRevision((value) => value + 1);
              }
            } finally {
              if (alive.current) setBusy(false);
            }
          })();
        },
      },
    ]);
  const pages = report ? Math.max(1, Math.ceil(report.total / report.pageSize)) : 1;
  const editor = (
    <Card title={editing ? 'Buchung bearbeiten' : 'Buchung hinzufügen'}>
      {!editable.length ? (
        <Text style={ui.note}>
          Für neue Buchungen brauchst du eine aktive eigene Immobilie oder Bearbeitungsrechte.
        </Text>
      ) : (
        <>
          {editing ? (
            <Text style={ui.label}>{editing.propertyTitle}</Text>
          ) : (
            <Chips
              label="Immobilie für die Buchung"
              value={draft.propertyId}
              onChange={(value) => {
                const p = editable.find((p) => p.id === value);
                setDraft((previous) => ({
                  ...previous,
                  propertyId: value,
                  currency: p?.currency ?? previous.currency,
                }));
              }}
              values={editable.map((p) => ({ value: p.id, label: p.title }))}
            />
          )}
          <Input
            label="Bezeichnung"
            value={draft.title}
            onChange={(value) => change('title', value)}
            disabled={busy}
          />
          <Input
            label="Datum (JJJJ-MM-TT)"
            value={draft.date}
            onChange={(value) => change('date', value)}
            disabled={busy}
            keyboardType="numbers-and-punctuation"
          />
          <Chips
            label="Kategorie"
            value={draft.category}
            onChange={(value) => change('category', value as CashflowCategory)}
            values={cashflowCategories.map((value) => ({
              value,
              label: cashflowCategoryLabels[value],
            }))}
          />
          <Input
            label="Betrag (ohne Tausendertrennzeichen)"
            value={draft.amount}
            onChange={(value) => change('amount', value)}
            keyboardType="decimal-pad"
            disabled={busy}
          />
          <Chips
            label="Währung"
            value={draft.currency}
            onChange={(value) => change('currency', value as Currency)}
            values={currencies.map((value) => ({ value, label: value }))}
          />
          <Input
            label="Notiz (optional)"
            value={draft.notes}
            onChange={(value) => change('notes', value)}
            multiline
            disabled={busy}
          />
          <Text style={ui.note}>
            Betrag positiv eingeben. Die Kategorie bestimmt Einnahme oder Ausgabe.
          </Text>
          <Action disabled={busy || !draft.propertyId} onPress={() => void save()}>
            {busy ? 'Wird gespeichert …' : editing ? 'Änderung speichern' : 'Buchung speichern'}
          </Action>
          {editing && (
            <Action secondary disabled={busy} onPress={clear}>
              Änderungen verwerfen
            </Action>
          )}
        </>
      )}
    </Card>
  );
  return (
    <View style={{ gap: 16 }}>
      {editing && editor}
      <Card
        title="Einnahmen & Ausgaben"
        note="Monatsübersicht deiner erfassten Buchungen. Währungen werden getrennt ausgewertet."
      >
        <Input
          label="Monat (JJJJ-MM)"
          value={month}
          onChange={(value) => {
            setMonth(value);
            setPage(1);
          }}
          keyboardType="numbers-and-punctuation"
        />
        {!validMonth && <Text style={ui.note}>Bitte den Monat als JJJJ-MM eingeben.</Text>}
        <View style={[ui.row, { flexWrap: 'wrap' }]}>
          <Action
            secondary
            disabled={!validMonth || month === '1900-01'}
            onPress={() => {
              setMonth(shiftCashflowMonth(month, -1));
              setPage(1);
            }}
          >
            Vorheriger Monat
          </Action>
          <Action
            secondary
            disabled={!validMonth || month === '9999-12'}
            onPress={() => {
              setMonth(shiftCashflowMonth(month, 1));
              setPage(1);
            }}
          >
            Nächster Monat
          </Action>
        </View>
        <View style={[ui.row, { flexWrap: 'wrap' }]}>
          <Text style={[ui.label, { flex: 1 }]}>Geteilte Immobilien einbeziehen</Text>
          <Switch
            accessibilityLabel="Geteilte Immobilien einbeziehen"
            value={scope === 'all'}
            onValueChange={(value) => {
              setScope(value ? 'all' : 'owned');
              setPropertyFilter('');
              setPage(1);
            }}
          />
        </View>
        <Chips
          label="Immobilie"
          value={propertyFilter}
          onChange={(value) => {
            setPropertyFilter(value);
            setPage(1);
          }}
          values={[
            { value: '', label: 'Alle Immobilien' },
            ...properties
              .filter((p) => scope === 'all' || !p.access || p.access === 'owner')
              .map((p) => ({ value: p.id, label: `${p.title}${p.archivedAt ? ' · Archiv' : ''}` })),
          ]}
        />
        <Text style={ui.note}>
          Archivierte Immobilien sind für historische Buchungen enthalten.
        </Text>
        <Action
          secondary
          disabled={loading || busy || !validMonth}
          onPress={() => {
            setError('');
            setRevision((value) => value + 1);
          }}
        >
          Aktualisieren
        </Action>
      </Card>
      <ErrorMessage error={error} />
      {!!success && (
        <Text accessibilityRole="alert" style={ui.note}>
          {success}
        </Text>
      )}
      {loading && <Text style={ui.note}>Monatsübersicht wird geladen …</Text>}
      {report && !report.total && (
        <Card
          title="Noch keine Buchungen"
          note="Erfasse eine Einnahme oder Ausgabe für diesen Monat."
        >
          <Text style={ui.note}>Die Übersicht entsteht aus deinen Einträgen.</Text>
        </Card>
      )}
      {report?.totals.map((total) => (
        <Card key={total.currency} title={`Monatssummen · ${total.currency}`}>
          <Text style={ui.label}>Einnahmen</Text>
          <Text style={ui.value}>{formatMoney(total.income, total.currency)}</Text>
          <Text style={ui.label}>Ausgaben</Text>
          <Text style={ui.value}>{formatMoney(total.expenses, total.currency)}</Text>
          <Text style={ui.label}>Überschuss / Fehlbetrag</Text>
          <Text style={[ui.value, { color: total.balance < 0 ? '#9F423C' : palette.accent }]}>
            {formatMoney(total.balance, total.currency)}
          </Text>
        </Card>
      ))}
      {!!report?.byProperty.length && (
        <Card title="Nach Immobilie">
          {report.byProperty.map((row) => (
            <View key={`${row.propertyId}:${row.currency}`} style={{ gap: 7, paddingBottom: 12 }}>
              <Text style={ui.title}>
                {row.propertyTitle} · {row.currency}
              </Text>
              <Text style={ui.note}>
                Einnahmen {formatMoney(row.income, row.currency)} · Ausgaben{' '}
                {formatMoney(row.expenses, row.currency)}
              </Text>
              <Text style={ui.label}>Saldo {formatMoney(row.balance, row.currency)}</Text>
              <Action
                secondary
                onPress={() => {
                  setPropertyFilter(row.propertyId);
                  setPage(1);
                }}
              >
                Buchungen anzeigen
              </Action>
            </View>
          ))}
        </Card>
      )}
      {!editing && editor}
      {report && (
        <Card title={`Buchungen (${report.total})`}>
          {report.entries.map((entry) => (
            <View
              key={entry.id}
              style={{
                gap: 9,
                borderBottomColor: palette.line,
                borderBottomWidth: 1,
                paddingBottom: 15,
              }}
            >
              <Text style={ui.title}>{entry.title}</Text>
              <Text style={ui.note}>
                {entry.propertyTitle} ·{' '}
                {new Date(`${entry.date}T12:00:00`).toLocaleDateString('de-AT')}
              </Text>
              <Text style={ui.note}>{cashflowCategoryLabels[entry.category]}</Text>
              <Text
                style={[
                  ui.value,
                  { color: isCashflowIncome(entry.category) ? palette.accent : '#9F423C' },
                ]}
              >
                {isCashflowIncome(entry.category) ? '+' : '−'}
                {formatMoney(entry.amount, entry.currency)}
              </Text>
              {!!entry.notes && <Text style={ui.note}>{entry.notes}</Text>}
              <Action secondary onPress={() => onSelect(entry.propertyId)}>
                Immobilie öffnen
              </Action>
              {editable.some((p) => p.id === entry.propertyId) ? (
                <View style={[ui.row, { flexWrap: 'wrap' }]}>
                  <Action secondary disabled={busy} onPress={() => edit(entry)}>
                    Bearbeiten
                  </Action>
                  <Action secondary danger disabled={busy} onPress={() => remove(entry)}>
                    Löschen
                  </Action>
                </View>
              ) : (
                <Text style={ui.note}>Nur lesen</Text>
              )}
            </View>
          ))}
          {report.total > report.pageSize && (
            <>
              <Text style={ui.note}>
                Seite {report.page} / {pages}
              </Text>
              <View style={[ui.row, { flexWrap: 'wrap' }]}>
                <Action
                  secondary
                  disabled={page <= 1 || loading}
                  onPress={() => setPage((value) => value - 1)}
                >
                  Zurück
                </Action>
                <Action
                  secondary
                  disabled={page >= pages || loading}
                  onPress={() => setPage((value) => value + 1)}
                >
                  Weiter
                </Action>
              </View>
            </>
          )}
        </Card>
      )}
    </View>
  );
}
