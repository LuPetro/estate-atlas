import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  filterProperties,
  dashboardWidgets,
  dashboardWidgetLabels,
  dashboardPreferencesSchema,
  type Property,
} from '@estate-atlas/shared';
export const emptyFilters = { query: '', country: '', type: '', currency: '', rental: '' };
export type Filters = typeof emptyFilters;
export function Chips({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.field}>
      <Text style={s.note}>{label}</Text>
      <ScrollView horizontal contentContainerStyle={s.chips}>
        {values.map((v) => (
          <Pressable
            key={v.value}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${v.label}`}
            accessibilityState={{ selected: value === v.value }}
            onPress={() => onChange(v.value)}
            style={[s.chip, value === v.value && s.active]}
          >
            <Text style={{ color: value === v.value ? '#fff' : '#315443' }}>{v.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
export function PortfolioFilters({
  properties,
  filters,
  onChange,
}: {
  properties: Property[];
  filters: Filters;
  onChange: (v: Filters) => void;
}) {
  const [open, setOpen] = useState(false);
  const change = (key: keyof Filters, value: string) => onChange({ ...filters, [key]: value });
  return (
    <View style={s.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
      >
        <Text style={s.link}>
          Portfolio filtern{' '}
          {Object.values(filters).filter(Boolean).length
            ? `(${Object.values(filters).filter(Boolean).length})`
            : ''}{' '}
          {open ? '−' : '+'}
        </Text>
      </Pressable>
      {open && (
        <>
          <TextInput
            accessibilityLabel="Immobilien suchen"
            placeholder="Immobilien oder Orte suchen …"
            value={filters.query}
            onChangeText={(v) => change('query', v)}
            style={s.input}
          />
          <Chips
            label="Land"
            value={filters.country}
            onChange={(v) => change('country', v)}
            values={[
              { value: '', label: 'Alle Länder' },
              ...[...new Set(properties.map((p) => p.country))]
                .sort()
                .map((v) => ({ value: v, label: v })),
            ]}
          />
          <Chips
            label="Art"
            value={filters.type}
            onChange={(v) => change('type', v)}
            values={[
              { value: '', label: 'Alle Arten' },
              { value: 'apartment', label: 'Wohnung' },
              { value: 'house', label: 'Haus' },
              { value: 'commercial', label: 'Gewerbe' },
              { value: 'land', label: 'Grundstück' },
            ]}
          />
          <Chips
            label="Währung"
            value={filters.currency}
            onChange={(v) => change('currency', v)}
            values={[
              { value: '', label: 'Alle Währungen' },
              ...[...new Set(properties.map((p) => p.currency))]
                .sort()
                .map((v) => ({ value: v, label: v })),
            ]}
          />
          <Chips
            label="Vermietung"
            value={filters.rental}
            onChange={(v) => change('rental', v)}
            values={[
              { value: '', label: 'Alle Angaben' },
              { value: 'rented', label: 'Mietvertrag hinterlegt' },
              { value: 'vacant', label: 'Nicht vermietet' },
              { value: 'unknown', label: 'Nicht angegeben' },
            ]}
          />
          <Pressable accessibilityRole="button" onPress={() => onChange(emptyFilters)}>
            <Text style={s.link}>Filter zurücksetzen</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
export function useDashboardWidgets(userId: string) {
  const defaults = { metrics: true, map: true, insights: true, properties: true };
  const [state, setState] = useState<{ account: string; values: typeof defaults } | null>(null);
  const [storageError, setStorageError] = useState('');
  const widgets = state?.account === userId ? state.values : defaults;
  useEffect(() => {
    let live = true;
    SecureStore.getItemAsync(`estateatlas-dashboard-${userId}`)
      .then((raw) => {
        const saved = dashboardPreferencesSchema.safeParse(JSON.parse(raw ?? 'null'));
        if (live) setState({ account: userId, values: saved.success ? saved.data : defaults });
      })
      .catch(() => {
        if (live) setState({ account: userId, values: defaults });
      });
    return () => {
      live = false;
    };
  }, [userId]);
  const toggle = (key: keyof typeof defaults) => {
    const values = { ...widgets, [key]: !widgets[key] };
    setState({ account: userId, values });
    setStorageError('');
    SecureStore.setItemAsync(`estateatlas-dashboard-${userId}`, JSON.stringify(values)).catch(() =>
      setStorageError(
        'Die Ansicht gilt für diese Sitzung; Speichern auf dem Gerät ist nicht verfügbar.',
      ),
    );
  };
  return { widgets, toggle, storageError };
}
export function DashboardCustomize({
  widgets,
  toggle,
}: {
  widgets: ReturnType<typeof useDashboardWidgets>['widgets'];
  toggle: ReturnType<typeof useDashboardWidgets>['toggle'];
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
      >
        <Text style={s.link}>Dashboard anpassen {open ? '−' : '+'}</Text>
      </Pressable>
      {open && (
        <>
          {dashboardWidgets.map((w) => (
            <Pressable
              key={w}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: widgets[w] }}
              onPress={() => toggle(w)}
              style={s.chip}
            >
              <Text style={s.link}>
                {widgets[w] ? '☑' : '□'} {dashboardWidgetLabels[w]}
              </Text>
            </Pressable>
          ))}
          <Text style={s.note}>
            Für dein Konto auf diesem Gerät gespeichert. Filter gelten für alle Bereiche.
          </Text>
        </>
      )}
    </View>
  );
}
export function filteredPortfolio(properties: Property[], filters: Filters, archived = false) {
  return filterProperties(properties, { ...filters, archived });
}
export const s = StyleSheet.create({
  card: { padding: 16, borderRadius: 18, backgroundColor: '#fff', gap: 12, marginVertical: 8 },
  input: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#dce5d7',
    borderRadius: 10,
    color: '#315443',
  },
  field: { gap: 6 },
  chips: { gap: 8 },
  chip: { padding: 10, borderRadius: 18, borderWidth: 1, borderColor: '#dce5d7' },
  active: { backgroundColor: '#26715b' },
  link: { color: '#26715b', fontSize: 13, fontWeight: '600' },
  note: { color: '#6f8275', fontSize: 12, lineHeight: 18 },
  title: { color: '#254e3e', fontSize: 22, fontWeight: '700' },
});
