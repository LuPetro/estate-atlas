import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  AccessibilityInfo,
  AppState,
  Linking,
} from 'react-native';
import { formatMoney, type PropertyDetail, type AnalysisJob } from '@estate-atlas/shared';
import { analysisPhases, type AnalysisConfig } from '@estate-atlas/shared/analysis';
import type { ApiClient } from '@estate-atlas/api-client';
const active = (j: AnalysisJob | null) => j?.status === 'queued' || j?.status === 'running';
export default function AnalysisPanel({
  property,
  api,
  onApplied,
}: {
  property: PropertyDetail;
  api: ApiClient;
  onApplied: () => Promise<void>;
}) {
  const [config, setConfig] = useState<AnalysisConfig | null>(null);
  const [model, setModel] = useState('');
  const [consent, setConsent] = useState(false);
  const [job, setJob] = useState<AnalysisJob | null>(property.analyses[0] ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [now, setNow] = useState(Date.now());
  const pulse = useRef(new Animated.Value(1)).current;
  const running = active(job);
  useEffect(() => {
    let live = true;
    api
      .analysisConfig()
      .then((c) => {
        if (live) {
          setConfig(c);
          setModel(c.defaultModel);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [api]);
  useEffect(() => {
    setJob(property.analyses[0] ?? null);
  }, [property.analyses]);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (live) setReduced(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    if (!running || reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(1);
    };
  }, [running, reduced, pulse]);
  useEffect(() => {
    if (!running || !job) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    let current: AbortController | null = null;
    const poll = async () => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        if (AppState.currentState === 'active') {
          current = new AbortController();
          timeout = setTimeout(() => current?.abort(), 10000);
          const next = await api.analysis(job.id, current.signal);
          if (!live) return;
          setJob(next);
          setError('');
          if (!active(next)) return;
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        clearTimeout(timeout);
      }
      if (live) timer = setTimeout(poll, 2000);
    };
    timer = setTimeout(poll, 1000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      live = false;
      current?.abort();
      clearTimeout(timer);
      clearInterval(clock);
    };
  }, [running, job?.id, api]);
  const action = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const result = job?.status === 'succeeded' ? job.result : null;
  const phase = analysisPhases.findIndex((p) => p.id === job?.phase);
  const disabled =
    busy || !config?.enabled || !consent || property.isTestData || Boolean(property.archivedAt);
  return (
    <View style={s.panel}>
      <View style={s.header}>
        <Animated.View style={[s.orb, { transform: [{ scale: pulse }] }]}>
          <Text style={s.star}>✦</Text>
        </Animated.View>
        <View style={s.headerText}>
          <Text style={s.eyebrow}>ESTATEATLAS RESEARCH</Text>
          <Text style={s.title}>Deine Immobilie. Der aktuelle Markt.</Text>
        </View>
      </View>
      <Text style={s.note}>
        Webquellen recherchieren, Vergleichsangebote prüfen und eine Preisspanne ableiten.
      </Text>
      {running ? (
        <>
          <Text style={s.live} accessibilityLiveRegion="polite">
            {analysisPhases[phase]?.label ?? 'Recherche läuft'}
            {job?.startedAt
              ? ` · ${Math.max(0, Math.floor((now - Date.parse(job.startedAt)) / 1000))} s`
              : ''}
          </Text>
          {analysisPhases.slice(0, 4).map((p, i) => (
            <View key={p.id} style={s.step}>
              <Text style={[s.number, i <= phase && s.selected]}>{i < phase ? '✓' : i + 1}</Text>
              <Text style={i === phase ? s.live : s.note}>{p.label}</Text>
            </View>
          ))}
          <Text style={s.note}>Dein eigener Wert bleibt bis zur Übernahme erhalten.</Text>
          <Pressable
            accessibilityRole="button"
            style={s.secondary}
            disabled={busy}
            onPress={() =>
              action(async () => {
                setJob(await api.cancelAnalysis(job!.id));
              })
            }
          >
            <Text style={s.link}>Recherche abbrechen</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={s.label}>Recherchemodell</Text>
          <View style={s.models}>
            {(config?.models ?? ['gpt-6-luna']).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="radio"
                accessibilityState={{ selected: model === m, disabled: !config?.enabled || busy }}
                disabled={!config?.enabled || busy}
                onPress={() => setModel(m)}
                style={[s.model, model === m && s.modelSelected]}
              >
                <Text style={s.link}>{m === 'gpt-6-luna' ? 'GPT-6 Luna · Sparsam' : m}</Text>
              </Pressable>
            ))}
          </View>
          {!config?.enabled && (
            <Text style={s.notice}>
              {config?.reason ?? 'Recherchekonfiguration wird geladen …'}
            </Text>
          )}
          {(property.isTestData || property.archivedAt) && (
            <Text style={s.notice}>Recherche ist nur für aktive, reale Immobilien verfügbar.</Text>
          )}
          {config?.enabled && (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
              onPress={() => setConsent(!consent)}
              style={s.consent}
            >
              <Text style={s.check}>{consent ? '☑' : '□'}</Text>
              <Text style={s.consentText}>
                Ich stimme zu, dass Adresse, Position und Objektmerkmale an OpenAI und dessen
                Suchdienste übermittelt werden. API-Kosten fallen an.
              </Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            style={[s.button, disabled && s.disabled]}
            disabled={disabled}
            onPress={() =>
              action(async () => {
                setJob(await api.analyse(property.id, { model, consent: true }));
              })
            }
          >
            <Text style={s.buttonText}>
              {busy
                ? 'Bitte warten …'
                : result
                  ? 'Erneut recherchieren'
                  : 'Marktpreis recherchieren'}{' '}
              ↗
            </Text>
          </Pressable>
        </>
      )}
      {!running && job?.reason && <Text style={s.notice}>{job.reason}</Text>}
      {result && (
        <View style={s.result}>
          <Text style={s.label}>Recherchierte Preisindikation</Text>
          <Text style={s.price}>{formatMoney(result.mid, result.currency)}</Text>
          <Text style={s.range}>
            {formatMoney(result.low, result.currency)} – {formatMoney(result.high, result.currency)}
          </Text>
          <Text style={s.note}>
            {result.confidence === 'medium' ? 'Mittlere' : 'Geringe'} Datensicherheit ·{' '}
            {result.basis === 'asking' ? 'Angebotspreise' : 'Dokumentierte Transaktionen'} ·{' '}
            {result.comparables.length} Vergleichsobjekte ·{' '}
            {new Date(result.researchedAt).toLocaleDateString('de-AT')}
          </Text>
          <Text style={s.note}>{result.reasoning}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(!expanded)}
            style={s.secondary}
          >
            <Text style={s.link}>
              {expanded ? 'Quellen schließen' : 'Quellen & Unsicherheiten ansehen'} ↗
            </Text>
          </Pressable>
          {expanded && (
            <View>
              {result.comparables.map((c) => (
                <View key={c.url} style={s.comparable}>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() =>
                      Linking.openURL(c.url).catch(() =>
                        setError('Quelle konnte nicht geöffnet werden.'),
                      )
                    }
                  >
                    <Text style={s.link}>{c.title} ↗</Text>
                  </Pressable>
                  <Text style={s.label}>
                    {formatMoney(c.price, c.currency)} ·{' '}
                    {c.normalizedArea.toLocaleString('de-AT', { maximumFractionDigits: 2 })} m²
                  </Text>
                  <Text style={s.note}>{c.publishedAt ?? 'Veröffentlichungsdatum unbekannt'}</Text>
                  <Text style={s.note}>{c.evidence}</Text>
                </View>
              ))}
              {result.uncertainties.map((u, i) => (
                <Text key={i} style={s.note}>
                  • {u}
                </Text>
              ))}
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={busy || Boolean(job?.appliedAt)}
            style={s.secondary}
            onPress={() =>
              action(async () => {
                setJob(await api.applyAnalysis(job!.id));
                await onApplied();
              })
            }
          >
            <Text style={s.link}>
              {job?.appliedAt ? '✓ Wert übernommen' : 'Geprüften Wert übernehmen'}
            </Text>
          </Pressable>
        </View>
      )}
      {Boolean(error) && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  panel: {
    padding: 21,
    borderWidth: 1,
    borderColor: '#d8e8df',
    borderRadius: 22,
    backgroundColor: '#f3f9f5',
    gap: 12,
    marginVertical: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerText: { flex: 1, gap: 5 },
  orb: {
    width: 49,
    height: 49,
    borderRadius: 16,
    backgroundColor: '#dcefe2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: { fontSize: 29, color: '#297a52' },
  eyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 1.3, color: '#62836e' },
  title: { fontSize: 20, fontWeight: '600', letterSpacing: -0.5, color: '#244d35' },
  note: { fontSize: 12, lineHeight: 19, color: '#687d6e' },
  label: { fontSize: 12, fontWeight: '600', color: '#567160' },
  models: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  model: {
    padding: 11,
    borderWidth: 1,
    borderColor: '#d4e2d8',
    borderRadius: 11,
    backgroundColor: 'white',
  },
  modelSelected: { borderColor: '#367d54', backgroundColor: '#e5f2e9' },
  notice: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#e9f1ec',
    fontSize: 12,
    lineHeight: 19,
    color: '#65796c',
  },
  consent: { flexDirection: 'row', gap: 10 },
  check: { fontSize: 24, color: '#327450' },
  consentText: { flex: 1, fontSize: 11, lineHeight: 18, color: '#58715f' },
  button: {
    backgroundColor: '#2b7450',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonText: { color: 'white', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  secondary: {
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d2e2d7',
    borderRadius: 11,
    backgroundColor: 'white',
  },
  link: { fontSize: 12, fontWeight: '600', color: '#2c704b' },
  live: { color: '#2c7950', fontSize: 13, fontWeight: '600' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  number: {
    width: 27,
    height: 27,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 27,
    borderRadius: 14,
    backgroundColor: '#e6ede8',
    color: '#839588',
  },
  selected: { backgroundColor: '#d5eadb', color: '#26724a' },
  result: { borderTopWidth: 1, borderTopColor: '#d5e6da', paddingTop: 18, gap: 12 },
  price: { fontSize: 32, fontWeight: '600', letterSpacing: -1, color: '#254d36' },
  range: { fontSize: 15, color: '#53785f' },
  comparable: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e9e2',
    borderRadius: 12,
    padding: 13,
    gap: 7,
    marginBottom: 10,
  },
  error: { color: '#ad3636', fontSize: 12, lineHeight: 19 },
});
