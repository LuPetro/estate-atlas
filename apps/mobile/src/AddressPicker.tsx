import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Linking } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { GeocodingResult } from '@estate-atlas/shared';
import type { ApiClient } from '@estate-atlas/api-client';

type Position = { latitude: number; longitude: number };
export default function AddressPicker({
  value,
  position,
  api,
  onChange,
  onSelect,
  onPositionChange,
}: {
  value: string;
  position: Position | null;
  api: ApiClient;
  onChange: (value: string) => void;
  onSelect: (result: GeocodingResult) => void;
  onPositionChange: (position: Position) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const map = useRef<MapView>(null);
  useEffect(() => {
    setResults([]);
    setStatus('');
    setLoading(false);
    if (query.trim().length < 4) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await api.searchAddress(query, controller.signal);
        if (controller.signal.aborted) return;
        setResults(items);
        if (!items.length)
          setStatus('Keine Vorschläge gefunden. Adresse ergänzen oder Pin setzen.');
      } catch (error) {
        if (!controller.signal.aborted) setStatus((error as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 800);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, api, retry]);
  const focusPosition = () => {
    if (position)
      map.current?.animateToRegion(
        { ...position, latitudeDelta: 0.004, longitudeDelta: 0.004 },
        250,
      );
  };
  useEffect(focusPosition, [position?.latitude, position?.longitude]);
  const updatePosition = (point: Position) =>
    onPositionChange({
      latitude: Math.max(-90, Math.min(90, point.latitude)),
      longitude: ((((point.longitude + 180) % 360) + 360) % 360) - 180,
    });
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Adresse</Text>
      <TextInput
        accessibilityLabel="Adresse"
        value={value}
        maxLength={300}
        style={styles.input}
        placeholder="Straße, Hausnummer, PLZ und Ort"
        autoCorrect={false}
        onChangeText={(text) => {
          onChange(text);
          setQuery(text);
        }}
      />
      <Text style={styles.hint}>Vorschläge ab 4 Zeichen. Suchtext wird an Photon gesendet.</Text>
      <Text
        style={styles.link}
        accessibilityRole="link"
        onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}
      >
        Daten: © OpenStreetMap · Photon
      </Text>
      {(loading || status) && (
        <Text accessibilityLiveRegion="polite" style={styles.hint}>
          {loading ? 'Adressen werden gesucht …' : status}
        </Text>
      )}
      {status && (
        <Pressable
          accessibilityRole="button"
          style={styles.suggestion}
          onPress={() => setRetry((value) => value + 1)}
        >
          <Text style={styles.label}>Erneut suchen</Text>
        </Pressable>
      )}
      {results.map((result) => (
        <Pressable
          key={`${result.address}-${result.latitude}-${result.longitude}`}
          accessibilityRole="button"
          style={styles.suggestion}
          onPress={() => {
            setQuery('');
            setResults([]);
            setStatus('');
            onSelect(result);
          }}
        >
          <Text style={styles.label}>{result.label}</Text>
          <Text style={styles.hint}>
            {result.precision === 'building'
              ? 'Hausadresse'
              : result.precision === 'street'
                ? 'Straßenposition – Pin prüfen'
                : 'Ortsposition – Pin genauer setzen'}
          </Text>
        </Pressable>
      ))}
      <Text style={styles.label}>Position auf der Karte</Text>
      <Text style={styles.hint}>
        Vorschlag auswählen oder auf die Karte tippen. Halte den Pin gedrückt und ziehe ihn für eine
        genauere Position.
      </Text>
      <MapView
        ref={map}
        style={styles.map}
        accessibilityLabel="Immobilienposition auf der Karte wählen"
        initialRegion={
          position
            ? { ...position, latitudeDelta: 0.004, longitudeDelta: 0.004 }
            : { latitude: 35, longitude: 10, latitudeDelta: 100, longitudeDelta: 150 }
        }
        onMapReady={focusPosition}
        onPress={(event) => updatePosition(event.nativeEvent.coordinate)}
        onLongPress={(event) => updatePosition(event.nativeEvent.coordinate)}
      >
        {position && (
          <Marker
            coordinate={position}
            draggable
            title="Immobilienposition"
            pinColor="#26715b"
            onDragEnd={(event) => updatePosition(event.nativeEvent.coordinate)}
          />
        )}
      </MapView>
      <Text accessibilityLiveRegion="polite" style={styles.hint}>
        {position
          ? 'Position gesetzt. GPS-Felder wurden übernommen.'
          : 'Noch keine Position gewählt.'}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { fontSize: 12, fontWeight: '600', color: '#38523e' },
  input: {
    backgroundColor: '#fff',
    padding: 14,
    borderWidth: 1,
    borderColor: '#d7e3d5',
    borderRadius: 7,
    color: '#38523e',
  },
  hint: { fontSize: 11, lineHeight: 17, color: '#6a8069' },
  link: { fontSize: 11, color: '#26715b', textDecorationLine: 'underline' },
  suggestion: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d7e3d5',
    borderRadius: 7,
    padding: 12,
    gap: 4,
  },
  map: { height: 260, borderRadius: 7 },
});
