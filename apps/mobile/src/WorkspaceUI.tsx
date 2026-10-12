import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  type KeyboardTypeOptions,
} from 'react-native';

export const palette = {
  ink: '#172B36',
  muted: '#627580',
  accent: '#146F68',
  canvas: '#F6F5F1',
  line: '#E1E5E4',
  soft: '#EDF3F1',
};
export function Card({
  title,
  note,
  children,
}: {
  title?: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={ui.card}>
      {title && <Text style={ui.title}>{title}</Text>}
      {note && <Text style={ui.note}>{note}</Text>}
      {children}
    </View>
  );
}
export function Action({
  children,
  onPress,
  disabled = false,
  secondary = false,
  danger = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[ui.action, secondary && ui.secondary, disabled && { opacity: 0.5 }]}
    >
      <Text style={[ui.actionText, secondary && { color: danger ? '#9F423C' : palette.accent }]}>
        {children}
      </Text>
    </Pressable>
  );
}
export function Input({
  label,
  value,
  onChange,
  multiline = false,
  disabled = false,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  disabled?: boolean;
  keyboardType?: KeyboardTypeOptions;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={[
          ui.input,
          multiline && { minHeight: 80, textAlignVertical: 'top' },
          disabled && { backgroundColor: '#F6F5F1' },
        ]}
      />
    </View>
  );
}
export function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <Text accessibilityRole="alert" style={ui.error}>
      {error}
    </Text>
  ) : null;
}
export const ui = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 20,
    gap: 14,
  },
  title: { color: palette.ink, fontSize: 20, fontWeight: '600', letterSpacing: -0.45 },
  heading: { color: palette.ink, fontSize: 30, fontWeight: '700', letterSpacing: -1 },
  eyebrow: { color: palette.accent, fontSize: 10, fontWeight: '700', letterSpacing: 1.8 },
  note: { color: palette.muted, fontSize: 13, lineHeight: 20 },
  label: { color: palette.ink, fontSize: 12, fontWeight: '600' },
  value: { color: palette.ink, fontSize: 27, fontWeight: '600', letterSpacing: -0.6 },
  input: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 10,
    padding: 13,
    color: palette.ink,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  action: {
    backgroundColor: palette.accent,
    borderRadius: 10,
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'space-between' },
  divider: { height: 1, backgroundColor: palette.line, marginVertical: 3 },
  error: {
    color: '#9F423C',
    fontSize: 13,
    lineHeight: 20,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FBEEEB',
  },
});
