import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ApiClient } from '@estate-atlas/api-client';
import type { AccountInfo, AccountSession, AccountConfig, User } from '@estate-atlas/shared';
import { Card, Action, Input, ErrorMessage, ui, palette } from './WorkspaceUI';
export default function AccountScreen({
  api,
  onUser,
  onExit,
}: {
  api: ApiClient;
  onUser: (u: User) => void;
  onExit: () => Promise<void>;
}) {
  const [account, setAccount] = useState<AccountInfo | null>(null),
    [config, setConfig] = useState<AccountConfig | null>(null),
    [sessions, setSessions] = useState<AccountSession[]>([]);
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [newPassword, setNewPassword] = useState(''),
    [code, setCode] = useState(''),
    [confirmation, setConfirmation] = useState('');
  const [secret, setSecret] = useState(''),
    [codes, setCodes] = useState<string[]>([]),
    [linkCode, setLinkCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  async function reload() {
    const [a, c, s] = await Promise.all([api.account(), api.accountConfig(), api.sessions()]);
    setAccount(a);
    setConfig(c);
    setSessions(s);
    setName(a.name);
    onUser(a);
  }
  useEffect(() => {
    void reload().catch((e) => setError(e.message));
  }, []);
  async function run(fn: () => Promise<void>) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setPassword('');
      setCode('');
    }
  }
  const security = () => ({ password, code });
  async function post(path: string, data: unknown, exit = false) {
    const result = await api.accountPost(path, data);
    setNotice(result.message);
    if (exit) await onExit();
    else await reload();
  }
  const secureFields = (
    <>
      <View style={{ gap: 7 }}>
        <Text style={ui.label}>Aktuelles Passwort für sensible Aktionen</Text>
        <TextInput
          accessibilityLabel="Aktuelles Passwort"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          autoCapitalize="none"
          style={ui.input}
          maxLength={128}
        />
      </View>
      {account?.mfaEnabled && (
        <Input label="Zwei-Faktor- oder Wiederherstellungscode" value={code} onChange={setCode} />
      )}
    </>
  );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 20 }}
      >
        <Text style={ui.eyebrow}>DEIN KONTO</Text>
        <Text style={ui.heading}>Persönlich. Sicher.</Text>
        <ErrorMessage error={error} />
        {!!notice && (
          <Text accessibilityRole="alert" style={ui.note}>
            {notice}
          </Text>
        )}
        {!account ? (
          <Text style={ui.note}>Konto wird geladen …</Text>
        ) : (
          <>
            <Card title="Profil">
              <Input label="Dein Name" value={name} onChange={setName} />
              <Text style={ui.note}>
                {account.email} · {account.emailVerifiedAt ? 'Bestätigt' : 'Noch nicht bestätigt'}
              </Text>
              <Action
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    const a = await api.profile(name);
                    setAccount(a);
                    onUser(a);
                    setNotice('Profil gespeichert.');
                  })
                }
              >
                Profil speichern
              </Action>
            </Card>
            <Card
              title="E-Mail-Adresse"
              note={
                !config?.mailEnabled
                  ? 'E-Mail-Funktionen sind in dieser Testversion noch nicht verfügbar.'
                  : undefined
              }
            >
              {!account.emailVerifiedAt && (
                <Action
                  secondary
                  disabled={busy || !config?.mailEnabled}
                  onPress={() => run(() => post('/account/resend-verification', {}))}
                >
                  Bestätigung erneut senden
                </Action>
              )}
              {account.pendingEmail && (
                <Text style={ui.note}>Bestätigung ausstehend: {account.pendingEmail}</Text>
              )}
              <Input
                label="Neue E-Mail-Adresse"
                value={email}
                onChange={setEmail}
                keyboardType="email-address"
              />
              <Text style={ui.note}>Die bisherige Adresse bleibt bis zur Bestätigung aktiv.</Text>
              <Action
                secondary
                disabled={busy || !config?.mailEnabled}
                onPress={() => run(() => post('/account/email', { ...security(), email }))}
              >
                Neue Adresse bestätigen
              </Action>
              <Input label="Linkcode aus deiner E-Mail" value={linkCode} onChange={setLinkCode} />
              <Action
                secondary
                disabled={busy || !linkCode}
                onPress={() =>
                  run(async () => {
                    const r = await api.verifyEmail(linkCode);
                    setNotice(r.message);
                    setLinkCode('');
                    await reload();
                  })
                }
              >
                E-Mail bestätigen
              </Action>
            </Card>
            <Card
              title="Sensible Aktionen"
              note="Passwort und gegebenenfalls Zwei-Faktor-Code werden für Änderungen, Export und Kontolöschung benötigt."
            >
              {secureFields}
            </Card>
            <Card title="Passwort ändern">
              <View style={{ gap: 7 }}>
                <Text style={ui.label}>Neues Passwort · mindestens 12 Zeichen</Text>
                <TextInput
                  accessibilityLabel="Neues Passwort"
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  style={ui.input}
                  maxLength={128}
                />
              </View>
              <Text style={ui.note}>Alle Sitzungen werden danach beendet.</Text>
              <Action
                secondary
                disabled={busy}
                onPress={() =>
                  run(() => post('/account/password', { ...security(), newPassword }, true))
                }
              >
                Passwort ändern
              </Action>
            </Card>
            <Card title="Zwei-Faktor-Anmeldung">
              <Text style={ui.note}>
                {account.mfaEnabled
                  ? 'Aktiv.'
                  : 'Verbinde eine Authenticator-App über die manuelle Schlüsseleingabe.'}
              </Text>
              {!secret && (
                <Action
                  disabled={busy || !config?.mfaAvailable}
                  onPress={() =>
                    run(async () => {
                      const r = await api.accountPost<{ secret: string }>(
                        '/account/mfa/setup',
                        security(),
                      );
                      setSecret(r.secret);
                    })
                  }
                >
                  {account.mfaEnabled ? 'Authenticator wechseln' : 'Authenticator verbinden'}
                </Action>
              )}
              {!!secret && (
                <>
                  <Text selectable style={ui.label}>
                    {secret}
                  </Text>
                  <Input
                    label="Sechsstelliger Authenticator-Code"
                    value={code}
                    onChange={setCode}
                    keyboardType="number-pad"
                  />
                  <Action
                    disabled={busy}
                    onPress={() =>
                      run(async () => {
                        const r = await api.accountPost<{ recoveryCodes: string[] }>(
                          '/account/mfa/confirm',
                          { code },
                        );
                        setCodes(r.recoveryCodes);
                        setSecret('');
                        await reload();
                      })
                    }
                  >
                    Einrichtung bestätigen
                  </Action>
                </>
              )}
              {codes.length > 0 && (
                <>
                  <Text style={ui.note}>
                    Diese einmal verwendbaren Wiederherstellungscodes werden nur jetzt angezeigt.
                    Bewahre sie sicher auf.
                  </Text>
                  <Text selectable style={ui.label}>
                    {codes.join('\n')}
                  </Text>
                  <Action secondary onPress={() => setCodes([])}>
                    Sicher gespeichert
                  </Action>
                </>
              )}
              {account.mfaEnabled && account.role === 'user' && (
                <Action
                  secondary
                  disabled={busy}
                  onPress={() => run(() => post('/account/mfa/disable', security(), true))}
                >
                  Zwei-Faktor-Anmeldung deaktivieren
                </Action>
              )}
            </Card>
            <Card title="Aktive Sitzungen">
              {sessions.map((s) => (
                <View
                  key={s.id}
                  style={{
                    gap: 8,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderColor: palette.line,
                  }}
                >
                  <Text style={ui.label}>{s.current ? 'Diese Sitzung' : 'Weitere Sitzung'}</Text>
                  <Text style={ui.note}>
                    {s.userAgent || 'Gerät unbekannt'}\nZuletzt aktiv:{' '}
                    {new Date(s.lastSeenAt).toLocaleString('de-AT')}
                  </Text>
                  <Action
                    secondary
                    disabled={busy}
                    onPress={() =>
                      run(async () => {
                        await api.revokeSession(s.id);
                        if (s.current) await onExit();
                        else await reload();
                      })
                    }
                  >
                    Sitzung beenden
                  </Action>
                </View>
              ))}
              <Action
                secondary
                disabled={busy}
                onPress={() => run(() => post('/account/logout-all', security(), true))}
              >
                Alle Sitzungen beenden
              </Action>
            </Card>
            <Card
              title="Deine Daten exportieren"
              note="Enthält eigene Immobilien, Wertverläufe, Recherchen, Arbeitsbereiche und Dateien als Base64 im JSON-Archiv."
            >
              <Action
                secondary
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    if (!(await Sharing.isAvailableAsync()))
                      throw new Error('Dateifreigabe ist auf diesem Gerät nicht verfügbar.');
                    const data = await api.accountPost<unknown>('/account/export', security());
                    const file = new File(Paths.cache, `estateatlas-export-${Date.now()}.json`);
                    try {
                      file.create();
                      file.write(JSON.stringify(data));
                      await Sharing.shareAsync(file.uri, {
                        mimeType: 'application/json',
                        UTI: 'public.json',
                      });
                    } finally {
                      if (file.exists) file.delete();
                    }
                    setNotice('Export bereitgestellt.');
                  })
                }
              >
                Export speichern oder teilen
              </Action>
            </Card>
            <Card
              title="Konto endgültig löschen"
              note="Eigene Immobilien und ihre Dateien werden gelöscht. Fremde Freigaben bleiben erhalten. Eigene geteilte Immobilien vorher übertragen oder deren Freigaben entfernen."
            >
              <Input
                label="Zur Bestätigung: KONTO LÖSCHEN"
                value={confirmation}
                onChange={setConfirmation}
              />
              <Action
                secondary
                danger
                disabled={busy || confirmation !== 'KONTO LÖSCHEN'}
                onPress={() =>
                  Alert.alert(
                    'Konto endgültig löschen?',
                    'Diese Aktion entfernt dein Konto und deine eigenen Inhalte unwiderruflich.',
                    [
                      { text: 'Abbrechen', style: 'cancel' },
                      {
                        text: 'Endgültig löschen',
                        style: 'destructive',
                        onPress: () => {
                          void run(() =>
                            post('/account/delete', { ...security(), confirmation }, true),
                          );
                        },
                      },
                    ],
                  )
                }
              >
                Konto löschen
              </Action>
            </Card>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function RecoveryScreen({ api, onBack }: { api: ApiClient; onBack: () => void }) {
  const [mode, setMode] = useState('forgot'),
    [email, setEmail] = useState(''),
    [token, setToken] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 24, gap: 20, paddingTop: 60 }}
    >
      <Text style={ui.heading}>
        {mode === 'forgot'
          ? 'Zugang wiederherstellen'
          : mode === 'reset'
            ? 'Neues Passwort'
            : 'E-Mail bestätigen'}
      </Text>
      <ErrorMessage error={error} />
      {!!notice && <Text style={ui.note}>{notice}</Text>}
      <Card>
        {mode === 'forgot' ? (
          <Input
            label="E-Mail-Adresse"
            value={email}
            onChange={setEmail}
            keyboardType="email-address"
          />
        ) : (
          <Input label="Linkcode aus deiner E-Mail" value={token} onChange={setToken} />
        )}{' '}
        {mode === 'reset' && (
          <TextInput
            accessibilityLabel="Neues Passwort"
            placeholder="Neues Passwort · mindestens 12 Zeichen"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            style={ui.input}
          />
        )}
        <Action
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            setError('');
            try {
              const r =
                mode === 'forgot'
                  ? await api.forgotPassword(email)
                  : mode === 'reset'
                    ? await api.resetPassword(token, password)
                    : await api.verifyEmail(token);
              setNotice(r.message);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Bestätigen
        </Action>
        <Action
          secondary
          onPress={() => {
            setMode('reset');
            setNotice('');
          }}
        >
          Reset-Code eingeben
        </Action>
        <Action
          secondary
          onPress={() => {
            setMode('verify');
            setNotice('');
          }}
        >
          E-Mail bestätigen
        </Action>
        <Action secondary onPress={onBack}>
          Zurück zur Anmeldung
        </Action>
      </Card>
    </ScrollView>
  );
}
