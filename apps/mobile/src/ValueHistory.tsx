import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import {
  formatMoney,
  valuationSeries,
  valuationChart,
  type Currency,
  type Valuation,
} from '@estate-atlas/shared';

export default function ValueHistory({
  values,
  currency: currentCurrency,
  period,
}: {
  values: Valuation[];
  currency: Currency;
  period?: 30 | 365 | null;
}) {
  const [currency, setCurrency] = useState(currentCurrency);
  const [days, setDays] = useState<30 | 365 | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showRecords, setShowRecords] = useState(false);
  const series = valuationSeries(values, currency, period === undefined ? days : period);
  const chart = valuationChart(series.points);
  const point = series.points.find((v) => v.id === selected) ?? series.last;
  const choices = [...new Set([currentCurrency, ...values.map((v) => v.currency)])];
  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>DEINE WERTE IM ZEITVERLAUF</Text>
      <Text style={s.title}>Wertentwicklung</Text>
      {choices.length > 1 && (
        <ScrollView horizontal contentContainerStyle={s.choices}>
          {choices.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Wertentwicklung in ${c}`}
              accessibilityState={{ selected: currency === c }}
              style={[s.chip, currency === c && s.active]}
              onPress={() => {
                setCurrency(c);
                setSelected(null);
              }}
            >
              <Text style={currency === c ? s.activeText : s.text}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {period === undefined && (
        <View style={s.choices}>
          {(
            [
              { label: 'Gesamt', days: null },
              { label: '12 Monate', days: 365 },
              { label: '30 Tage', days: 30 },
            ] as const
          ).map((p) => (
            <Pressable
              key={p.label}
              accessibilityRole="button"
              accessibilityState={{ selected: days === p.days }}
              style={[s.chip, days === p.days && s.active]}
              onPress={() => {
                setDays(p.days);
                setSelected(null);
              }}
            >
              <Text style={days === p.days ? s.activeText : s.text}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {!point ? (
        <Text style={s.note}>In diesem Zeitraum wurden keine Werte in {currency} erfasst.</Text>
      ) : (
        <>
          <Text style={s.value}>{formatMoney(series.last!.marketValue, currency)}</Text>
          <Text style={s.note}>
            {series.change === null
              ? 'Ein erster Wert – noch kein Trend'
              : `${series.change >= 0 ? '+' : ''}${formatMoney(series.change, currency)}${series.changePercent === null ? '' : ` (${series.changePercent.toLocaleString('de-AT', { maximumFractionDigits: 1 })} %)`} seit erster Angabe im Zeitraum`}
          </Text>
          <View style={s.axis}>
            <Text style={s.note}>Skala ab {formatMoney(chart.low, currency)}</Text>
            <Text style={s.note}>bis {formatMoney(chart.high, currency)}</Text>
          </View>
          <Svg
            width="100%"
            height={180}
            viewBox="0 0 600 184"
            accessibilityLabel={`Wertverlauf in ${currency}, ${series.points.length} gespeicherte Wertangaben`}
          >
            {[16, 92, 168].map((y) => (
              <Line key={y} x1={12} x2={588} y1={y} y2={y} stroke="#dce7dc" strokeDasharray="4 6" />
            ))}
            {chart.points.length > 1 && (
              <Path d={chart.path} stroke="#146F68" strokeWidth={3} fill="none" />
            )}
            {chart.points.map((p) => (
              <Circle
                key={p.value.id}
                cx={p.x}
                cy={p.y}
                r={p.value.id === point.id ? 7 : 5}
                fill="#146F68"
                stroke="#f6f9f5"
                strokeWidth={2}
                onPress={() => setSelected(p.value.id)}
              />
            ))}
          </Svg>
          <View style={s.axis}>
            <Text style={s.note}>
              {new Date(series.first!.recordedAt).toLocaleDateString('de-AT')}
            </Text>
            <Text style={s.note}>
              {series.points.length > 1
                ? new Date(series.last!.recordedAt).toLocaleDateString('de-AT')
                : ''}
            </Text>
          </View>
          <Text accessibilityLiveRegion="polite" style={s.note}>
            {new Date(point.recordedAt).toLocaleString('de-AT')} ·{' '}
            {formatMoney(point.marketValue, currency)} ·{' '}
            {point.origin === 'analysis' ? 'KI-Recherche übernommen' : 'Eigene Angabe'}
          </Text>
        </>
      )}
      <Text style={s.note}>
        Gespeicherte Wertangaben. Jede Währung bleibt getrennt; zwischen den Punkten wurden keine
        Werte erhoben.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showRecords }}
        style={s.chip}
        onPress={() => setShowRecords(!showRecords)}
      >
        <Text style={s.text}>
          Alle Wertangaben {showRecords ? 'verbergen' : 'ansehen'} ({series.points.length})
        </Text>
      </Pressable>
      {showRecords &&
        series.points.map((v) => (
          <Pressable
            key={v.id}
            accessibilityRole="button"
            accessibilityLabel={`${new Date(v.recordedAt).toLocaleString('de-AT')}, ${formatMoney(v.marketValue, v.currency)}`}
            onPress={() => setSelected(v.id)}
            style={s.record}
          >
            <Text style={s.note}>
              {new Date(v.recordedAt).toLocaleString('de-AT')} ·{' '}
              {v.origin === 'analysis' ? 'KI-Recherche übernommen' : 'Eigene Angabe'}
            </Text>
            <Text style={s.text}>{formatMoney(v.marketValue, v.currency)}</Text>
          </Pressable>
        ))}
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e0e9dd',
    backgroundColor: '#f6f9f5',
    gap: 12,
    marginVertical: 12,
  },
  eyebrow: { color: '#739982', fontSize: 9, letterSpacing: 1.2, fontWeight: '700' },
  title: { color: '#172B36', fontSize: 21, fontWeight: '700' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E1E5E4',
  },
  active: { backgroundColor: '#146F68', borderColor: '#146F68' },
  activeText: { color: '#fff', fontSize: 12 },
  text: { color: '#172B36', fontSize: 12 },
  value: { color: '#172B36', fontSize: 26, fontWeight: '700' },
  note: { color: '#627580', fontSize: 11, lineHeight: 18 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  record: { borderTopWidth: 1, borderColor: '#dce7dc', paddingVertical: 12, gap: 4 },
});
