import { ReactNode, forwardRef, useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TextInputProps, View, ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, IconName } from './Icon';
import { Logo } from './ui';
import { C, F, shadow } from '../theme';

/** Back chevron + small logo, as on every auth/onboarding screen in the spec. */
export function TopBar({ onBack, right }: { onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={k.topBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={10}
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        style={k.back}
      >
        <Icon name="back" size={22} color={C.skyInk} stroke={2.8} />
      </Pressable>
      <Logo size={24} />
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

/** Scrollable body with a fixed bottom action area that stays above the keyboard. */
export function Screen({ children, footer, top }: { children: ReactNode; footer?: ReactNode; top?: ReactNode }) {
  return (
    <SafeAreaView style={k.fill}>
      <KeyboardAvoidingView style={k.fill} behavior="padding">
        {top}
        <ScrollView contentContainerStyle={k.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        {footer && <View style={k.footer}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Heading({ title, sub, kicker }: { title: string; sub?: string; kicker?: string }) {
  return (
    <View style={{ gap: 6, marginBottom: 4 }}>
      {!!kicker && <Text style={k.kicker}>{kicker}</Text>}
      <Text style={k.title} accessibilityRole="header">{title}</Text>
      {!!sub && <Text style={k.sub}>{sub}</Text>}
    </View>
  );
}

type FieldProps = TextInputProps & { label: string; icon?: IconName; error?: string; secure?: boolean };

/** Labelled input with optional leading icon, password visibility toggle and inline error. */
export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, icon, error, secure, style, ...rest }, ref) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ gap: 6 }}>
      <Text style={k.fieldLabel}>{label}</Text>
      <View style={[k.input, focused && { borderColor: C.skyInk }, !!error && { borderColor: '#D9534F' }]}>
        {icon && <Icon name={icon} size={20} color={focused ? C.skyInk : '#9AA0BC'} />}
        <TextInput
          ref={ref}
          {...rest}
          secureTextEntry={secure && hidden}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          placeholderTextColor="#9AA0BC"
          style={[k.inputText, style]}
          accessibilityLabel={label}
        />
        {secure && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Icon name={hidden ? 'eye' : 'eyeOff'} size={20} color="#9AA0BC" />
          </Pressable>
        )}
      </View>
      {!!error && <Text style={k.error} accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );
});

/** Grid tile (major, level): icon or big label, selected border + check. `soon` shows it greyed out and not selectable. */
export function OptionTile({
  label, sub, icon, big, selected, onPress, style, soon,
}: { label: string; sub?: string; icon?: IconName; big?: string; selected: boolean; onPress: () => void; style?: ViewStyle; soon?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const bump = () =>
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={() => { bump(); onPress(); }}
        disabled={soon}
        accessibilityRole="radio"
        accessibilityState={{ selected, disabled: soon }}
        accessibilityLabel={[big, label, sub, soon && 'coming soon'].filter(Boolean).join(", ")}
        style={[k.tile, selected && k.tileOn, soon && k.tileSoon]}
      >
        {soon && <Text style={k.soonTag}>Soon</Text>}
        {selected && (
          <View style={k.tick}><Icon name="check" size={13} color="#fff" stroke={3.4} /></View>
        )}
        {icon && (
          <View style={[k.tileIcon, selected && { backgroundColor: C.white }]}>
            <Icon name={icon} size={24} color={C.skyInk} />
          </View>
        )}
        {!!big && <Text style={[k.tileBig, selected && { color: C.skyInk }]}>{big}</Text>}
        <Text style={k.tileLabel} numberOfLines={2}>{label}</Text>
        {!!sub && <Text style={k.tileSub}>{sub}</Text>}
      </Pressable>
    </Animated.View>
  );
}

/** Settings-style row with icon, label and chevron. */
export function MenuRow({ icon, label, value, onPress, danger }: { icon: IconName; label: string; value?: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [k.row, pressed && { backgroundColor: C.skyTint }]}>
      <View style={[k.rowIcon, danger && { backgroundColor: C.peachTint }]}>
        <Icon name={icon} size={19} color={danger ? '#C2412B' : C.skyInk} />
      </View>
      <Text style={[k.rowLabel, danger && { color: '#C2412B' }]}>{label}</Text>
      {!!value && <Text style={k.rowValue} numberOfLines={1}>{value}</Text>}
      <Icon name="chevron" size={18} color="#9AA0BC" />
    </Pressable>
  );
}

/** Bottom sheet: close by X, back, or tapping outside. Max 80% height, scrolls inside. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) Animated.timing(slide, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    else slide.setValue(0);
  }, [visible, slide]);
  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="fade">
      <Pressable style={k.scrim} onPress={onClose} accessibilityLabel="Close" />
      <Animated.View style={[k.sheet, { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }]}>
        <View style={k.grabber} />
        {!!title && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={[k.title, { fontSize: 22, flex: 1 }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={22} color={C.muted} />
            </Pressable>
          </View>
        )}
        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

/** Thin progress bar (onboarding steps, placement test). */
export function StepBar({ value }: { value: number }) {
  const w = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: value, duration: 300, useNativeDriver: false }).start();
  }, [value, w]);
  return (
    <View style={k.track}>
      <Animated.View style={[k.bar, { width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={k.line} />
      <Text style={k.tileSub}>{label}</Text>
      <View style={k.line} />
    </View>
  );
}

export function GoogleButton({ onPress, busy = false }: { onPress: () => void; busy?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityState={{ busy }} style={({ pressed }) => [k.google, (pressed || busy) && { backgroundColor: C.skyTint }]}>
      <Text style={k.g}>G</Text>
      <Text style={k.googleText}>{busy ? 'Connecting to Google…' : 'Continue with Google'}</Text>
    </Pressable>
  );
}

export const k = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.cream },
  body: { paddingHorizontal: 24, paddingBottom: 24, gap: 16 },
  footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16, gap: 10 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, minHeight: 56 },
  back: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: F.heavy, fontSize: 12, letterSpacing: 1, color: C.skyInk, textTransform: 'uppercase' },
  title: { fontFamily: F.display, fontSize: 28, lineHeight: 34, color: C.navy, letterSpacing: -0.5 },
  sub: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.muted },
  fieldLabel: { fontFamily: F.bold, fontSize: 13, color: C.muted },
  input: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 14, borderWidth: 2, borderColor: '#E7E9F3', paddingHorizontal: 14, minHeight: 54 },
  inputText: { flex: 1, fontFamily: F.semi, fontSize: 16, color: C.navy, paddingVertical: 12 },
  error: { fontFamily: F.semi, fontSize: 13, color: '#C2412B' },
  tile: { backgroundColor: C.white, borderRadius: 18, borderWidth: 2, borderColor: '#E7E9F3', padding: 12, minHeight: 118, alignItems: 'center', justifyContent: 'center', gap: 6 },
  tileOn: { borderColor: C.skyInk, backgroundColor: C.skyTint },
  tileSoon: { opacity: 0.5 },
  soonTag: { position: 'absolute', top: 8, right: 8, fontFamily: F.heavy, fontSize: 10, letterSpacing: 0.5, color: C.navy, backgroundColor: C.sunTint, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  tick: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: C.skyInk, alignItems: 'center', justifyContent: 'center' },
  tileIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.skyTint, alignItems: 'center', justifyContent: 'center' },
  tileBig: { fontFamily: F.display, fontSize: 28, color: C.navy },
  tileLabel: { fontFamily: F.bold, fontSize: 13, color: C.navy, textAlign: 'center' },
  tileSub: { fontFamily: F.semi, fontSize: 12, color: C.muted, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, minHeight: 56 },
  rowIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.skyTint, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontFamily: F.bold, fontSize: 15, color: C.navy },
  rowValue: { fontFamily: F.semi, fontSize: 13, color: C.muted, maxWidth: 130 },
  scrim: { flex: 1, backgroundColor: 'rgba(30,36,64,0.35)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '80%', backgroundColor: C.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingTop: 10, paddingBottom: 36, ...shadow },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#DDD6C8', marginBottom: 12 },
  track: { height: 8, borderRadius: 4, backgroundColor: '#E4E6F0', overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4, backgroundColor: C.sky },
  line: { flex: 1, height: 1, backgroundColor: '#E4E6F0' },
  google: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 54, borderRadius: 18, borderWidth: 2, borderColor: '#E7E9F3', backgroundColor: C.white },
  g: { fontFamily: F.heavy, fontSize: 18, color: '#4285F4' },
  googleText: { fontFamily: F.heavy, fontSize: 16, color: C.navy },
});
