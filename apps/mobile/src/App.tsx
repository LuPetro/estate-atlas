import React, { useState, useEffect, useMemo, createContext, useContext, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  NavigationContainer,
  useFocusEffect,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { createBottomTabNavigator, type BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, type Region } from 'react-native-maps';
import * as SecureStore from 'expo-secure-store';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import { ApiClient, ApiError } from '@estate-atlas/api-client';
import AddressPicker from './AddressPicker';
import {
  portfolioStats,
  filterProperties,
  formatMoney,
  clusterProperties,
  propertyInputSchema,
  propertyTypeLabels,
  propertyTypes,
  currencies,
  conditions,
  conditionLabels,
  type Property,
  type PropertyInput,
  type PropertyDetail,
  type User,
  type Asset,
} from '@estate-atlas/shared';
let token: string | null = null;
const api = new ApiClient(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000', () => token);
type Tabs = { Overview: undefined; Properties: undefined; Map: undefined };
type Stack = {
  Home: NavigatorScreenParams<Tabs> | undefined;
  Detail: { id: string };
  Editor: { property?: Property } | undefined;
};
const RootStack = createNativeStackNavigator<Stack>();
const Tab = createBottomTabNavigator<Tabs>();
type State = {
  user: User;
  properties: Property[];
  reload: () => Promise<void>;
  logout: () => Promise<void>;
};
const PortfolioContext = createContext<State | null>(null);
const usePortfolio = () => useContext(PortfolioContext)!;
const message = (e: unknown) =>
  e instanceof Error ? e.message : 'Die Anfrage ist fehlgeschlagen.';
function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, secondary && styles.secondary, disabled && { opacity: 0.5 }]}
    >
      <Text style={[styles.buttonText, secondary && { color: '#26715b' }]}>{children}</Text>
    </Pressable>
  );
}
function ErrorText({ error }: { error: string }) {
  return error ? (
    <Text accessibilityRole="alert" style={styles.error}>
      {error}
    </Text>
  ) : null;
}
function Field({
  label,
  value,
  onChange,
  number = false,
  multiline = false,
  secure = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  number?: boolean;
  multiline?: boolean;
  secure?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[styles.input, multiline && { minHeight: 90, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        keyboardType={number ? 'numbers-and-punctuation' : 'default'}
        secureTextEntry={secure}
        multiline={multiline}
      />
    </View>
  );
}
function Choices<T extends string>({
  label,
  values,
  value,
  onChange,
  labels,
}: {
  label: string;
  values: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<T, string>;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {values.map((v) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: v === value }}
            key={v}
            onPress={() => onChange(v)}
            style={[styles.chip, v === value && styles.activeChip]}
          >
            <Text style={[styles.chipText, v === value && { color: '#fff' }]}>
              {labels?.[v] ?? v}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const reload = async () => setProperties(await api.properties());
  useEffect(() => {
    (async () => {
      try {
        token = await SecureStore.getItemAsync('estateatlas-session');
        if (token) {
          setUser(await api.me());
          await reload();
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          token = null;
          await SecureStore.deleteItemAsync('estateatlas-session');
        } else setError(message(e));
      } finally {
        setReady(true);
      }
    })();
  }, []);
  const success = async (result: { user: User; token?: string }) => {
    if (!result.token) throw new Error('Die API hat keine native Sitzung geliefert.');
    token = result.token;
    await SecureStore.setItemAsync('estateatlas-session', token);
    setUser(result.user);
    await reload();
  };
  const logout = async () => {
    await api.logout();
    await SecureStore.deleteItemAsync('estateatlas-session');
    token = null;
    setUser(null);
    setProperties([]);
    setError('');
  };
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {!ready ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#14836f" />
          <Text style={styles.subtitle}>EstateAtlas wird geladen …</Text>
        </View>
      ) : !user ? (
        <Auth onSuccess={success} initialError={error} />
      ) : (
        <PortfolioContext.Provider value={{ user, properties, reload, logout }}>
          <NavigationContainer>
            <RootStack.Navigator
              screenOptions={{
                headerStyle: { backgroundColor: '#f8faf6' },
                headerTintColor: '#21483c',
                headerShadowVisible: false,
                contentStyle: { backgroundColor: '#f4f7f3' },
              }}
            >
              <RootStack.Screen name="Home" component={Home} options={{ headerShown: false }} />
              <RootStack.Screen
                name="Detail"
                component={Detail}
                options={{ title: 'Immobiliendetails' }}
              />
              <RootStack.Screen
                name="Editor"
                component={Editor}
                options={({ route }) => ({
                  title: route.params?.property ? 'Immobilie bearbeiten' : 'Neue Immobilie',
                  presentation: 'modal',
                })}
              />
            </RootStack.Navigator>
          </NavigationContainer>
        </PortfolioContext.Provider>
      )}
    </SafeAreaProvider>
  );
}
function Auth({
  onSuccess,
  initialError,
}: {
  onSuccess: (result: { user: User; token?: string }) => Promise<void>;
  initialError: string;
}) {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const result = register
        ? await api.register({ name, email, password })
        : await api.login({ email, password });
      await onSuccess(result);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.auth}>
          <Text style={styles.brand}>EstateAtlas</Text>
          <Text style={styles.eyebrow}>DEINE IMMOBILIEN. DEINE PERSPEKTIVE.</Text>
          <Text style={styles.authTitle}>
            {register ? 'Ein neuer Anfang.' : 'Schön, dass du da bist.'}
          </Text>
          <Text style={styles.subtitle}>Dein privates Portfolio auf Web, Android und iOS.</Text>
          {register && <Field label="Dein Name" value={name} onChange={setName} />}
          <View style={styles.field}>
            <Text style={styles.label}>E-Mail-Adresse</Text>
            <TextInput
              accessibilityLabel="E-Mail-Adresse"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>
          <Field
            label="Passwort (mindestens 12 Zeichen)"
            value={password}
            onChange={setPassword}
            secure
          />
          <ErrorText error={error} />
          <Button disabled={busy} onPress={submit}>
            {busy ? 'Bitte warten …' : register ? 'Konto erstellen' : 'Anmelden'}
          </Button>
          <Button
            secondary
            onPress={() => {
              setRegister(!register);
              setError('');
            }}
          >
            {register ? 'Bereits ein Konto? Anmelden' : 'Neu bei EstateAtlas? Konto erstellen'}
          </Button>
          <Text style={styles.footnote}>
            Deine Daten bleiben in deinem Benutzerportfolio. Sitzungen werden sicher im
            Gerätespeicher abgelegt.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
function Home() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#14836f',
        tabBarInactiveTintColor: '#8a9d8f',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#e2e9de' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>◇</Text>,
      }}
    >
      <Tab.Screen
        name="Overview"
        component={Overview}
        options={{
          title: 'Übersicht',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 21 }}>▦</Text>,
        }}
      />
      <Tab.Screen
        name="Properties"
        component={Properties}
        options={{
          title: 'Immobilien',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 21 }}>⌂</Text>,
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          title: 'Weltkarte',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 21 }}>◎</Text>,
        }}
      />
    </Tab.Navigator>
  );
}
function PropertyCard({ property: p, onPress }: { property: Property; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" style={styles.propertyCard} onPress={onPress}>
      <View style={styles.cardTop}>
        <Text style={styles.cardCategory}>
          {propertyTypeLabels[p.type]} · {p.country}
        </Text>
        {p.isTestData && <Text style={styles.testBadge}>TESTDATEN</Text>}
      </View>
      <Text style={styles.cardTitle}>{p.title}</Text>
      <Text style={styles.subtitle}>{p.address}</Text>
      <View style={styles.cardBottom}>
        <Text style={styles.cardValue}>{formatMoney(p.marketValue, p.currency)}</Text>
        <Text style={styles.footnote}>{p.area} m² · Eigene Angabe</Text>
      </View>
    </Pressable>
  );
}
function Overview({ navigation }: BottomTabScreenProps<Tabs, 'Overview'>) {
  const { user, properties, reload, logout } = usePortfolio();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const stats = portfolioStats(properties);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const root = navigation.getParent();
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={() => act(reload)} />}
      >
        <View style={styles.headingRow}>
          <Text style={styles.brand}>EstateAtlas</Text>
          <Pressable accessibilityRole="button" onPress={() => act(logout)}>
            <Text style={styles.link}>Abmelden</Text>
          </Pressable>
        </View>
        <Text style={styles.eyebrow}>DEIN IMMOBILIENPORTFOLIO</Text>
        <Text style={styles.title}>Alles im Blick.</Text>
        <Text style={styles.subtitle}>Hallo {user.name}. Ein Portfolio. Die ganze Welt.</Text>
        <ErrorText error={error} />
        {properties.some((p) => p.isTestData) && (
          <Text style={styles.testNotice}>
            TESTDATEN · Synthetische Objekte und Werte. Keine Marktanalyse.
          </Text>
        )}
        {stats.byCurrency.map((s) => (
          <View style={styles.valueCard} key={s.currency}>
            <Text style={styles.cardCategory}>GESCHÄTZTER PORTFOLIOWERT · {s.currency}</Text>
            <Text
              style={styles.largeValue}
              adjustsFontSizeToFit
              numberOfLines={1}
              minimumFontScale={0.6}
            >
              {formatMoney(s.marketValue, s.currency)}
            </Text>
            <Text style={styles.subtitle}>Eigene Marktwertangaben · {s.count} Immobilien</Text>
            <Text style={[styles.gain, s.gain < 0 && { color: '#ad5a51' }]}>
              {formatMoney(s.gain, s.currency)} gegenüber Kaufpreis{' '}
              {s.gainPercent === null ? '' : `(${s.gainPercent.toFixed(1)} %)`}
            </Text>
          </View>
        ))}
        <View style={styles.statsRow}>
          {[
            { label: 'Immobilien', value: stats.count },
            { label: 'Länder', value: stats.countries },
            { label: 'Fläche m²', value: stats.area },
          ].map((s) => (
            <View key={s.label} style={styles.smallStat}>
              <Text style={styles.statNumber}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
        <Button onPress={() => root?.navigate('Editor')}>+ Immobilie hinzufügen</Button>
        {!properties.length && (
          <View style={styles.empty}>
            <Text style={styles.sectionTitle}>Dein Portfolio beginnt hier.</Text>
            <Text style={styles.subtitle}>
              Lege eine Immobilie an oder erkunde die App mit gekennzeichneten Testdaten.
            </Text>
            <Button
              secondary
              disabled={busy}
              onPress={() =>
                act(async () => {
                  await api.seed();
                  await reload();
                })
              }
            >
              Testdaten laden
            </Button>
          </View>
        )}
        <Text style={styles.sectionTitle}>Deine Immobilien</Text>
        {properties
          .filter((p) => !p.archivedAt)
          .slice(0, 5)
          .map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              onPress={() => root?.navigate('Detail', { id: p.id })}
            />
          ))}
        <View style={styles.research}>
          <Text style={styles.cardTitle}>Neue Perspektiven mit KI</Text>
          <Text style={styles.subtitle}>
            Echte Recherche wartet auf freigegebene Datenquellen. Keine erfundenen Bewertungen.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
function Properties({ navigation }: BottomTabScreenProps<Tabs, 'Properties'>) {
  const { properties, reload } = usePortfolio();
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [type, setType] = useState('');
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const items = filterProperties(properties, {
    query,
    country: country.trim().toUpperCase(),
    type,
    archived,
  });
  const root = navigation.getParent();
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={busy}
            onRefresh={async () => {
              setBusy(true);
              try {
                await reload();
                setError('');
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        }
      >
        <Text style={styles.eyebrow}>DEIN PORTFOLIO</Text>
        <Text style={styles.title}>Raum für deine Werte.</Text>
        <Field label="Immobilien suchen" value={query} onChange={setQuery} />
        <Field
          label="Land filtern (ISO-Code, leer für alle)"
          value={country}
          onChange={setCountry}
        />
        <Choices
          label="Immobilienart"
          values={['', ...propertyTypes]}
          value={type}
          onChange={setType}
          labels={{ '': 'Alle', ...propertyTypeLabels }}
        />
        <Choices
          label="Status"
          values={['Aktiv', 'Archiv']}
          value={archived ? 'Archiv' : 'Aktiv'}
          onChange={(v) => setArchived(v === 'Archiv')}
        />
        <Button onPress={() => root?.navigate('Editor')}>+ Immobilie hinzufügen</Button>
        <ErrorText error={error} />
        <Text style={styles.sectionTitle}>{items.length} Immobilien</Text>
        {items.map((p) => (
          <PropertyCard
            key={p.id}
            property={p}
            onPress={() => root?.navigate('Detail', { id: p.id })}
          />
        ))}
        {!items.length && (
          <Text style={styles.empty}>Keine Immobilien passen zu dieser Auswahl.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
function MapScreen({ navigation }: BottomTabScreenProps<Tabs, 'Map'>) {
  const { properties } = usePortfolio();
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [type, setType] = useState('');
  const [region, setRegion] = useState<Region>({
    latitude: 35,
    longitude: 10,
    latitudeDelta: 100,
    longitudeDelta: 150,
  });
  const map = React.useRef<MapView>(null);
  const items = useMemo(
    () => filterProperties(properties, { query, country: country.trim().toUpperCase(), type }),
    [properties, query, country, type],
  );
  const clusters = clusterProperties(items, Math.log2(360 / Math.max(0.01, region.longitudeDelta)));
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={{ padding: 22, paddingBottom: 8 }}>
        <Text style={styles.eyebrow}>DEINE WELT</Text>
        <Text style={styles.title}>Portfolio auf der Karte.</Text>
        <TextInput
          accessibilityLabel="Karte durchsuchen"
          style={styles.input}
          placeholder="Immobilien oder Orte suchen …"
          value={query}
          onChangeText={setQuery}
        />
        <TextInput
          accessibilityLabel="Land auf Karte filtern"
          style={[styles.input, { marginTop: 8 }]}
          placeholder="Land (ISO-Code), leer für alle"
          value={country}
          onChangeText={setCountry}
          autoCapitalize="characters"
        />
        <Choices
          label="Immobilienart"
          values={['', ...propertyTypes]}
          value={type}
          onChange={setType}
          labels={{ '': 'Alle', ...propertyTypeLabels }}
        />
      </View>
      <MapView
        ref={map}
        style={{ flex: 1 }}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
      >
        {clusters.map((c) => (
          <Marker
            key={c.key}
            coordinate={{ latitude: c.latitude, longitude: c.longitude }}
            title={c.items.length === 1 ? c.items[0].title : `${c.items.length} Immobilien`}
            description={
              c.items.length === 1
                ? formatMoney(c.items[0].marketValue, c.items[0].currency)
                : 'Antippen zum Vergrößern'
            }
            pinColor="#14836f"
            onPress={() => {
              if (c.items.length === 1)
                navigation.getParent()?.navigate('Detail', { id: c.items[0].id });
              else
                map.current?.animateToRegion(
                  {
                    latitude: c.latitude,
                    longitude: c.longitude,
                    latitudeDelta: region.latitudeDelta * 0.45,
                    longitudeDelta: region.longitudeDelta * 0.45,
                  },
                  350,
                );
            }}
          >
            {c.items.length > 1 && (
              <View style={styles.cluster}>
                <Text style={{ color: 'white', fontWeight: '700' }}>{c.items.length}</Text>
              </View>
            )}
          </Marker>
        ))}
      </MapView>
      <Text style={styles.mapCaption}>
        {items.length} aktive Immobilien · gleiche Daten wie im Web
      </Text>
    </SafeAreaView>
  );
}
function Detail({ route, navigation }: NativeStackScreenProps<Stack, 'Detail'>) {
  const { reload } = usePortfolio();
  const [p, setP] = useState<PropertyDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => setP(await api.detail(route.params.id));
  useFocusEffect(
    useCallback(() => {
      load().catch((e) => setError(message(e)));
    }, [route.params.id]),
  );
  const act = async (fn: () => Promise<unknown>, refresh = true) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      if (refresh) {
        await load();
        await reload();
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const photo = () =>
    act(async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        await api.upload(route.params.id, {
          uri: asset.uri,
          name: asset.fileName ?? 'Foto.jpg',
          type: asset.mimeType ?? 'image/jpeg',
        });
      }
    });
  const document = () =>
    act(async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        const a = result.assets[0];
        await api.upload(route.params.id, {
          uri: a.uri,
          name: a.name,
          type: a.mimeType ?? 'application/pdf',
        });
      }
    });
  const openDocument = (a: Asset) =>
    act(async () => {
      const response = await fetch(api.assetUrl(a.id), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Dokument konnte nicht geladen werden.');
      const file = new File(Paths.cache, `${a.id}.pdf`);
      try {
        file.write(new Uint8Array(await response.arrayBuffer()));
        if (!(await Sharing.isAvailableAsync()))
          throw new Error('Dokumentfreigabe auf diesem Gerät nicht verfügbar.');
        await Sharing.shareAsync(file.uri, { mimeType: a.mimeType });
      } finally {
        if (file.exists) file.delete();
      }
    }, false);
  if (!p)
    return (
      <View style={styles.loading}>
        <ErrorText error={error} />
        {!error && <ActivityIndicator color="#14836f" />}
      </View>
    );
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>
        {propertyTypeLabels[p.type]} · {p.country} {p.isTestData ? '· TESTDATEN' : ''}
      </Text>
      <Text style={styles.title}>{p.title}</Text>
      <Text style={styles.subtitle}>{p.address}</Text>
      <ErrorText error={error} />
      <View style={styles.valueCard}>
        <Text style={styles.label}>Eigener Marktwert</Text>
        <Text
          style={styles.largeValue}
          adjustsFontSizeToFit
          numberOfLines={1}
          minimumFontScale={0.6}
        >
          {formatMoney(p.marketValue, p.currency)}
        </Text>
        <Text style={styles.subtitle}>Kaufpreis: {formatMoney(p.purchasePrice, p.currency)}</Text>
      </View>
      <Text style={styles.detailText}>
        {p.area} m² · {conditionLabels[p.condition]} · Baujahr {p.yearBuilt ?? 'offen'}
      </Text>
      <Text style={styles.detailText}>
        GPS: {p.latitude}, {p.longitude}
      </Text>
      <Text style={styles.detailText}>
        Ausstattung: {p.amenities.join(', ') || 'Nicht angegeben'}
      </Text>
      {!!p.notes && <Text style={styles.research}>{p.notes}</Text>}
      <Button onPress={() => navigation.navigate('Editor', { property: p })}>
        Immobilie bearbeiten
      </Button>
      <Text style={styles.sectionTitle}>Erfasste Wertentwicklung</Text>
      <Text style={styles.footnote}>
        Datierte eigene Angaben, keine recherchierten Bewertungen.
      </Text>
      {p.valuations.map((v) => (
        <View key={v.id} style={styles.historyRow}>
          <Text style={styles.footnote}>{new Date(v.recordedAt).toLocaleString('de-AT')}</Text>
          <Text style={styles.gain}>{formatMoney(v.marketValue, v.currency)}</Text>
        </View>
      ))}
      <Text style={styles.sectionTitle}>Fotos & Dokumente</Text>
      <Text style={styles.footnote}>Privat · JPEG/PNG/WebP/PDF · bis 10 MB</Text>
      <View style={styles.twoButtons}>
        <Button secondary disabled={busy} onPress={photo}>
          Foto wählen
        </Button>
        <Button secondary disabled={busy} onPress={document}>
          PDF wählen
        </Button>
      </View>
      {p.assets.map((a) => (
        <View key={a.id} style={styles.propertyCard}>
          {a.mimeType.startsWith('image/') && (
            <Image
              source={{ uri: api.assetUrl(a.id), headers: { Authorization: `Bearer ${token}` } }}
              style={styles.photo}
              accessibilityLabel={a.name}
            />
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (a.mimeType === 'application/pdf') openDocument(a);
            }}
          >
            <Text style={styles.link}>{a.name}</Text>
          </Pressable>
          <Text style={styles.footnote}>{(a.size / 1024).toFixed(1)} KB</Text>
          <Button
            secondary
            disabled={busy}
            onPress={() =>
              Alert.alert('Anhang löschen?', a.name, [
                { text: 'Abbrechen', style: 'cancel' },
                {
                  text: 'Löschen',
                  style: 'destructive',
                  onPress: () => act(() => api.deleteAsset(a.id)),
                },
              ])
            }
          >
            Anhang löschen
          </Button>
        </View>
      ))}
      <View style={styles.research}>
        <Text style={styles.cardTitle}>KI-Marktpreisanalyse</Text>
        <Text style={styles.subtitle}>
          Recherche wartet auf freigegebene Datenquellen. Es wird keine Bewertung erzeugt.
        </Text>
        {p.analyses.slice(0, 1).map((a) => (
          <Text style={styles.footnote} key={a.id}>
            Status: {a.status === 'blocked' ? 'Wartet auf Datenquellen' : a.status}
          </Text>
        ))}
        <Button secondary disabled={busy} onPress={() => act(() => api.analyse(p.id))}>
          Analyseauftrag vorbereiten
        </Button>
      </View>
      <Button secondary disabled={busy} onPress={() => act(() => api.archive(p.id, !p.archivedAt))}>
        {p.archivedAt ? 'Aus Archiv wiederherstellen' : 'Immobilie archivieren'}
      </Button>
      <Button
        secondary
        disabled={busy}
        onPress={() =>
          Alert.alert(
            'Immobilie endgültig löschen?',
            'Alle Anhänge und Wertangaben werden mitgelöscht.',
            [
              { text: 'Abbrechen', style: 'cancel' },
              {
                text: 'Löschen',
                style: 'destructive',
                onPress: () =>
                  act(async () => {
                    await api.delete(p.id);
                    await reload();
                    navigation.goBack();
                  }, false),
              },
            ],
          )
        }
      >
        Immobilie löschen
      </Button>
    </ScrollView>
  );
}
function Editor({ route, navigation }: NativeStackScreenProps<Stack, 'Editor'>) {
  const p = route.params?.property;
  const { reload } = usePortfolio();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState({
    title: p?.title ?? '',
    address: p?.address ?? '',
    country: p?.country ?? 'AT',
    latitude: p ? String(p.latitude) : '',
    longitude: p ? String(p.longitude) : '',
    purchasePrice: p ? String(p.purchasePrice) : '',
    marketValue: p ? String(p.marketValue) : '',
    area: p ? String(p.area) : '',
    yearBuilt: p?.yearBuilt ? String(p.yearBuilt) : '',
    amenities: p?.amenities.join(', ') ?? '',
    notes: p?.notes ?? '',
  });
  const [type, setType] = useState(p?.type ?? 'apartment');
  const [currency, setCurrency] = useState(p?.currency ?? 'EUR');
  const [condition, setCondition] = useState(p?.condition ?? 'good');
  const latitude = Number(values.latitude.replace(',', '.'));
  const longitude = Number(values.longitude.replace(',', '.'));
  const position =
    values.latitude.trim() &&
    values.longitude.trim() &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
      ? { latitude, longitude }
      : null;
  const submit = async () => {
    setError('');
    if (
      ['latitude', 'longitude', 'purchasePrice', 'marketValue', 'area'].some(
        (k) => !values[k as keyof typeof values].trim(),
      )
    ) {
      setError(
        'Bitte Preis und Fläche ausfüllen und einen Adressvorschlag auswählen oder den Pin setzen.',
      );
      return;
    }
    const num = (v: string) => Number(v.replace(',', '.'));
    const input = propertyInputSchema.safeParse({
      ...values,
      latitude: num(values.latitude),
      longitude: num(values.longitude),
      purchasePrice: num(values.purchasePrice),
      marketValue: num(values.marketValue),
      area: num(values.area),
      yearBuilt: values.yearBuilt ? num(values.yearBuilt) : null,
      amenities: values.amenities
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
      type,
      currency,
      condition,
      isTestData: p?.isTestData ?? false,
    });
    if (!input.success) {
      setError(input.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      if (p) await api.update(p.id, input.data);
      else await api.create(input.data);
      await reload();
      navigation.goBack();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const fields: {
    key: keyof typeof values;
    label: string;
    number?: boolean;
    multiline?: boolean;
  }[] = [
    { key: 'title', label: 'Bezeichnung' },
    { key: 'address', label: 'Adresse' },
    { key: 'country', label: 'Land (ISO-Code)' },
    { key: 'latitude', label: 'Breitengrad', number: true },
    { key: 'longitude', label: 'Längengrad', number: true },
    { key: 'purchasePrice', label: 'Kaufpreis', number: true },
    { key: 'marketValue', label: 'Marktwert (eigene Schätzung)', number: true },
    { key: 'area', label: 'Fläche (m²)', number: true },
    { key: 'yearBuilt', label: 'Baujahr (optional)', number: true },
    { key: 'amenities', label: 'Ausstattung (mit Komma trennen)' },
    { key: 'notes', label: 'Notizen', multiline: true },
  ];
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {fields.map((f) =>
          f.key === 'address' ? (
            <AddressPicker
              key={f.key}
              api={api}
              value={values.address}
              position={position}
              onChange={(address) =>
                setValues((current) => ({ ...current, address, latitude: '', longitude: '' }))
              }
              onSelect={(result) =>
                setValues((current) => ({
                  ...current,
                  address: result.address,
                  country: result.country,
                  latitude: String(result.latitude),
                  longitude: String(result.longitude),
                }))
              }
              onPositionChange={(point) =>
                setValues((current) => ({
                  ...current,
                  latitude: point.latitude.toFixed(7),
                  longitude: point.longitude.toFixed(7),
                }))
              }
            />
          ) : (
            <Field
              key={f.key}
              label={f.label}
              value={values[f.key]}
              number={f.number}
              multiline={f.multiline}
              onChange={(v) => setValues((current) => ({ ...current, [f.key]: v }))}
            />
          ),
        )}
        <Choices
          label="Immobilienart"
          values={propertyTypes}
          value={type}
          onChange={setType}
          labels={propertyTypeLabels}
        />
        <Choices label="Währung" values={currencies} value={currency} onChange={setCurrency} />
        <Choices
          label="Zustand"
          values={conditions}
          value={condition}
          onChange={setCondition}
          labels={conditionLabels}
        />
        <ErrorText error={error} />
        <Button disabled={busy} onPress={submit}>
          {busy ? 'Wird gespeichert …' : 'Immobilie speichern'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f3' },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f4f7f3',
  },
  content: { padding: 22, paddingBottom: 45, gap: 12 },
  auth: { padding: 28, paddingTop: 45, gap: 14 },
  brand: { fontSize: 26, fontWeight: '800', color: '#24483c', letterSpacing: -1 },
  eyebrow: { fontSize: 10, color: '#739982', fontWeight: '700', letterSpacing: 1.6, marginTop: 14 },
  title: { fontSize: 29, fontWeight: '700', color: '#253e32', letterSpacing: -1, marginBottom: 3 },
  authTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#253e32',
    letterSpacing: -1,
    marginTop: 18,
  },
  subtitle: { fontSize: 12, color: '#8b9d8b', lineHeight: 20 },
  label: { fontSize: 11, color: '#637f67', fontWeight: '600', marginBottom: 8 },
  field: { marginTop: 8 },
  input: {
    backgroundColor: '#fff',
    borderColor: '#dce5d7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 13,
    color: '#365a40',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#14836f',
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce6d5' },
  buttonText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  error: {
    fontSize: 12,
    color: '#a35349',
    backgroundColor: '#fff0eb',
    padding: 13,
    borderRadius: 7,
    lineHeight: 19,
  },
  footnote: { fontSize: 10, color: '#9eac96', lineHeight: 17 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { fontSize: 11, fontWeight: '600', color: '#14836f' },
  valueCard: {
    backgroundColor: '#eaf3e7',
    borderWidth: 1,
    borderColor: '#d5e5cd',
    padding: 22,
    borderRadius: 12,
    marginTop: 12,
    gap: 9,
  },
  largeValue: { fontSize: 30, fontWeight: '700', letterSpacing: -1, color: '#356448' },
  gain: { fontSize: 11, color: '#559263', fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 7 },
  smallStat: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e4eadd',
    padding: 15,
    borderRadius: 9,
    gap: 9,
  },
  statNumber: { fontSize: 24, fontWeight: '700', color: '#45613e' },
  statLabel: { fontSize: 9, color: '#9ca98f' },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#3d5a36',
    marginTop: 19,
    marginBottom: 2,
  },
  propertyCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e9d8',
    padding: 18,
    borderRadius: 10,
    gap: 9,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardCategory: { fontSize: 10, color: '#92a285', fontWeight: '600', letterSpacing: 0.5 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#3c5932' },
  cardBottom: {
    borderTopWidth: 1,
    borderTopColor: '#eff2e8',
    paddingTop: 12,
    marginTop: 4,
    gap: 5,
  },
  cardValue: { fontSize: 21, fontWeight: '700', color: '#517641', letterSpacing: -0.5 },
  testBadge: {
    fontSize: 8,
    color: '#9d9e5c',
    backgroundColor: '#f3f1dc',
    padding: 5,
    borderRadius: 4,
  },
  testNotice: {
    fontSize: 10,
    lineHeight: 17,
    padding: 12,
    backgroundColor: '#f6f4e4',
    color: '#9b9a64',
    borderRadius: 7,
  },
  research: {
    padding: 18,
    backgroundColor: '#edf2e4',
    borderRadius: 9,
    gap: 10,
    color: '#8c9b77',
    fontSize: 12,
    lineHeight: 20,
  },
  empty: {
    padding: 22,
    backgroundColor: '#fff',
    borderRadius: 9,
    gap: 14,
    color: '#94a184',
    fontSize: 13,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dfe6d5',
    backgroundColor: '#fff',
  },
  activeChip: { backgroundColor: '#14836f', borderColor: '#14836f' },
  chipText: { fontSize: 11, color: '#8b9e7b' },
  cluster: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#14836f',
    borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapCaption: {
    fontSize: 10,
    color: '#7f9770',
    backgroundColor: '#fff',
    padding: 12,
    textAlign: 'center',
  },
  detailText: { color: '#8a9c78', fontSize: 12, lineHeight: 20 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8d7',
  },
  twoButtons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  photo: { width: '100%', height: 210, borderRadius: 7 },
});
