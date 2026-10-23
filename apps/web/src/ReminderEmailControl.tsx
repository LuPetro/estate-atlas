'use client';
import { useEffect, useState } from 'react';
import {
  reminderEmailLabels,
  type ReminderEmailPreference,
  type ReminderEmailStatus,
} from '@estate-atlas/shared';

export const reminderTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
export function ReminderEmailFields({
  days,
  onDays,
  disabled = false,
}: {
  days: number;
  onDays: (value: 0 | 1 | 3 | 7) => void;
  disabled?: boolean;
}) {
  return (
    <label className="reminder-email-lead">
      E-Mail-Zeitpunkt
      <select
        aria-label="E-Mail-Zeitpunkt"
        value={days}
        disabled={disabled}
        onChange={(event) => onDays(Number(event.target.value) as 0 | 1 | 3 | 7)}
      >
        <option value={0}>Am Fälligkeitstag</option>
        <option value={1}>1 Tag vorher</option>
        <option value={3}>3 Tage vorher</option>
        <option value={7}>7 Tage vorher</option>
      </select>
    </label>
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
    <div className="reminder-email-control">
      <label className="inline-check">
        <input
          type="checkbox"
          role="switch"
          checked={active}
          disabled={disabled || (!available && !active)}
          onChange={(event) => onChange(event.target.checked ? preference : null)}
        />
        E-Mail für mich
      </label>
      {notification && (
        <small role="status">
          {reminderEmailLabels[notification.status]}
          {notification.status === 'sent' && notification.sentAt
            ? ` · ${new Date(notification.sentAt).toLocaleString('de-AT')}`
            : ''}
        </small>
      )}
      {!active && available && (
        <ReminderEmailFields days={days} onDays={setDays} disabled={disabled} />
      )}
      {active && (
        <small>
          {notification.daysBefore === 0
            ? 'Am Fälligkeitstag'
            : `${notification.daysBefore} Tag${notification.daysBefore === 1 ? '' : 'e'} vorher`}{' '}
          · 09:00 Uhr ({notification.timeZone})
        </small>
      )}
      {notification && ['failed', 'unknown'].includes(notification.status) && available && (
        <button
          className="text-button"
          disabled={disabled}
          onClick={() => {
            if (
              notification.status === 'unknown' &&
              !window.confirm(
                'Die E-Mail wurde möglicherweise bereits zugestellt. Bitte zuerst dein Postfach prüfen. Trotzdem erneut vormerken?',
              )
            )
              return;
            onChange(preference);
          }}
        >
          Erneut vormerken
        </button>
      )}
    </div>
  );
}
