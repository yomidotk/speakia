import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { C, F, shadow } from '../theme';

export function Button({
  label, onPress, variant = 'primary', disabled, loading, style,
}: {
  label: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'sun';
  disabled?: boolean; loading?: boolean; style?: ViewStyle;
}) {
  const bg = variant === 'primary' ? C.skyInk : variant === 'sun' ? C.sun : C.white;
  const fg = variant === 'primary' ? C.white : C.navy;
  const under = variant === 'primary' ? C.skyInkDark : variant === 'sun' ? C.sunDark : C.skyTint;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      hitSlop={6}
      // The pressed look must not change the button's size: a layout change mid-tap makes Android
      // re-measure while the finger is down and can cancel the press (taps "needing" several tries).
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, borderBottomColor: under, opacity: disabled ? 0.5 : pressed ? 0.88 : 1 },
        variant === 'secondary' && { borderWidth: 2, borderColor: C.skyTint, borderBottomWidth: 2 },
        pressed && { transform: [{ translateY: 2 }] },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, tint = C.sun }: { label: string; selected?: boolean; onPress?: () => void; tint?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[s.chip, selected ? { backgroundColor: tint, borderColor: tint } : null]}
    >
      <Text style={[s.chipText, selected && { fontFamily: F.heavy }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Label({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[s.label, style]}>{children}</Text>;
}

export function Title({ children, size = 32, style }: { children: ReactNode; size?: number; style?: TextStyle }) {
  return <Text style={[{ fontFamily: F.display, fontSize: size, lineHeight: size * 1.08, color: C.navy, letterSpacing: -0.6 }, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[s.body, style]}>{children}</Text>;
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Path d="M14 6h36a10 10 0 0 1 10 10v24a10 10 0 0 1-10 10H26l-12 10v-10a10 10 0 0 1-10-10V16A10 10 0 0 1 14 6z" fill={C.sky} />
        <Rect x={18} y={30} width={7} height={11} rx={3.5} fill="#fff" />
        <Rect x={28.5} y={23} width={7} height={18} rx={3.5} fill="#fff" />
        <Rect x={39} y={15} width={7} height={26} rx={3.5} fill={C.sun} />
      </Svg>
      <Text style={{ fontFamily: F.display, fontSize: size * 0.75, color: C.navy, letterSpacing: -1 }}>speakia</Text>
    </View>
  );
}

export function Stars({ count, size = 14 }: { count: number; size?: number }) {
  return (
    <Text style={{ fontSize: size, letterSpacing: 1, fontFamily: F.heavy }}>
      <Text style={{ color: C.sunDark }}>{'★'.repeat(count)}</Text>
      <Text style={{ color: '#E3DACA' }}>{'★'.repeat(3 - count)}</Text>
    </Text>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0 },
  btnText: { fontFamily: F.heavy, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  chip: { borderWidth: 2, borderColor: C.skyTint, backgroundColor: C.white, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' },
  chipText: { fontFamily: F.bold, fontSize: 14, color: C.navy },
  card: { backgroundColor: C.white, borderRadius: 22, padding: 16, ...shadow },
  label: { fontFamily: F.heavy, fontSize: 12, letterSpacing: 1, color: C.muted, textTransform: 'uppercase' },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: '#3D4466' },
});
