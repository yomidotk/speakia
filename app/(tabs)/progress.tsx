import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { k } from '../../src/components/kit';
import { Button, Stars } from '../../src/components/ui';
import { EPISODES, getEpisode } from '../../src/content/episodes';
import { Attempt, Profile, bestStars, getAttempts, getProfile, levelName } from '../../src/storage';
import { C, F, shadow } from '../../src/theme';

/** Screen 16 · Progress. Real numbers from attempts saved on the phone; trends only after 3 spoken attempts. */
export default function Progress() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  useFocusEffect(
    useCallback(() => {
      getAttempts().then(setAttempts);
      getProfile().then(setProfile);
    }, [])
  );

  const best = bestStars(attempts);
  const episodesDone = Object.keys(best).length;
  const minutes = Math.round(attempts.reduce((a, b) => a + b.speakingMs, 0) / 60000);
  const avgHints = attempts.length ? attempts.reduce((a, b) => a + b.hints, 0) / attempts.length : 0;
  const recent = attempts.slice(-3);
  const wordsPerTurn = recent.length ? recent.reduce((a, b) => a + b.words / Math.max(1, b.turns), 0) / recent.length : 0;
  const spoken = attempts.filter((a) => a.speakingMs > 0).length;

  const current = EPISODES.find((e) => e.playable && !best[e.id]) ?? EPISODES.find((e) => e.playable)!;
  const weakest = attempts.length
    ? Object.entries(best).sort((a, b) => a[1] - b[1])[0]
    : null;
  const recommend = weakest && weakest[1] < 3 ? getEpisode(weakest[0])! : current;

  return (
    <SafeAreaView style={s.fill} edges={['top']}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={k.title}>Your progress</Text>

        <View style={s.top}>
          <View style={[s.levelCard, shadow]}>
            <Text style={s.level}>{profile?.level ?? '—'}</Text>
            <Text style={s.levelName}>{profile ? levelName(profile.level) : ''}</Text>
            <Text style={s.levelSrc}>{profile?.levelSource === 'test' ? 'Estimated' : 'Selected level'}</Text>
          </View>
          <View style={{ flex: 1, gap: 10 }}>
            <Tile value={String(episodesDone)} label="Episodes" tint={C.mintTint} />
            <Tile value={String(minutes)} label="Minutes recorded" tint={C.sunTint} />
          </View>
        </View>

        {episodesDone === 0 ? (
          <View style={[s.card, shadow, { alignItems: 'center', gap: 10 }]}>
            <Icon name="target" size={36} color={C.skyInk} />
            <Text style={[k.title, { fontSize: 20, textAlign: 'center' }]}>Your first chapter starts on the map.</Text>
            <Button label="Go to the map" onPress={() => router.push('/map')} style={{ alignSelf: 'stretch' }} />
          </View>
        ) : (
          <View style={[s.card, shadow, { gap: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={s.section}>Practice indicators</Text>
              <View style={{ flex: 1 }} />
              <Text style={s.help}>not a grade</Text>
            </View>
            {spoken >= 3 ? (
              <>
                <Meter label="Words per turn" value={wordsPerTurn} max={20} display={wordsPerTurn.toFixed(0)} colour={C.sky} />
                <Meter label="Independence" value={3 - Math.min(3, avgHints)} max={3} display={`${avgHints.toFixed(1)} hints / episode`} colour={C.mint} />
                <Meter label="Recording time" value={minutes} max={60} display={`${minutes} min`} colour={C.peach} />
              </>
            ) : (
              <Text style={k.sub}>
                Trends appear after 3 spoken episodes ({spoken} so far). Average hints so far: {avgHints.toFixed(1)}.
              </Text>
            )}
          </View>
        )}

        <View style={[s.card, shadow, { gap: 4 }]}>
          <Text style={[s.section, { marginBottom: 6 }]}>Communication skills</Text>
          {EPISODES.map((e) => {
            const done = !!best[e.id];
            const now = e.id === current.id;
            return (
              <View key={e.id} style={s.skill}>
                <View style={[s.dot, { backgroundColor: done ? C.mint : now ? C.sky : '#E4E6F0' }]}>
                  {done && <Icon name="check" size={12} color="#fff" stroke={3.4} />}
                </View>
                <Text style={[s.skillText, !done && !now && { color: C.muted }]}>{e.focus}</Text>
                {now && !done && <Text style={s.inProgress}>In progress</Text>}
              </View>
            );
          })}
        </View>

        <Pressable
          onPress={() => router.push({ pathname: '/episode/[id]/intro', params: { id: recommend.id } })}
          accessibilityRole="button"
          style={[s.reco, shadow]}
        >
          <View style={s.recoIcon}><Icon name="target" size={26} color={C.peach} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.recoKicker}>RECOMMENDED PRACTICE</Text>
            <Text style={s.recoTitle}>{recommend.focus}</Text>
            <Text style={s.recoSub}>~5 min · {best[recommend.id] ? 'revisit' : 'play'} {recommend.title}</Text>
          </View>
          <Icon name="chevron" size={20} color={C.muted} />
        </Pressable>

        {attempts.length > 0 && (
          <>
            <Text style={[s.section, { marginTop: 4 }]}>History</Text>
            {[...attempts].reverse().map((a) => (
              <Pressable key={a.sessionId || a.finishedAt} disabled={!a.sessionId} onPress={() => router.push({ pathname: '/episode/[id]/result', params: { id: a.episodeId, session: a.sessionId! } })} style={[s.card, s.row]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{getEpisode(a.episodeId)?.title ?? a.episodeId}</Text>
                  <Text style={s.rowSub}>as {a.role} · {a.report?.status === 'ended_early' ? 'ended early · ' : ''}{a.hints} hints · {new Date(a.finishedAt).toLocaleDateString()}</Text>
                </View>
                <Stars count={a.stars} size={16} />
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ value, label, tint }: { value: string; label: string; tint: string }) {
  return (
    <View style={[s.tile, { backgroundColor: tint }]}>
      <Text style={s.tileValue}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
    </View>
  );
}

function Meter({ label, value, max, display, colour }: { label: string; value: number; max: number; display: string; colour: string }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: Math.min(1, value / max), duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value, max, w]);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row' }}>
        <Text style={s.meterLabel}>{label}</Text>
        <View style={{ flex: 1 }} />
        <Text style={s.meterValue}>{display}</Text>
      </View>
      <View style={s.track}>
        <Animated.View style={[s.bar, { backgroundColor: colour, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.cream },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  top: { flexDirection: 'row', gap: 10 },
  levelCard: { width: 140, backgroundColor: C.white, borderRadius: 22, padding: 16, alignItems: 'center', justifyContent: 'center' },
  level: { fontFamily: F.display, fontSize: 44, color: C.skyInk, letterSpacing: -1 },
  levelName: { fontFamily: F.heavy, fontSize: 14, color: C.navy },
  levelSrc: { fontFamily: F.semi, fontSize: 11, color: C.muted, marginTop: 2 },
  tile: { flex: 1, borderRadius: 18, padding: 12, justifyContent: 'center' },
  tileValue: { fontFamily: F.display, fontSize: 26, color: C.navy },
  tileLabel: { fontFamily: F.bold, fontSize: 12, color: '#3D4466' },
  card: { backgroundColor: C.white, borderRadius: 22, padding: 16 },
  section: { fontFamily: F.display, fontSize: 18, color: C.navy },
  help: { fontFamily: F.bold, fontSize: 11, color: C.muted, backgroundColor: C.skyTint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  meterLabel: { fontFamily: F.bold, fontSize: 14, color: C.navy },
  meterValue: { fontFamily: F.heavy, fontSize: 13, color: C.muted },
  track: { height: 10, borderRadius: 5, backgroundColor: '#E4E6F0', overflow: 'hidden' },
  bar: { height: 10, borderRadius: 5 },
  skill: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  skillText: { flex: 1, fontFamily: F.bold, fontSize: 14, color: C.navy },
  inProgress: { fontFamily: F.heavy, fontSize: 11, color: C.skyInk, backgroundColor: C.skyTint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  reco: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.peachTint, borderRadius: 22, padding: 16 },
  recoIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  recoKicker: { fontFamily: F.heavy, fontSize: 11, letterSpacing: 1, color: '#C2412B' },
  recoTitle: { fontFamily: F.heavy, fontSize: 16, color: C.navy },
  recoSub: { fontFamily: F.semi, fontSize: 13, color: C.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { fontFamily: F.heavy, fontSize: 15, color: C.navy },
  rowSub: { fontFamily: F.semi, fontSize: 12, color: C.muted, marginTop: 2 },
});
