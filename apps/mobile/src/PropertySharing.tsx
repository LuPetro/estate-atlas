import React, { useEffect, useState } from 'react';
import { View, Text, Alert, Share, TextInput } from 'react-native';
import type { ApiClient } from '@estate-atlas/api-client';
import type { Property, PropertyShares, CreatedPropertyInvitation } from '@estate-atlas/shared';
import { Card, Action, ErrorMessage, ui } from './WorkspaceUI';
import { Chips } from './PortfolioTools';

export default function PropertySharing({ property, api }: { property: Property; api: ApiClient }) {
  const [shares, setShares] = useState<PropertyShares | null>(null);
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [created, setCreated] = useState<CreatedPropertyInvitation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [transferred, setTransferred] = useState(false);
  const owner = !property.access || property.access === 'owner';
  const load = async () => setShares(await api.shares(property.id));
  useEffect(() => {
    if (!owner) return;
    let live = true;
    api
      .shares(property.id)
      .then((value) => {
        if (live) setShares(value);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [api, property.id, owner]);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (transferred)
    return (
      <Card title="Eigentümerschaft übertragen">
        <Text style={ui.note}>
          Du behältst Bearbeitungsrechte. Öffne die Immobilie erneut, um die aktualisierten
          Berechtigungen zu sehen.
        </Text>
      </Card>
    );
  if (!owner)
    return (
      <Card title="Zusammenarbeit">
        <Text style={ui.note}>
          Diese Immobilie wurde mit dir geteilt.{' '}
          {property.access === 'editor'
            ? 'Du kannst Objektangaben, Dokumente, Checklisten und den Kaufcheck bearbeiten.'
            : 'Du kannst Angaben und gespeicherte Unterlagen ansehen.'}{' '}
          Freigaben, Archivierung, Löschen und kostenpflichtige Recherchen verwaltet die
          Eigentümerin oder der Eigentümer.
        </Text>
      </Card>
    );
  return (
    <View style={{ gap: 16 }}>
      <Card
        title="Zusammenarbeit"
        note="Gib einer Vertrauensperson Zugriff auf diese Immobilie. Die Freigabe umfasst auch Fotos, Dokumente, Checklisten und Kaufplanung."
      >
        <Chips
          label="Berechtigung"
          value={role}
          onChange={(v) => {
            if (!busy) setRole(v as typeof role);
          }}
          values={[
            { value: 'viewer', label: 'Ansehen' },
            { value: 'editor', label: 'Bearbeiten' },
          ]}
        />
        <Text style={ui.note}>
          {role === 'editor'
            ? 'Darf Objektangaben und Arbeitsbereich bearbeiten sowie Dateien hochladen und entfernen.'
            : 'Darf Objektangaben, Ergebnisse und Unterlagen lesen.'}{' '}
          Freigaben und kostenpflichtige Recherchen bleiben bei dir.
        </Text>
        <Action
          disabled={busy}
          onPress={() =>
            act(async () => {
              setCreated(await api.createInvitation(property.id, role));
            })
          }
        >
          {busy ? 'Bitte warten …' : 'Einladungscode erstellen'}
        </Action>
        <Text style={ui.note}>
          Einmal verwendbar und 7 Tage gültig. Teile den Code persönlich. Die eingeladene Person
          benötigt ein EstateAtlas-Konto und gibt den Code unter „Mehr → Zusammenarbeit“ ein.
        </Text>
      </Card>
      <ErrorMessage error={error} />
      {created && (
        <Card title="Dein Einladungscode">
          <Text selectable style={[ui.label, { lineHeight: 23 }]}>
            {created.code}
          </Text>
          <Text style={ui.note}>
            {created.role === 'editor' ? 'Bearbeiten' : 'Ansehen'} · gültig bis{' '}
            {new Date(created.expiresAt).toLocaleDateString('de-AT')}
          </Text>
          <Action
            secondary
            onPress={() => {
              void Share.share({
                message: `Ich lade dich zu „${property.title}“ in EstateAtlas ein. Öffne Mehr → Zusammenarbeit und gib diesen einmaligen Code ein: ${created.code}`,
              }).catch((e) => setError(e.message));
            }}
          >
            Code teilen
          </Action>
          <Text style={ui.note}>
            Nach Verlassen der Immobilie wird der Code hier nicht erneut angezeigt. Du kannst
            ungenutzte Einladungen widerrufen.
          </Text>
        </Card>
      )}
      <Card title="Personen mit Zugriff">
        {!shares && !error && <Text style={ui.note}>Freigaben werden geladen …</Text>}
        {shares?.members.length === 0 && (
          <Text style={ui.note}>Du hast diese Immobilie noch mit niemandem geteilt.</Text>
        )}
        {shares?.members.map((member) => (
          <View key={member.userId} style={{ gap: 10 }}>
            <Text style={ui.label}>
              {member.name} · {member.role === 'editor' ? 'Bearbeiten' : 'Ansehen'}
            </Text>
            <Text style={ui.note}>{member.email}</Text>
            <Action
              secondary
              danger
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  'Zugriff entfernen?',
                  `${member.name} kann diese Immobilie und ihre Dateien danach nicht mehr öffnen.`,
                  [
                    { text: 'Abbrechen', style: 'cancel' },
                    {
                      text: 'Entfernen',
                      style: 'destructive',
                      onPress: () => {
                        void act(() => api.revokeShare(property.id, member.userId));
                      },
                    },
                  ],
                )
              }
            >
              Zugriff entfernen
            </Action>
          </View>
        ))}
        {!!error && (
          <Action secondary disabled={busy} onPress={() => act(load)}>
            Freigaben erneut laden
          </Action>
        )}
      </Card>
      {shares?.members.some((m) => m.role === 'editor') && (
        <Card
          title="Eigentümerschaft übertragen"
          note="Die neue Person übernimmt die Immobilie, Dokumente und Freigaben. Du behältst Bearbeitungsrechte. Offene Einladungen werden ungültig."
        >
          <Chips
            label="Neue Eigentümerin / neuer Eigentümer"
            value={transferTo}
            onChange={setTransferTo}
            values={shares.members
              .filter((m) => m.role === 'editor')
              .map((m) => ({ value: m.userId, label: m.name }))}
          />
          <TextInput
            accessibilityLabel="Aktuelles Passwort"
            placeholder="Aktuelles Passwort"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            style={ui.input}
          />
          <TextInput
            accessibilityLabel="Zwei-Faktor-Code"
            placeholder="Zwei-Faktor-Code (falls eingerichtet)"
            value={mfaCode}
            onChangeText={setMfaCode}
            autoCapitalize="none"
            style={ui.input}
          />
          <Action
            secondary
            disabled={busy || !transferTo || !password}
            onPress={() =>
              Alert.alert(
                'Eigentümerschaft übertragen?',
                'Diese Person übernimmt die Kontrolle über diese Immobilie.',
                [
                  { text: 'Abbrechen', style: 'cancel' },
                  {
                    text: 'Übertragen',
                    onPress: () => {
                      void act(async () => {
                        await api.accountPost(`/properties/${property.id}/transfer`, {
                          userId: transferTo,
                          password,
                          code: mfaCode,
                        });
                        setPassword('');
                        setMfaCode('');
                        setTransferred(true);
                      });
                    },
                  },
                ],
              )
            }
          >
            Übertragung bestätigen
          </Action>
        </Card>
      )}
      <Card title="Offene Einladungen">
        {shares?.invitations.length === 0 && (
          <Text style={ui.note}>Keine offenen Einladungen.</Text>
        )}
        {shares?.invitations.map((invitation) => (
          <View key={invitation.id} style={{ gap: 10 }}>
            <Text style={ui.note}>
              {invitation.role === 'editor' ? 'Bearbeiten' : 'Ansehen'} · gültig bis{' '}
              {new Date(invitation.expiresAt).toLocaleDateString('de-AT')}
            </Text>
            <Action
              secondary
              danger
              disabled={busy}
              onPress={() =>
                act(async () => {
                  await api.revokeInvitation(property.id, invitation.id);
                  if (created?.id === invitation.id) setCreated(null);
                })
              }
            >
              Einladung widerrufen
            </Action>
          </View>
        ))}
      </Card>
    </View>
  );
}
