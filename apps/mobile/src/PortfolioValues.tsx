import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import type { ApiClient } from '@estate-atlas/api-client';
import {
  valueRows,
  portfolioStats,
  formatMoney,
  rentalSummary,
  type Property,
  type Valuation,
} from '@estate-atlas/shared';
import { PortfolioFilters, Chips, emptyFilters, filteredPortfolio, s } from './PortfolioTools';
import ValueHistory from './ValueHistory';
export default function PortfolioValues({
  properties,
  api,
  reload,
  onSelect,
}: {
  properties: Property[];
  api: ApiClient;
  reload: () => Promise<void>;
  onSelect: (id: string) => void;
}) {
  const [filters, setFilters] = useState(emptyFilters);
  const [values, setValues] = useState<Valuation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [propertyId, setPropertyId] = useState('');
  const [period, setPeriod] = useState<30 | 365 | null>(null);
  const [sort, setSort] = useState('name');
  const [archived, setArchived] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setRefresh((v) => v + 1);
    }, []),
  );
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setValues([]);
    api
      .valuations(controller.signal)
      .then((v) => {
        if (!controller.signal.aborted) setValues(v);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, properties, refresh]);
  const matching = [
    ...filteredPortfolio(properties, filters),
    ...(archived ? filteredPortfolio(properties, filters, true) : []),
  ];
  const items = matching.filter((p) => !propertyId || p.id === propertyId);
  const rows = valueRows(items, values, period, sort);
  const stats = portfolioStats(items);
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#f4f7f3' }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={async () => {
              try {
                await reload();
                setRefresh((v) => v + 1);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        }
      >
        <Text style={s.title}>Wertentwicklung</Text>
        <Text style={s.note}>Dein ganzes Portfolio. Gespeicherte Werte im Vergleich.</Text>
        <PortfolioFilters properties={properties} filters={filters} onChange={setFilters} />
        <View style={s.card}>
          <Chips
            label="Immobilie"
            value={propertyId}
            onChange={setPropertyId}
            values={[
              { value: '', label: 'Alle ausgewählten Immobilien' },
              ...matching.map((p) => ({ value: p.id, label: p.title })),
            ]}
          />
          <Chips
            label="Zeitraum"
            value={String(period ?? 'all')}
            onChange={(v) => setPeriod(v === 'all' ? null : (Number(v) as 30 | 365))}
            values={[
              { value: 'all', label: 'Gesamt' },
              { value: '365', label: '12 Monate' },
              { value: '30', label: '30 Tage' },
            ]}
          />
          <Chips
            label="Sortieren"
            value={sort}
            onChange={setSort}
            values={[
              { value: 'name', label: 'Name' },
              { value: 'change', label: 'Entwicklung in %' },
              { value: 'recent', label: 'Zuletzt bewertet' },
            ]}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: archived }}
            onPress={() => setArchived(!archived)}
          >
            <Text style={s.link}>{archived ? '☑' : '□'} Archiv einblenden</Text>
          </Pressable>
        </View>
        {stats.byCurrency.map((c) => (
          <View style={s.card} key={c.currency}>
            <Text style={s.note}>
              Aktueller Bestand · {c.currency} · {c.count} aktive Immobilien
            </Text>
            <Text style={s.title}>{formatMoney(c.marketValue, c.currency)}</Text>
          </View>
        ))}
        <Text style={s.note}>
          {items.length} Immobilien. Verläufe je Objekt; keine rückwirkende Gesamtbewertung.
          Archivobjekte zählen nicht zu den Summen. Der Zeitraum gilt für die Verläufe.
        </Text>
        {loading ? (
          <Text style={s.note}>Wertangaben werden geladen …</Text>
        ) : error ? (
          <View>
            <Text accessibilityRole="alert">{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => setRefresh((v) => v + 1)}>
              <Text style={s.link}>Erneut laden</Text>
            </Pressable>
          </View>
        ) : !items.length ? (
          <Text style={s.note}>Keine Immobilien passen zu dieser Auswahl.</Text>
        ) : (
          rows.map((row) => (
            <View key={row.property.id} style={s.card}>
              <Pressable accessibilityRole="button" onPress={() => onSelect(row.property.id)}>
                <Text style={s.title}>{row.property.title} ↗</Text>
                <Text style={s.note}>{row.property.address}</Text>
              </Pressable>
              <Text style={s.note}>
                {row.property.isTestData ? 'TESTDATEN · ' : ''}
                {row.property.archivedAt ? 'Archiv · ' : ''}
                {rentalSummary(row.property.rental).label}
              </Text>
              <ValueHistory
                key={`${row.property.id}-${row.property.currency}`}
                values={row.history}
                currency={row.property.currency}
                period={period}
              />
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
