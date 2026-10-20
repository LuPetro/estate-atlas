import React, {
  useState,
  useEffect,
  useMemo,
  createContext,
  useContext,
  useCallback,
  useRef,
} from 'react';
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
  usePreventRemove,
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
import AccountScreen, { RecoveryScreen } from './AccountScreen';
import AnalysisPanel from './AnalysisPanel';
import ValueHistory from './ValueHistory';
import PortfolioValues from './PortfolioValues';
import WorkspaceHub from './WorkspaceHub';
import PropertyWorkspace from './PropertyWorkspace';
import PropertySharing from './PropertySharing';
import { Card, Action, ui, palette } from './WorkspaceUI';
import {
  PortfolioFilters,
  Chips,
  DashboardCustomize,
  useDashboardWidgets,
  emptyFilters,
  filteredPortfolio,
} from './PortfolioTools';
import { mapTheme } from './mapTheme';
import SimpleMap, { MapModeControl } from './SimpleMap';
import {
  portfolioStats,
  formatMoney,
  clusterProperties,
  propertyInputSchema,
  propertyTypeLabels,
  propertyTypes,
  currencies,
  conditions,
  conditionLabels,
  rentalSummary,
  type Property,
  type PropertyInput,
  type PropertyDetail,
  type User,
  type Asset,
} from '@estate-atlas/shared';
let token: string | null = null;
const api = new ApiClient(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000', () => token);
type Tabs = {
  Overview: undefined;
  Properties: undefined;
  Map: undefined;
  Values: undefined;
  Workspace: undefined;
};
type Stack = {
  Account: undefined;
  Home: NavigatorScreenParams<Tabs> | undefined;
  Detail: { id: string; tab?: 'documents' };
  Editor: { property?: Property } | undefined;
};
const RootStack = createNativeStackNavigator<Stack>();
const Tab = createBottomTabNavigator<Tabs>();
type State = {
  user: User;
  onUser: (user: User) => void;
  exit: () => Promise<void>;
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
      <Text style={[styles.buttonText, secondary && { color: '#146F68' }]}>{children}</Text>
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
  const accountEpoch = useRef(0);
  const [user, setUser] = useState<User | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const reload = async () => {
    const epoch = accountEpoch.current;
    const result = await api.properties();
    if (epoch === accountEpoch.current) setProperties(result);
  };
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
          setUser(null);
          setProperties([]);
          await SecureStore.deleteItemAsync('estateatlas-session');
        } else {
          setError(message(e));
          if (e instanceof ApiError && e.status === 403) setNeedsVerification(true);
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);
  const success = async (result: { user: User; token?: string }) => {
    if (!result.token) throw new Error('Die API hat keine native Sitzung geliefert.');
    accountEpoch.current++;
    setProperties([]);
    token = result.token;
    await SecureStore.setItemAsync('estateatlas-session', token);
    setUser(result.user);
    try {
      await reload();
    } catch (e) {
      setError(message(e));
      if (e instanceof ApiError && e.status === 403) setNeedsVerification(true);
    }
  };
  const exit = async () => {
    accountEpoch.current++;
    await SecureStore.deleteItemAsync('estateatlas-session');
    token = null;
    setUser(null);
    setProperties([]);
    setNeedsVerification(false);
    setError('');
  };
  const accountSession = token;
  const updateUser = (u: User) => {
    if (!accountSession || token !== accountSession || user?.id !== u.id) return;
    setUser((current) => (current?.id === u.id ? u : current));
    if (needsVerification && u.emailVerifiedAt) {
      setNeedsVerification(false);
      setError('');
      void reload().catch((e) => setError(message(e)));
    }
  };
  const logout = async () => {
    try {
      await api.logout();
    } finally {
      await exit();
    }
  };
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {!ready ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#146F68" />
          <Text style={styles.subtitle}>EstateAtlas wird geladen …</Text>
        </View>
      ) : !user ? (
        <Auth onSuccess={success} initialError={error} />
      ) : (
        <PortfolioContext.Provider
          value={{ user, properties, reload, logout, onUser: updateUser, exit }}
        >
          <NavigationContainer>
            <RootStack.Navigator
              key={needsVerification ? 'verification' : 'portfolio'}
              initialRouteName={needsVerification ? 'Account' : 'Home'}
              screenOptions={{
                headerStyle: { backgroundColor: '#F6F5F1' },
                headerTintColor: '#172B36',
                headerShadowVisible: false,
                contentStyle: { backgroundColor: '#F6F5F1' },
              }}
            >
              <RootStack.Screen
                name="Account"
                component={Account}
                options={{ title: 'Mein Konto' }}
              />
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
function Account() {
  const { onUser, exit, logout } = usePortfolio();
  return <AccountScreen api={api} onUser={onUser} onExit={exit} onLogout={logout} />;
}
function Auth({
  onSuccess,
  initialError,
}: {
  onSuccess: (result: { user: User; token?: string }) => Promise<void>;
  initialError: string;
}) {
  const [register, setRegister] = useState(false);
  const [recover, setRecover] = useState(false);
  const [code, setCode] = useState('');
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
        : await api.login({ email, password, code });
      await onSuccess(result);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  if (recover) return <RecoveryScreen api={api} onBack={() => setRecover(false)} />;
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
          {!register && (
            <>
              <Field
                label="Authenticator-Code (falls eingerichtet)"
                value={code}
                onChange={setCode}
              />
              <Text style={ui.note}>
                Nur nötig, wenn du Zwei-Faktor aktiviert hast. Nimm den aktuellen Code aus deiner
                Authenticator-App oder einen gespeicherten Wiederherstellungscode.
              </Text>
            </>
          )}
          <ErrorText error={error} />
          <Button disabled={busy} onPress={submit}>
            {busy ? 'Bitte warten …' : register ? 'Konto erstellen' : 'Anmelden'}
          </Button>
          <Button secondary onPress={() => setRecover(true)}>
            Passwort vergessen / E-Mail bestätigen
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
        tabBarActiveTintColor: '#146F68',
        tabBarInactiveTintColor: '#8a9d8f',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#E1E5E4' },
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
        name="Values"
        component={ValuesScreen}
        options={{
          title: 'Werte',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 21 }}>↗</Text>,
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
      <Tab.Screen
        name="Workspace"
        component={WorkspaceScreen}
        options={{
          title: 'Mehr',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>⋯</Text>,
        }}
      />
    </Tab.Navigator>
  );
}
function WorkspaceScreen({ navigation }: BottomTabScreenProps<Tabs, 'Workspace'>) {
  const { properties, reload } = usePortfolio();
  return (
    <WorkspaceHub
      properties={properties}
      api={api}
      reload={reload}
      onSelect={(id, tab) => navigation.getParent()?.navigate('Detail', { id, tab })}
    />
  );
}
function ValuesScreen({ navigation }: BottomTabScreenProps<Tabs, 'Values'>) {
  const { properties, reload } = usePortfolio();
  return (
    <PortfolioValues
      properties={properties}
      api={api}
      reload={reload}
      onSelect={(id) => navigation.getParent()?.navigate('Detail', { id })}
    />
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
        {p.access && p.access !== 'owner' && (
          <Text style={styles.testBadge}>
            {p.access === 'editor' ? 'GETEILT · BEARBEITEN' : 'GETEILT · ANSEHEN'}
          </Text>
        )}
      </View>
      <Text style={styles.cardTitle}>{p.title}</Text>
      <Text style={styles.subtitle}>{p.address}</Text>
      <Text style={styles.subtitle}>
        {rentalSummary(p.rental).label}
        {rentalSummary(p.rental).period ? ` · ${rentalSummary(p.rental).period}` : ''}
      </Text>
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
  const [filters, setFilters] = useState(emptyFilters);
  const { widgets, toggle, storageError } = useDashboardWidgets(user.id);
  const [dashboardRegion, setDashboardRegion] = useState<Region>({
    latitude: 35,
    longitude: 0,
    latitudeDelta: 100,
    longitudeDelta: 360,
  });
  const filtered = filteredPortfolio(properties, filters);
  const stats = portfolioStats(filtered);
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
        <Action secondary onPress={() => navigation.getParent()?.navigate('Account')}>
          Mein Konto & Sicherheit
        </Action>
        <Text style={styles.eyebrow}>DEIN IMMOBILIENPORTFOLIO</Text>
        <Text style={styles.title}>Dein Portfolio.</Text>
        <Text style={styles.subtitle}>Hallo {user.name}. Deine Immobilien im Überblick.</Text>
        <ErrorText error={error} />
        {properties.some((p) => p.isTestData) && (
          <Text style={styles.testNotice}>
            TESTDATEN · Synthetische Objekte und Werte. Keine Marktanalyse.
          </Text>
        )}
        <PortfolioFilters properties={properties} filters={filters} onChange={setFilters} />
        <DashboardCustomize widgets={widgets} toggle={toggle} />
        {!!storageError && <Text style={styles.subtitle}>{storageError}</Text>}
        {widgets.metrics &&
          stats.byCurrency.map((s) => (
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
        {widgets.metrics && (
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
        )}
        {widgets.map && (
          <View style={styles.research}>
            <Text style={styles.sectionTitle}>Dein Portfolio auf der Karte</Text>
            <View style={{ height: 240 }}>
              <SimpleMap
                region={dashboardRegion}
                onRegionChange={setDashboardRegion}
                points={filtered.map((p) => ({
                  id: p.id,
                  title: p.title,
                  latitude: p.latitude,
                  longitude: p.longitude,
                }))}
                onPressPoint={(id) => root?.navigate('Detail', { id })}
              />
            </View>
          </View>
        )}
        {widgets.insights && (
          <View style={styles.research}>
            <Text style={styles.sectionTitle}>Werte & Verteilung</Text>
            {stats.byCurrency.map((c) => (
              <View key={c.currency}>
                <Text style={styles.cardTitle}>
                  {c.currency}: {formatMoney(c.gain, c.currency)} gegenüber Kaufpreis
                </Text>
                {propertyTypes.map((t) => (
                  <Text key={t} style={styles.subtitle}>
                    {propertyTypeLabels[t]} ·{' '}
                    {filtered.filter((p) => p.currency === c.currency && p.type === t).length}{' '}
                    Immobilien
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}
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
        {widgets.properties && (
          <>
            <Text style={styles.sectionTitle}>Deine Immobilien</Text>
            {filtered
              .filter((p) => !p.archivedAt)
              .slice(0, 5)
              .map((p) => (
                <PropertyCard
                  key={p.id}
                  property={p}
                  onPress={() => root?.navigate('Detail', { id: p.id })}
                />
              ))}
            {!filtered.length && (
              <Text style={styles.subtitle}>Keine Immobilien passen zu dieser Auswahl.</Text>
            )}
          </>
        )}
        <View style={styles.research}>
          <Text style={styles.cardTitle}>Marktpreis recherchieren</Text>
          <Text style={styles.subtitle}>
            Öffne eine Immobilie, um Vergleichsangebote und Quellen zu recherchieren.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
function Properties({ navigation }: BottomTabScreenProps<Tabs, 'Properties'>) {
  const { properties, reload } = usePortfolio();
  const [scope, setScope] = useState('own');
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [type, setType] = useState('');
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const items = filteredPortfolio(
    properties,
    { ...emptyFilters, scope, query, country: country.trim().toUpperCase(), type },
    archived,
  );
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
        <Text style={styles.title}>Deine Immobilien.</Text>
        <Chips
          label="Bestand"
          value={scope}
          onChange={setScope}
          values={[
            { value: 'own', label: 'Meine Immobilien' },
            { value: 'shared', label: 'Geteilt mit mir' },
            { value: 'all', label: 'Alle zugänglichen' },
          ]}
        />
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
  const [scope, setScope] = useState('own');
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [type, setType] = useState('');
  const [region, setRegion] = useState<Region>({
    latitude: 35,
    longitude: 0,
    latitudeDelta: 100,
    longitudeDelta: 360,
  });
  const map = React.useRef<MapView>(null);
  const [detail, setDetail] = useState(false);
  const items = useMemo(
    () =>
      filteredPortfolio(properties, {
        ...emptyFilters,
        scope,
        query,
        country: country.trim().toUpperCase(),
        type,
      }),
    [properties, query, country, type, scope],
  );
  const clusters = clusterProperties(items, Math.log2(360 / Math.max(0.01, region.longitudeDelta)));
  const selectCluster = (key: string) => {
    const cluster = clusters.find((item) => item.key === key);
    if (!cluster) return;
    if (cluster.items.length === 1)
      navigation.getParent()?.navigate('Detail', { id: cluster.items[0].id });
    else {
      const expandDetails = !detail && region.longitudeDelta <= 360 / 64;
      if (expandDetails) setDetail(true);
      const next = {
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        latitudeDelta: expandDetails ? 0.008 : region.latitudeDelta * 0.45,
        longitudeDelta: expandDetails
          ? 0.01
          : Math.max(detail ? 0.01 : 360 / 64, region.longitudeDelta * 0.45),
      };
      setRegion(next);
      map.current?.animateToRegion(next, 350);
    }
  };
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={{ padding: 22, paddingBottom: 8 }}>
        <Text style={styles.eyebrow}>DEINE WELT</Text>
        <Text style={styles.title}>Deine Welt.</Text>
        <Chips
          label="Bestand"
          value={scope}
          onChange={setScope}
          values={[
            { value: 'own', label: 'Meine Immobilien' },
            { value: 'shared', label: 'Geteilt mit mir' },
            { value: 'all', label: 'Alle zugänglichen' },
          ]}
        />
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
      <View style={{ flex: 1 }}>
        {!detail ? (
          <SimpleMap
            region={region}
            onRegionChange={setRegion}
            points={clusters.map((c) => ({
              id: c.key,
              title: c.items.length === 1 ? c.items[0].title : `${c.items.length} Immobilien`,
              latitude: c.latitude,
              longitude: c.longitude,
              count: c.items.length,
            }))}
            onPressPoint={selectCluster}
          />
        ) : (
          <MapView
            {...mapTheme}
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
                pinColor="#146F68"
                onPress={() => selectCluster(c.key)}
              >
                {c.items.length > 1 && (
                  <View style={styles.cluster}>
                    <Text style={{ color: 'white', fontWeight: '700' }}>{c.items.length}</Text>
                  </View>
                )}
              </Marker>
            ))}
          </MapView>
        )}
        <MapModeControl
          detail={detail}
          onPress={() => {
            if (detail)
              setRegion((previous) => ({
                ...previous,
                longitudeDelta: Math.max(360 / 64, previous.longitudeDelta),
              }));
            setDetail(!detail);
          }}
        />
      </View>
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
  const [tab, setTab] = useState<string>(route.params.tab ?? 'overview');
  const [workspaceDirty, setWorkspaceDirty] = useState(false);
  const [deleted, setDeleted] = useState(false);
  usePreventRemove(workspaceDirty && !deleted, ({ data }) => {
    Alert.alert(
      'Ungespeicherte Änderungen',
      'Deine Änderungen an Checklisten oder Kaufcheck wurden noch nicht gespeichert.',
      [
        { text: 'Weiter bearbeiten', style: 'cancel' },
        {
          text: 'Verwerfen & verlassen',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });
  useEffect(() => {
    if (deleted) navigation.goBack();
  }, [deleted, navigation]);
  useEffect(() => {
    setTab(route.params.tab ?? 'overview');
  }, [route.params.id, route.params.tab]);
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
        {!error && <ActivityIndicator color={palette.accent} />}
      </View>
    );
  const owner = !p.access || p.access === 'owner';
  const editable = p.access !== 'viewer';
  const tabs = [
    { value: 'overview', label: 'Übersicht' },
    { value: 'values', label: 'Werte' },
    { value: 'documents', label: 'Dokumente' },
    { value: 'checklists', label: 'Übergabe' },
    { value: 'purchase', label: 'Kaufcheck' },
    { value: 'sharing', label: 'Zusammenarbeit' },
  ];
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={ui.eyebrow}>
        {propertyTypeLabels[p.type]} · {p.country}
        {p.isTestData ? ' · TESTDATEN' : ''}
        {p.archivedAt ? ' · ARCHIVIERT' : ''}
      </Text>
      <Text style={styles.title}>{p.title}</Text>
      <Text style={ui.note}>{p.address}</Text>
      {!owner && (
        <Text style={ui.label}>
          Geteilt mit dir · {editable ? 'Bearbeiten erlaubt' : 'Lesezugriff'}
        </Text>
      )}
      <ErrorText error={error} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 24, borderBottomWidth: 1, borderBottomColor: palette.line }}
      >
        {tabs.map((item) => (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.value }}
            onPress={() => setTab(item.value)}
            style={{
              paddingVertical: 14,
              borderBottomWidth: 2,
              borderBottomColor: tab === item.value ? palette.accent : 'transparent',
            }}
          >
            <Text
              style={{
                color: tab === item.value ? palette.ink : palette.muted,
                fontSize: 13,
                fontWeight: tab === item.value ? '700' : '400',
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {workspaceDirty && tab !== 'checklists' && tab !== 'purchase' && (
        <Pressable accessibilityRole="button" onPress={() => setTab('checklists')}>
          <Text style={ui.note}>Ungespeicherte Änderungen im Arbeitsbereich →</Text>
        </Pressable>
      )}
      <View style={{ display: tab === 'overview' ? 'flex' : 'none', gap: 16 }}>
        <Card>
          <Text style={ui.eyebrow}>EIGENER MARKTWERT</Text>
          <Text
            style={styles.largeValue}
            adjustsFontSizeToFit
            numberOfLines={1}
            minimumFontScale={0.6}
          >
            {formatMoney(p.marketValue, p.currency)}
          </Text>
          <Text style={ui.note}>Kaufpreis: {formatMoney(p.purchasePrice, p.currency)}</Text>
          <View style={ui.divider} />
          <View style={ui.row}>
            <Text style={ui.note}>{p.area} m²</Text>
            <Text style={ui.note}>{conditionLabels[p.condition]}</Text>
            <Text style={ui.note}>Baujahr {p.yearBuilt ?? 'offen'}</Text>
          </View>
        </Card>
        <AnalysisPanel
          key={p.id}
          property={p}
          api={api}
          onApplied={async () => {
            await load();
            await reload();
          }}
        />
        <Card title="Objektangaben">
          <Text style={ui.label}>Vermietung</Text>
          <Text style={ui.note}>
            {rentalSummary(p.rental).label}
            {rentalSummary(p.rental).period ? ` · ${rentalSummary(p.rental).period}` : ''}
          </Text>
          <Text style={ui.label}>Ausstattung</Text>
          <Text style={ui.note}>{p.amenities.join(', ') || 'Nicht angegeben'}</Text>
          <Text style={ui.label}>Position</Text>
          <Text style={ui.note}>
            {p.latitude}, {p.longitude}
          </Text>
          {!!p.notes && (
            <>
              <Text style={ui.label}>Notizen</Text>
              <Text style={ui.note}>{p.notes}</Text>
            </>
          )}
          {editable && (
            <Action secondary onPress={() => navigation.navigate('Editor', { property: p })}>
              Immobilie bearbeiten
            </Action>
          )}
        </Card>
        {owner && (
          <Card title="Immobilie verwalten">
            <Action
              secondary
              disabled={busy}
              onPress={() => act(() => api.archive(p.id, !p.archivedAt))}
            >
              {p.archivedAt ? 'Aus Archiv wiederherstellen' : 'Immobilie archivieren'}
            </Action>
            <Action
              secondary
              danger
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  'Immobilie endgültig löschen?',
                  'Alle Anhänge, Freigaben, Checklisten, die Kaufplanung und Wertangaben werden mitgelöscht.',
                  [
                    { text: 'Abbrechen', style: 'cancel' },
                    {
                      text: 'Löschen',
                      style: 'destructive',
                      onPress: () =>
                        act(async () => {
                          await api.delete(p.id);
                          await reload();
                          setDeleted(true);
                        }, false),
                    },
                  ],
                )
              }
            >
              Immobilie löschen
            </Action>
          </Card>
        )}
      </View>
      <View style={{ display: tab === 'values' ? 'flex' : 'none' }}>
        <ValueHistory key={`${p.id}-${p.currency}`} values={p.valuations} currency={p.currency} />
      </View>
      <View style={{ display: tab === 'documents' ? 'flex' : 'none', gap: 16 }}>
        <Card
          title="Fotos & Dokumente"
          note="Deine Ablage ist freiwillig. Wähle nur Dateien aus, die du hier speichern möchtest. Personen mit Objektzugriff können sie ebenfalls öffnen."
        >
          <Text style={ui.note}>JPEG, PNG, WebP und PDF · bis 10 MB je Datei</Text>
          {editable && (
            <View style={styles.twoButtons}>
              <Button secondary disabled={busy} onPress={photo}>
                Foto wählen
              </Button>
              <Button secondary disabled={busy} onPress={document}>
                PDF wählen
              </Button>
            </View>
          )}
        </Card>
        {!p.assets.length && <Text style={ui.note}>Noch keine Dateien gespeichert.</Text>}
        {p.assets.map((asset) => (
          <Card key={asset.id}>
            {asset.mimeType.startsWith('image/') && (
              <Image
                source={{
                  uri: api.assetUrl(asset.id),
                  headers: { Authorization: `Bearer ${token}` },
                }}
                style={styles.photo}
                accessibilityLabel={asset.name}
              />
            )}
            <Text style={ui.label}>{asset.name}</Text>
            <Text style={ui.note}>{(asset.size / 1024).toFixed(1)} KB</Text>
            {asset.mimeType === 'application/pdf' && (
              <Action secondary disabled={busy} onPress={() => openDocument(asset)}>
                PDF öffnen / teilen
              </Action>
            )}
            {editable && (
              <Action
                secondary
                danger
                disabled={busy}
                onPress={() =>
                  Alert.alert('Anhang löschen?', asset.name, [
                    { text: 'Abbrechen', style: 'cancel' },
                    {
                      text: 'Löschen',
                      style: 'destructive',
                      onPress: () => act(() => api.deleteAsset(asset.id)),
                    },
                  ])
                }
              >
                Anhang löschen
              </Action>
            )}
          </Card>
        ))}
      </View>
      <PropertyWorkspace
        key={p.id}
        property={p}
        api={api}
        section={tab}
        onDirtyChange={setWorkspaceDirty}
      />
      <View style={{ display: tab === 'sharing' ? 'flex' : 'none' }}>
        <PropertySharing key={p.id} property={p} api={api} />
      </View>
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
  const [rentalStatus, setRentalStatus] = useState<'unknown' | 'vacant' | 'rented'>(
    p?.rental?.status ?? 'unknown',
  );
  const [rentalStart, setRentalStart] = useState(p?.rental?.start ?? '');
  const [rentalEnd, setRentalEnd] = useState(p?.rental?.end ?? '');
  const [unlimited, setUnlimited] = useState(!p?.rental?.end);
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
      rental:
        rentalStatus === 'unknown'
          ? null
          : rentalStatus === 'vacant'
            ? { status: 'vacant', start: null, end: null }
            : { status: 'rented', start: rentalStart, end: unlimited ? null : rentalEnd },
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
        <Choices
          label="Vermietungsstatus"
          values={['unknown', 'vacant', 'rented'] as const}
          value={rentalStatus}
          onChange={setRentalStatus}
          labels={{ unknown: 'Nicht angegeben', vacant: 'Nicht vermietet', rented: 'Vermietet' }}
        />
        {rentalStatus === 'rented' && (
          <>
            <Field
              label="Mietbeginn (JJJJ-MM-TT)"
              value={rentalStart}
              onChange={setRentalStart}
              number
            />
            <Choices
              label="Mietdauer"
              values={['unlimited', 'fixed'] as const}
              value={unlimited ? 'unlimited' : 'fixed'}
              onChange={(v) => setUnlimited(v === 'unlimited')}
              labels={{ unlimited: 'Unbefristet', fixed: 'Befristet' }}
            />
            {!unlimited && (
              <Field
                label="Mietende (JJJJ-MM-TT)"
                value={rentalEnd}
                onChange={setRentalEnd}
                number
              />
            )}
            <Text style={styles.footnote}>
              Datum z. B. 2026-10-11. Zukünftige und abgelaufene Mietzeiträume werden entsprechend
              gekennzeichnet.
            </Text>
          </>
        )}
        <ErrorText error={error} />
        <Button disabled={busy} onPress={submit}>
          {busy ? 'Wird gespeichert …' : 'Immobilie speichern'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F5F1' },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F6F5F1',
  },
  content: { padding: 22, paddingBottom: 45, gap: 12 },
  auth: { padding: 28, paddingTop: 45, gap: 14 },
  brand: { fontSize: 26, fontWeight: '800', color: '#172B36', letterSpacing: -1 },
  eyebrow: { fontSize: 11, color: '#739982', fontWeight: '700', letterSpacing: 1.6, marginTop: 14 },
  title: { fontSize: 29, fontWeight: '700', color: '#172B36', letterSpacing: -1, marginBottom: 3 },
  authTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#172B36',
    letterSpacing: -1,
    marginTop: 18,
  },
  subtitle: { fontSize: 13, color: '#627580', lineHeight: 20 },
  label: { fontSize: 11, color: '#627580', fontWeight: '600', marginBottom: 8 },
  field: { marginTop: 8 },
  input: {
    backgroundColor: '#fff',
    borderColor: '#E1E5E4',
    borderWidth: 1,
    borderRadius: 8,
    padding: 13,
    color: '#172B36',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#146F68',
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E1E5E4' },
  buttonText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  error: {
    fontSize: 12,
    color: '#a35349',
    backgroundColor: '#fff0eb',
    padding: 13,
    borderRadius: 7,
    lineHeight: 19,
  },
  footnote: { fontSize: 11, color: '#627580', lineHeight: 17 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { fontSize: 11, fontWeight: '600', color: '#146F68' },
  valueCard: {
    backgroundColor: '#EEF3F1',
    borderWidth: 1,
    borderColor: '#E1E5E4',
    padding: 22,
    borderRadius: 12,
    marginTop: 12,
    gap: 9,
  },
  largeValue: { fontSize: 30, fontWeight: '700', letterSpacing: -1, color: '#172B36' },
  gain: { fontSize: 11, color: '#146F68', fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 7 },
  smallStat: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E1E5E4',
    padding: 15,
    borderRadius: 9,
    gap: 9,
  },
  statNumber: { fontSize: 24, fontWeight: '700', color: '#172B36' },
  statLabel: { fontSize: 9, color: '#627580' },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#172B36',
    marginTop: 19,
    marginBottom: 2,
  },
  propertyCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E1E5E4',
    padding: 18,
    borderRadius: 16,
    gap: 9,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardCategory: { fontSize: 11, color: '#627580', fontWeight: '600', letterSpacing: 0.5 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#172B36' },
  cardBottom: {
    borderTopWidth: 1,
    borderTopColor: '#eff2e8',
    paddingTop: 12,
    marginTop: 4,
    gap: 5,
  },
  cardValue: { fontSize: 21, fontWeight: '700', color: '#172B36', letterSpacing: -0.5 },
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
    backgroundColor: '#EEF3F1',
    borderRadius: 9,
    gap: 10,
    color: '#627580',
    fontSize: 12,
    lineHeight: 20,
  },
  empty: {
    padding: 22,
    backgroundColor: '#fff',
    borderRadius: 9,
    gap: 14,
    color: '#627580',
    fontSize: 13,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E1E5E4',
    backgroundColor: '#fff',
  },
  activeChip: { backgroundColor: '#146F68', borderColor: '#146F68' },
  chipText: { fontSize: 11, color: '#627580' },
  cluster: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#126555',
    borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapCaption: {
    fontSize: 10,
    color: '#627580',
    backgroundColor: '#fff',
    padding: 12,
    textAlign: 'center',
  },
  detailText: { color: '#627580', fontSize: 12, lineHeight: 20 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E4',
  },
  twoButtons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  photo: { width: '100%', height: 210, borderRadius: 7 },
});
