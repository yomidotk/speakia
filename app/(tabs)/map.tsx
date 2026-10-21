import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import Character from '../../src/components/Character';
import { Icon } from '../../src/components/Icon';
import { Sheet, k } from '../../src/components/kit';
import Place from '../../src/components/Place';
import StopIcon, { STOP_TINT } from '../../src/components/StopIcon';
import { Button, Logo, Stars } from '../../src/components/ui';
import { DEFAULT_AVATAR, LookSource } from '../../src/content/avatars';
import { EPISODES, Episode } from '../../src/content/episodes';
import { bestStars, getAttempts, getProfile, Profile } from '../../src/storage';
import { C, F, shadow } from '../../src/theme';

type Status = 'done' | 'current' | 'locked' | 'soon';

// While developing (Expo Go), every written episode can be opened from the map, to test any of them.
// Release builds (the APK) keep the normal order.
const OPEN_ALL = __DEV__;
const openForTesting = (e: Episode, st: Status) => OPEN_ALL && e.playable && st === 'locked';

const ROW = 156;     // vertical distance between stops
const NODE = 84;     // stop diameter
const BIG = 104;     // current stop diameter
const PAD_TOP = 76;  // room above the finale (for its icon and badge)
const PAD_BOT = 64;  // room below level 1
const MASCOT = 74;
// Horizontal position of each level (fraction of width), from level 1 upwards. Zig-zags so every
// label has a full half of the screen to itself.
const X = [0.3, 0.7, 0.3, 0.64, 0.3, 0.7];

/**
 * Screen 09 · Story map. The road starts at the bottom (level 1) and climbs to the finale.
 * The road is the screen's one bold element; the header and the docked panel stay quiet.
 */
export default function MapScreen() {
  const { width } = useWindowDimensions();
  const pathH = PAD_TOP + PAD_BOT + ROW * (EPISODES.length - 1);

  const [stars, setStars] = useState<Record<string, number>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Episode | null>(null);
  const [calm, setCalm] = useState(false);
  const [viewH, setViewH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [pathTop, setPathTop] = useState<number | null>(null);
  const scroll = useRef<ScrollView>(null);
  const centred = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setCalm).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      getAttempts().then((a) => setStars(bestStars(a)));
      getProfile().then(setProfile);
    }, [])
  );

  const current = EPISODES.find((e) => e.playable && !stars[e.id]) ?? EPISODES.filter((e) => e.playable).pop()!;
  const currentIdx = EPISODES.indexOf(current);
  const status = (e: Episode, i: number): Status =>
    stars[e.id] ? 'done' : e.id === current.id ? 'current' : !e.playable && i < currentIdx ? 'soon' : 'locked';

  const selected = EPISODES.find((e) => e.id === selectedId) ?? current;
  const selectedStatus = status(selected, EPISODES.indexOf(selected));
  const totalStars = Object.values(stars).reduce((a, b) => a + b, 0);
  const doneCount = Object.keys(stars).length;

  const pos = (i: number) => ({ x: X[i] * width, y: PAD_TOP + (EPISODES.length - 1 - i) * ROW });

  // Centre the current stop once everything is measured (scrollTo is clamped before the content
  // height is known), then leave scrolling to the learner.
  useEffect(() => {
    if (centred.current || !viewH || !contentH || pathTop === null) return;
    centred.current = true;
    const y = pathTop + pos(currentIdx).y - viewH / 2;
    scroll.current?.scrollTo({ y: Math.max(0, Math.min(y, contentH - viewH)), animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewH, contentH, pathTop, currentIdx]);

  const tap = (e: Episode, i: number) => {
    setSelectedId(e.id);
    const st = status(e, i);
    if ((st === 'locked' && !openForTesting(e, st)) || st === 'soon') setSheet(e);
  };
  const go = (e: Episode) => router.push({ pathname: '/episode/[id]/intro', params: { id: e.id } });

  return (
    <SafeAreaView style={s.fill} edges={['top']}>
      <View style={s.topBar}>
        <Logo size={26} />
        <View style={{ flex: 1 }} />
        {profile && (
          <Text style={[s.pill, s.levelPill]} accessibilityLabel={`Level ${profile.level}`}>{profile.level}</Text>
        )}
        <View style={[s.pill, s.starPill]} accessibilityLabel={`${totalStars} of ${EPISODES.length * 3} stars`}>
          <Icon name="star" size={16} color={C.sunDark} />
          <Text style={s.pillText}>{totalStars}/{EPISODES.length * 3}</Text>
        </View>
      </View>

      <ScrollView
        ref={scroll}
        onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
        onContentSizeChange={(_, h) => setContentH(h)}
        showsVerticalScrollIndicator={false}
      >
        <SeasonHeader major={profile?.major} done={doneCount} total={EPISODES.length} />

        <View style={{ width, height: pathH }} onLayout={(e) => setPathTop(e.nativeEvent.layout.y)}>
          <Road w={width} points={EPISODES.map((_, i) => pos(i))} doneUpTo={currentIdx} />
          {EPISODES.map((e, i) => {
            const p = pos(i);
            return (
              <Stop
                key={e.id}
                ep={e}
                index={i}
                x={p.x}
                y={p.y}
                width={width}
                status={status(e, i)}
                stars={stars[e.id] ?? 0}
                selected={selected.id === e.id}
                calm={calm}
                avatar={profile?.avatar ?? DEFAULT_AVATAR}
                onPress={() => tap(e, i)}
              />
            );
          })}
        </View>
      </ScrollView>

      <Dock ep={selected} status={selectedStatus} stars={stars[selected.id] ?? 0} current={current} onGo={() => go(selected)} />

      <Sheet visible={!!sheet} onClose={() => setSheet(null)} title={sheet ? sheet.title : ''}>
        {sheet && (
          <>
            <View style={s.sheetArt}>
              <Place place={sheet.place} width={width - 48} height={130} still />
            </View>
            <Text style={k.sub}>
              {status(sheet, EPISODES.indexOf(sheet)) === 'soon'
                ? `This chapter at the ${sheet.placeName.toLowerCase()} is still being written. Jump into ${current.title} in the meantime.`
                : `Complete ${current.title} to unlock ${sheet.title}.`}
            </Text>
            <Button label={`Go to ${current.title}`} onPress={() => { setSheet(null); setSelectedId(current.id); go(current); }} />
            <Button label="Close" variant="secondary" onPress={() => setSheet(null)} />
          </>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ header */

function SeasonHeader({ major, done, total }: { major?: string; done: number; total: number }) {
  return (
    <View style={s.season}>
      <Text style={s.kicker} numberOfLines={1}>SEASON 1{major ? ` · ${major.toUpperCase()}` : ''}</Text>
      <Text style={s.seasonTitle} numberOfLines={1}>Campus Life</Text>
      <View style={s.seasonRow}>
        <View style={s.track}>
          <View style={[s.trackFill, { width: `${Math.max(4, (done / total) * 100)}%` }]} />
        </View>
        <Text style={s.seasonCount}>{done} of {total} episodes</Text>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------- road */

/**
 * Dotted road between stops. Trees sit at the outer edges halfway between rows, where no label,
 * stop or mascot can be.
 */
function Road({ w, points, doneUpTo }: { w: number; points: { x: number; y: number }[]; doneUpTo: number }) {
  const h = points[0].y + PAD_BOT;
  const seg = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    `M${a.x} ${a.y} C${a.x} ${a.y - ROW * 0.5} ${b.x} ${b.y + ROW * 0.5} ${b.x} ${b.y}`;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      {points.slice(1).map((p, i) => (
        <Path
          key={i}
          d={seg(points[i], p)}
          stroke={i + 1 <= doneUpTo ? C.roadDone : C.road}
          strokeWidth={10}
          strokeDasharray="2 16"
          strokeLinecap="round"
          fill="none"
        />
      ))}
      {points.slice(1).map((p, i) => {
        // the road leaves the lower stop and bends toward the upper one; put the tree on the far side
        const lower = points[i];
        const x = lower.x < w / 2 ? w * 0.93 : w * 0.07;
        const y = (lower.y + p.y) / 2 + 6;
        return (
          <G key={`t${i}`}>
            <Ellipse cx={x} cy={y + 18} rx={12} ry={3.5} fill={C.groundShadow} />
            <Path d={`M${x} ${y + 18}V${y + 4}`} stroke={C.trunk} strokeWidth={3.5} strokeLinecap="round" />
            <Circle cx={x} cy={y - 4} r={11} fill={i % 2 ? C.leaf : C.mint} />
            <Circle cx={x + (x > w / 2 ? -15 : 15)} cy={y + 18} r={2.8} fill={i % 2 ? C.peach : C.sun} />
          </G>
        );
      })}
    </Svg>
  );
}

/* -------------------------------------------------------------------- stop */

function Stop({
  ep, index, x, y, width, status, stars, selected, calm, avatar, onPress,
}: {
  ep: Episode; index: number; x: number; y: number; width: number; status: Status; stars: number;
  selected: boolean; calm: boolean; avatar: LookSource; onPress: () => void;
}) {
  const enter = useRef(new Animated.Value(calm ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const isCurrent = status === 'current';
  const locked = status === 'locked';
  const size = isCurrent ? BIG : NODE;
  const labelRight = x < width / 2;

  useEffect(() => {
    if (calm) return;
    Animated.spring(enter, { toValue: 1, delay: 70 * index, friction: 6, tension: 80, useNativeDriver: true }).start();
  }, [calm, enter, index]);

  useEffect(() => {
    if (!isCurrent || calm) return;
    const p = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    p.start();
    b.start();
    return () => { p.stop(); b.stop(); };
  }, [isCurrent, calm, pulse, bob]);

  const springTo = (v: number) => Animated.spring(press, { toValue: v, friction: 4, tension: 220, useNativeDriver: true }).start();

  const ring = status === 'done' ? C.mint : isCurrent ? C.skyInk : status === 'soon' ? C.sun : C.lockedRing;
  const statusLine = isCurrent ? ep.focus : status === 'soon' ? 'Coming soon' : 'Locked';
  const a11y =
    `Episode ${ep.level}, ${ep.title}. ` +
    (status === 'done' ? `Completed, ${stars} of 3 stars.` : isCurrent ? 'Current episode.' : status === 'soon' ? 'Coming soon.' : 'Locked.');
  const gap = 14;
  const labelW = (labelRight ? width - (x + size / 2) : x - size / 2) - gap - 16;

  // the learner's avatar stands on the side opposite the label, sized to the room available
  const room = (labelRight ? x - size / 2 : width - (x + size / 2)) - 6;
  const mascot = Math.max(52, Math.min(MASCOT, room));

  return (
    <>
      <Animated.View
        style={{
          position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size,
          opacity: enter,
          transform: [{ scale: Animated.multiply(enter.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }), press) }],
        }}
      >
        {isCurrent && !calm && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: C.sky,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
            }}
          />
        )}
        <Pressable
          onPress={onPress}
          onPressIn={() => springTo(0.92)}
          onPressOut={() => springTo(1)}
          accessibilityRole="button"
          accessibilityLabel={a11y}
          accessibilityState={{ selected }}
          style={[
            s.node,
            {
              width: size, height: size, borderRadius: size / 2, borderWidth: isCurrent ? 6 : 5,
              borderColor: selected && !isCurrent ? C.sky : ring,
              backgroundColor: locked ? C.lockedFill : STOP_TINT[ep.place],
            },
            shadow,
          ]}
        >
          {/* faded circle behind, colourful icon on top (it pokes out above the circle) */}
          <View style={{ position: 'absolute', top: -size * 0.16, left: size * 0.02, opacity: locked ? 0.45 : 1 }}>
            <StopIcon place={ep.place} size={size * 0.96 - (isCurrent ? 12 : 10)} />
          </View>
        </Pressable>

        {status === 'done' && <View style={[s.badge, { backgroundColor: C.mint }]}><Icon name="check" size={15} color={C.white} stroke={3.4} /></View>}
        {locked && <View style={[s.badge, { backgroundColor: C.lockedBadge }]}><Icon name="lock" size={14} color={C.white} stroke={2.6} /></View>}

        {isCurrent && (
          <Animated.View pointerEvents="none" style={[s.start, { transform: [{ translateY: calm ? 0 : bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }]}>
            <Text style={s.startText}>START</Text>
            <View style={s.startTail} />
          </Animated.View>
        )}
      </Animated.View>

      {/* label: kicker, title, status */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: y - 30, width: labelW, opacity: enter,
          ...(labelRight ? { left: x + size / 2 + gap, alignItems: 'flex-start' } : { left: x - size / 2 - gap - labelW, alignItems: 'flex-end' }),
        }}
      >
        <Text style={[s.labelKicker, isCurrent && { color: C.skyInk }]}>EPISODE {ep.level}</Text>
        <Text
          style={[s.label, isCurrent && s.labelCurrent, locked && { color: C.lockedInk }, !labelRight && { textAlign: 'right' }]}
          numberOfLines={2}
          maxFontSizeMultiplier={1.3}
        >
          {ep.title}
        </Text>
        {status === 'done' ? (
          <Stars count={stars} size={14} />
        ) : (
          <Text style={[s.labelSub, !labelRight && { textAlign: 'right' }]} numberOfLines={1}>{statusLine}</Text>
        )}
      </Animated.View>

      {isCurrent && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: y - mascot * 0.55, opacity: enter,
            ...(labelRight ? { left: x - size / 2 - mascot - 2 } : { left: x + size / 2 + 2 }),
            transform: [{ translateY: calm ? 0 : bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }],
          }}
        >
          <Character who={avatar} size={mascot} />
        </Animated.View>
      )}
    </>
  );
}

/* -------------------------------------------------------------------- dock */

/** Compact panel above the tabs: what the selected stop is, and the one action for it. */
function Dock({
  ep, status, stars, current, onGo,
}: { ep: Episode; status: Status; stars: number; current: Episode; onGo: () => void }) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [ep.id, a]);

  const testing = openForTesting(ep, status);
  const playable = status === 'current' || status === 'done' || testing;
  const line =
    testing ? 'Open for testing (Expo Go only)'
    : status === 'done' ? null
      : status === 'current' ? `Focus: ${ep.focus.toLowerCase()}`
        : status === 'soon' ? 'Being written'
          : `Finish ${current.title} to unlock`;

  return (
    <View style={[s.dock, shadow]}>
      <Animated.View style={[s.dockRow, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}>
        <View style={[s.dockIcon, { backgroundColor: status === 'locked' ? C.lockedFill : STOP_TINT[ep.place] }]}>
          <View style={{ opacity: status === 'locked' ? 0.45 : 1 }}>
            <StopIcon place={ep.place} size={46} />
          </View>
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={s.kicker} numberOfLines={1}>{`EPISODE ${ep.level} · ${ep.placeName.toUpperCase()}`}</Text>
          <Text style={s.dockTitle} numberOfLines={1} maxFontSizeMultiplier={1.3}>{ep.title}</Text>
          {line ? <Text style={s.dockSub} numberOfLines={1}>{line}</Text> : <Stars count={stars} size={13} />}
        </View>
        {playable && (
          <Button
            label={status === 'done' ? 'Replay' : 'Start'}
            onPress={onGo}
            style={{ minHeight: 48, paddingHorizontal: 20, borderRadius: 16 }}
          />
        )}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.cream },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
  pill: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, overflow: 'hidden', justifyContent: 'center' },
  levelPill: { fontFamily: F.heavy, fontSize: 14, lineHeight: 34, color: C.skyInk, backgroundColor: C.skyTint },
  starPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.sunTint },
  pillText: { fontFamily: F.heavy, fontSize: 14, color: C.navy },

  season: { marginHorizontal: 20, marginTop: 4, padding: 16, borderRadius: 20, backgroundColor: C.mintTint, gap: 2 },
  kicker: { fontFamily: F.heavy, fontSize: 11, letterSpacing: 0.8, color: C.skyInk },
  seasonTitle: { fontFamily: F.display, fontSize: 26, lineHeight: 30, color: C.navy, letterSpacing: -0.5 },
  seasonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.white, overflow: 'hidden' },
  trackFill: { height: 8, borderRadius: 4, backgroundColor: C.mint },
  seasonCount: { fontFamily: F.bold, fontSize: 12, color: C.navy },

  node: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.white },
  start: { position: 'absolute', top: -58, left: 0, right: 0, alignItems: 'center' },
  startText: { fontFamily: F.heavy, fontSize: 13, letterSpacing: 1, color: C.navy, backgroundColor: C.sun, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, overflow: 'hidden' },
  startTail: { width: 10, height: 10, backgroundColor: C.sun, transform: [{ rotate: '45deg' }], marginTop: -6 },
  labelKicker: { fontFamily: F.heavy, fontSize: 11, letterSpacing: 0.8, color: C.muted },
  label: { fontFamily: F.heavy, fontSize: 15, lineHeight: 20, color: C.navy },
  labelCurrent: { fontFamily: F.display, fontSize: 18, lineHeight: 22 },
  labelSub: { fontFamily: F.semi, fontSize: 12, color: C.muted, marginTop: 1 },

  dock: { marginHorizontal: 12, marginBottom: 8, padding: 12, borderRadius: 22, backgroundColor: C.white },
  dockRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dockIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  dockTitle: { fontFamily: F.display, fontSize: 18, lineHeight: 22, color: C.navy },
  dockSub: { fontFamily: F.semi, fontSize: 13, color: C.muted },
  sheetArt: { height: 130, borderRadius: 20, overflow: 'hidden', alignItems: 'center' },
});
