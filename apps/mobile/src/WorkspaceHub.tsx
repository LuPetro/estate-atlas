import React, { useState, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { ApiClient } from '@estate-atlas/api-client';
import {
  portfolioDistribution,
  formatMoney,
  type Property,
  type Asset,
  type Currency,
} from '@estate-atlas/shared';
import { PortfolioFilters, Chips, emptyFilters, filteredPortfolio } from './PortfolioTools';
import { Card, Action, Input, ErrorMessage, ui, palette } from './WorkspaceUI';

export default function WorkspaceHub({
  properties,
  api,
  reload,
  onSelect,
}: {
  properties: Property[];
  api: ApiClient;
  reload: () => Promise<void>;
  onSelect: (id: string, tab?: 'documents') => void;
}) {
  const [section, setSection] = useState('distribution');
  const [filters, setFilters] = useState(emptyFilters);
  const [groupBy, setGroupBy] = useState<'country' | 'type' | 'rental'>('country');
  const [metric, setMetric] = useState<'value' | 'count' | 'area'>('value');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('EUR');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [documentQuery, setDocumentQuery] = useState('');
  const [documentType, setDocumentType] = useState('all');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      await reload();
      setAssets(await api.assets());
      setLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [api]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const matching = filteredPortfolio(properties, filters);
  const currencies = [...new Set(matching.map((p) => p.currency))];
  const currency = currencies.includes(selectedCurrency)
    ? selectedCurrency
    : (currencies[0] ?? 'EUR');
  const distribution = portfolioDistribution(matching, currency, groupBy, metric);
  const documentProperties = properties.filter(
    (p) =>
      filters.scope === 'all' ||
      (filters.scope === 'shared'
        ? p.access && p.access !== 'owner'
        : !p.access || p.access === 'owner'),
  );
  const documents = assets.filter(
    (asset) =>
      documentProperties.some((p) => p.id === asset.propertyId) &&
      (documentType === 'all' ||
        (documentType === 'pdf'
          ? asset.mimeType === 'application/pdf'
          : asset.mimeType.startsWith('image/'))) &&
      `${asset.name} ${properties.find((p) => p.id === asset.propertyId)?.title ?? ''}`
        .toLocaleLowerCase('de')
        .includes(documentQuery.trim().toLocaleLowerCase('de')),
  );
  const join = async () => {
    setBusy(true);
    setError('');
    try {
      const property = await api.acceptInvitation(code.trim());
      setCode('');
      await reload();
      onSelect(property.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.canvas }}>
      <ScrollView
        contentContainerStyle={{ padding: 22, paddingBottom: 40, gap: 16 }}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} />}
      >
        <Text style={ui.eyebrow}>DEIN ARBEITSPLATZ</Text>
        <Text style={ui.heading}>Mehr Möglichkeiten.</Text>
        <Text style={ui.note}>Portfolio verstehen. Unterlagen ordnen. Gemeinsam verwalten.</Text>
        <Chips
          label="Bereich"
          value={section}
          onChange={setSection}
          values={[
            { value: 'distribution', label: 'Verteilung' },
            { value: 'documents', label: 'Dokumente' },
            { value: 'sharing', label: 'Zusammenarbeit' },
          ]}
        />
        <ErrorMessage error={error} />
        {section === 'distribution' && (
          <>
            <PortfolioFilters properties={properties} filters={filters} onChange={setFilters} />
            <Card
              title="Portfolio-Verteilung"
              note="Die Zusammensetzung deines aktuellen Bestands. Archivierte Immobilien sind ausgenommen."
            >
              <Chips
                label="Währung"
                value={currency}
                onChange={(v) => setSelectedCurrency(v as Currency)}
                values={currencies.map((value) => ({ value, label: value }))}
              />
              <Chips
                label="Gruppierung"
                value={groupBy}
                onChange={(v) => setGroupBy(v as typeof groupBy)}
                values={[
                  { value: 'country', label: 'Land' },
                  { value: 'type', label: 'Objektart' },
                  { value: 'rental', label: 'Vermietung' },
                ]}
              />
              <Chips
                label="Anteil nach"
                value={metric}
                onChange={(v) => setMetric(v as typeof metric)}
                values={[
                  { value: 'value', label: 'Marktwert' },
                  { value: 'count', label: 'Anzahl' },
                  { value: 'area', label: 'Fläche' },
                ]}
              />
              <Text style={ui.value}>
                {metric === 'value'
                  ? formatMoney(distribution.total, currency)
                  : `${distribution.total.toLocaleString('de-AT')} ${metric === 'area' ? 'm²' : 'Immobilien'}`}
              </Text>
              <Text style={ui.note}>
                {distribution.count} Immobilien · {currency}. Währungen werden getrennt betrachtet.
              </Text>
              {distribution.groups.map((group, index) => (
                <View key={group.key} style={{ gap: 8 }}>
                  <View style={ui.row}>
                    <Text style={ui.label}>{group.label}</Text>
                    <Text style={ui.note}>{group.share.toFixed(1)} %</Text>
                  </View>
                  <View
                    accessibilityLabel={`${group.label}: ${group.share.toFixed(1)} Prozent`}
                    style={{
                      height: 9,
                      backgroundColor: '#EEF1F0',
                      borderRadius: 5,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: 9,
                        width: `${Math.max(0, Math.min(100, group.share))}%`,
                        backgroundColor: ['#146F68', '#436675', '#94ADA2', '#B5A48B'][index % 4],
                      }}
                    />
                  </View>
                  <Text style={ui.note}>
                    {metric === 'value'
                      ? formatMoney(group.value, currency)
                      : `${group.value.toLocaleString('de-AT')} ${metric === 'area' ? 'm²' : 'Immobilien'}`}{' '}
                    · {group.count} Objekte
                  </Text>
                </View>
              ))}
              {!distribution.groups.length && (
                <Text style={ui.note}>Keine Immobilien in dieser Auswahl.</Text>
              )}
            </Card>
          </>
        )}
        {section === 'documents' && (
          <>
            <Card
              title="Deine Dokumentenablage"
              note="Speichere Unterlagen und Fotos freiwillig bei einer Immobilie. Personen mit Objektzugriff können diese ebenfalls öffnen."
            >
              <Input
                label="Datei oder Immobilie suchen"
                value={documentQuery}
                onChange={setDocumentQuery}
              />
              <Chips
                label="Bestand"
                value={filters.scope}
                onChange={(scope) => setFilters({ ...filters, scope })}
                values={[
                  { value: 'own', label: 'Meine Immobilien' },
                  { value: 'shared', label: 'Geteilt mit mir' },
                  { value: 'all', label: 'Alle zugänglichen' },
                ]}
              />
              <Chips
                label="Dateityp"
                value={documentType}
                onChange={setDocumentType}
                values={[
                  { value: 'all', label: 'Alle' },
                  { value: 'pdf', label: 'PDFs' },
                  { value: 'images', label: 'Fotos' },
                ]}
              />
              <Text style={ui.note}>
                Neue Dateien wählst du unter „Dokumente“ in der jeweiligen Immobilie aus.
              </Text>
            </Card>
            {!loaded && busy && <Text style={ui.note}>Dokumente werden geladen …</Text>}
            {loaded && !documents.length && (
              <Text style={ui.note}>Noch keine passenden Dateien vorhanden.</Text>
            )}
            {documents.map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                onPress={() => onSelect(a.propertyId, 'documents')}
              >
                <Card>
                  <Text style={ui.eyebrow}>
                    {a.mimeType === 'application/pdf' ? 'PDF-DOKUMENT' : 'FOTO'}
                  </Text>
                  <Text style={ui.title}>{a.name}</Text>
                  <Text style={ui.note}>
                    {properties.find((p) => p.id === a.propertyId)?.title} ·{' '}
                    {(a.size / 1024).toFixed(0)} KB
                  </Text>
                  <Text style={{ color: palette.accent }}>Bei der Immobilie öffnen →</Text>
                </Card>
              </Pressable>
            ))}
          </>
        )}
        {section === 'sharing' && (
          <>
            <Card
              title="Einladung annehmen"
              note="Eine Vertrauensperson kann dir einen Einladungscode für eine einzelne Immobilie geben. Der Zugriff umfasst auch die gespeicherten Unterlagen."
            >
              <Input label="Einladungscode" value={code} onChange={setCode} />
              <Action disabled={busy || !code.trim()} onPress={join}>
                {busy ? 'Wird geprüft …' : 'Immobilie hinzufügen'}
              </Action>
            </Card>
            <Text style={ui.title}>Geteilt mit mir</Text>
            {properties
              .filter((p) => p.access && p.access !== 'owner')
              .map((p) => (
                <Pressable key={p.id} accessibilityRole="button" onPress={() => onSelect(p.id)}>
                  <Card>
                    <Text style={ui.title}>{p.title}</Text>
                    <Text style={ui.note}>{p.address}</Text>
                    <Text style={ui.label}>
                      {p.access === 'editor' ? 'Du kannst bearbeiten' : 'Du kannst ansehen'}
                      {p.archivedAt ? ' · Archiviert' : ''}
                    </Text>
                  </Card>
                </Pressable>
              ))}
            {!properties.some((p) => p.access && p.access !== 'owner') && (
              <Text style={ui.note}>Bisher wurden keine Immobilien mit dir geteilt.</Text>
            )}
            <Text style={ui.note}>
              Deine eigenen Immobilien teilst du im Bereich „Zusammenarbeit“ der jeweiligen
              Immobilie.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
