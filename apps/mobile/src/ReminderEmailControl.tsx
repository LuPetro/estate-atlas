import React, { useEffect, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import {
  reminderEmailLabels,
  type ReminderEmailPreference,
  type ReminderEmailStatus,
} from '@estate-atlas/shared';
import { Chips } from './PortfolioTools';
import { Action, ui } from './WorkspaceUI';

export const reminderTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
export function ReminderEmailDays({
  days,
  onChange,
}: {
  days: 0 | 1 | 3 | 7;
  onChange: (days: 0 | 1 | 3 | 7) => void;
}) {
  return (
    <Chips
      label="E-Mail-Zeitpunkt"
      value={String(days)}
      onChange={(value) => onChange(Number(value) as 0 | 1 | 3 | 7)}
      values={[
        { value: '0', label: 'Am Fälligkeitstag' },
        { value: '1', label: '1 Tag vorher' },
        { value: '3', label: '3 Tage vorher' },
        { value: '7', label: '7 Tage vorher' },
      ]}
    />
  );
}
export default function ReminderEmailControl({
  notification,
  available,
  disabled,
  onChange,
}: {
  notification: ReminderEmailStatus | null | undefined;
  available: boolean;
  disabled: boolean;
  onChange: (input: ReminderEmailPreference | null) => void;
}) {
  const [days, setDays] = useState<0 | 1 | 3 | 7>(notification?.daysBefore ?? 1);
  useEffect(() => {
    if (notification) setDays(notification.daysBefore);
  }, [notification?.daysBefore]);
  const active = !!notification && !['expired', 'cancelled'].includes(notification.status);
  const preference = { daysBefore: days, timeZone: notification?.timeZone ?? reminderTimeZone() };
  return (
    <View style={{ gap: 9 }}>
      <View style={ui.row}>
        <Text style={ui.label}>E-Mail für mich</Text>
        <Switch
          accessibilityLabel="E-Mail für mich"
          value={active}
          disabled={disabled || (!available && !active)}
          onValueChange={(value) => onChange(value ? preference : null)}
        />
      </View>
      {notification && (
        <Text style={ui.note}>
          {reminderEmailLabels[notification.status]}
          {notification.sentAt ? ` · ${new Date(notification.sentAt).toLocaleString('de-AT')}` : ''}
        </Text>
      )}
      {!active && available && <ReminderEmailDays days={days} onChange={setDays} />}
      {active && (
        <Text style={ui.note}>
          {notification.daysBefore === 0
            ? 'Am Fälligkeitstag'
            : `${notification.daysBefore} Tag${notification.daysBefore === 1 ? '' : 'e'} vorher`}{' '}
          · 09:00 Uhr ({notification.timeZone})
        </Text>
      )}
      {notification && ['failed', 'unknown'].includes(notification.status) && available && (
        <Action
          disabled={disabled}
          secondary
          onPress={() => {
            if (notification.status === 'unknown')
              Alert.alert(
                'Versandstatus unklar',
                'Die E-Mail wurde möglicherweise zugestellt. Bitte zuerst dein Postfach prüfen.',
                [
                  { text: 'Abbrechen', style: 'cancel' },
                  { text: 'Erneut vormerken', onPress: () => onChange(preference) },
                ],
              );
            else onChange(preference);
          }}
        >
          Erneut vormerken
        </Action>
      )}
    </View>
  );
}
