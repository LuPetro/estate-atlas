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
import {
  analysisPhases,
  exclusionLabels,
  type Exclusions,
  type AnalysisConfig,
} from '@estate-atlas/shared/analysis';
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
  const owner = !property.access || property.access === 'owner';
  const [config, setConfig] = useState<AnalysisConfig | null>(null);
  const [model, setModel] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
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
    if (!owner) return;
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
  }, [api, owner]);
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
    busy ||
    !owner ||
    !config?.enabled ||
    !consent ||
    property.isTestData ||
    Boolean(property.archivedAt);
  return (
    <View style={s.panel}>
      <View style={s.header}>
        {running && <Animated.View style={[s.orb, { transform: [{ scale: pulse }] }]} />}
        <View style={s.headerText}>
          <Text style={s.title}>Marktvergleich</Text>
          <Text style={s.note}>Angebote, Quellen und eine Preisindikation.</Text>
        </View>
      </View>
      {!owner && !job && (
        <Text style={s.note}>
          Die Eigentümerin oder der Eigentümer kann eine Recherche starten.
        </Text>
      )}
      {!running && owner && config?.enabled && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: setupOpen }}
          onPress={() => setSetupOpen(!setupOpen)}
          style={[s.model, { alignSelf: 'flex-start' }]}
        >
          <Text style={s.link}>
            {setupOpen
              ? 'Vorbereitung schließen'
              : result
                ? 'Neue Recherche vorbereiten'
                : 'Recherche vorbereiten'}{' '}
            →
          </Text>
        </Pressable>
      )}
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
          {owner && (
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
          )}
        </>
      ) : (
        owner &&
        (setupOpen || !config?.enabled) && (
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
              <Text style={s.notice}>
                Recherche ist nur für aktive, reale Immobilien verfügbar.
              </Text>
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
                  setSetupOpen(false);
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
        )
      )}
      {!running && job?.reason && <Text style={s.notice}>{job.reason}</Text>}
      {!running && job?.diagnostics && job.status === 'failed' && (
        <View style={s.comparable}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(!expanded)}
          >
            <Text style={s.link}>Was hat die Recherche gefunden? {expanded ? '−' : '+'}</Text>
          </Pressable>
          {expanded && (
            <>
              <Text style={s.note}>
                {job.diagnostics.extracted} Angebote ausgelesen · {job.diagnostics.verified} mit
                Preis- und Flächenbeleg · {job.diagnostics.accepted} passend aus{' '}
                {job.diagnostics.websites} Websites
              </Text>
              {Object.entries(job.diagnostics.exclusions).map(([reason, count]) => (
                <Text style={s.note} key={reason}>
                  {count} × {exclusionLabels[reason as keyof Exclusions]}
                </Text>
              ))}
              {job.diagnostics.notes.map((note, i) => (
                <Text style={s.note} key={i}>
                  {note}
                </Text>
              ))}
              <Text style={s.note}>
                Recherchierte Quellen; darunter können Übersichtsseiten und unpassende Angebote
                sein:
              </Text>
              {job.diagnostics.sources.map((url) => (
                <Pressable
                  key={url}
                  accessibilityRole="link"
                  onPress={() =>
                    Linking.openURL(url).catch(() =>
                      setError('Quelle konnte nicht geöffnet werden.'),
                    )
                  }
                >
                  <Text style={s.link}>{new URL(url).hostname} · Quelle öffnen ↗</Text>
                </Pressable>
              ))}
            </>
          )}
        </View>
      )}
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
          {owner && (
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
          )}
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
    padding: 16,
    borderWidth: 1,
    borderColor: '#E1E5E4',
    borderRadius: 16,
    backgroundColor: '#fff',
    gap: 12,
    marginVertical: 0,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerText: { flex: 1, gap: 5 },
  orb: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#146F68',
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: { fontSize: 22, color: '#297a52' },
  eyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 1.3, color: '#62836e' },
  title: { fontSize: 17, fontWeight: '600', letterSpacing: -0.5, color: '#172B36' },
  note: { fontSize: 12, lineHeight: 19, color: '#627580' },
  label: { fontSize: 12, fontWeight: '600', color: '#627580' },
  models: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  model: {
    padding: 11,
    borderWidth: 1,
    borderColor: '#E1E5E4',
    borderRadius: 11,
    backgroundColor: 'white',
  },
  modelSelected: { borderColor: '#146F68', backgroundColor: '#EDF3F1' },
  notice: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F3F5F4',
    fontSize: 12,
    lineHeight: 19,
    color: '#627580',
  },
  consent: { flexDirection: 'row', gap: 10 },
  check: { fontSize: 24, color: '#327450' },
  consentText: { flex: 1, fontSize: 11, lineHeight: 18, color: '#627580' },
  button: {
    backgroundColor: '#146F68',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    alignItems: 'center',
  },
  buttonText: { color: 'white', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  secondary: {
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E1E5E4',
    borderRadius: 11,
    backgroundColor: 'white',
  },
  link: { fontSize: 12, fontWeight: '600', color: '#146F68' },
  live: { color: '#146F68', fontSize: 13, fontWeight: '600' },
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
  result: { borderTopWidth: 1, borderTopColor: '#E1E5E4', paddingTop: 18, gap: 12 },
  price: { fontSize: 32, fontWeight: '600', letterSpacing: -1, color: '#172B36' },
  range: { fontSize: 15, color: '#627580' },
  comparable: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E1E5E4',
    borderRadius: 12,
    padding: 13,
    gap: 7,
    marginBottom: 10,
  },
  error: { color: '#ad3636', fontSize: 12, lineHeight: 19 },
});
