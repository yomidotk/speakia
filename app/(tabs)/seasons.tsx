import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../src/components/Character';
import { Icon } from '../../src/components/Icon';
import { Sheet, k } from '../../src/components/kit';
import Place from '../../src/components/Place';
import { Button } from '../../src/components/ui';
import { EPISODES, PlaceId } from '../../src/content/episodes';
import { bestStars, getAttempts } from '../../src/storage';
import { C, F, shadow } from '../../src/theme';

type Season = { n: number; title: string; place: PlaceId; places: string; episodes: number; colour: string };

const SEASONS: Season[] = [
  { n: 1, title: 'Campus Life', place: 'gate', places: 'Gate · Office · Café · Library · Lab · Amphitheatre', episodes: EPISODES.length, colour: C.mint },
  { n: 2, title: 'Internship Hunt', place: 'office', places: 'Career fair · Phone call · Interview · First week', episodes: 4, colour: C.peach },
  { n: 3, title: 'Going Global', place: 'amphi', places: 'Exchange interview · Conference · Networking', episodes: 4, colour: C.sky },
];

/** Screen 10 · Seasons. */
export default function Seasons() {
  const [done, setDone] = useState(0);
  const [locked, setLocked] = useState<Season | null>(null);

  useFocusEffect(
    useCallback(() => {
      getAttempts().then((a) => setDone(Object.keys(bestStars(a)).length));
    }, [])
  );

  return (
    <SafeAreaView style={s.fill} edges={['top']}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text style={k.title}>Your seasons</Text>
          <Text style={k.sub}>Same friends. New places.</Text>
          <View style={s.cast}>
            {(['sara', 'rayan', 'lina', 'benali'] as const).map((w, i) => (
              <View key={w} style={{ marginLeft: i ? -10 : 0, borderRadius: 24, borderWidth: 3, borderColor: C.cream }}>
                <Avatar who={w} size={42} />
              </View>
            ))}
          </View>
        </View>

        {SEASONS.map((x, i) => (
          <SeasonCard
            key={x.n}
            season={x}
            index={i}
            locked={x.n > 1}
            count={x.n === 1 ? done : 0}
            onPress={() => (x.n > 1 ? setLocked(x) : router.push('/map'))}
          />
        ))}
      </ScrollView>

      <Sheet visible={!!locked} onClose={() => setLocked(null)} title={locked ? `${locked.title} is locked` : ''}>
        <Text style={k.sub}>Complete Campus Life to unlock {locked?.title}. Sara, Yacine and both professors come with you.</Text>
        <Button label="Back to Campus Life" onPress={() => { setLocked(null); router.push('/map'); }} />
      </Sheet>
    </SafeAreaView>
  );
}

function SeasonCard({
  season, index, locked, count, onPress,
}: { season: Season; index: number; locked: boolean; count: number; onPress: () => void }) {
  const enter = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const pct = Math.round((count / season.episodes) * 100);

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 320, delay: 90 * index, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(fill, { toValue: pct, duration: 700, delay: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [enter, fill, index, pct]);

  const springTo = (v: number) => Animated.spring(press, { toValue: v, friction: 5, tension: 200, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }, { scale: press }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => springTo(0.97)}
        onPressOut={() => springTo(1)}
        accessibilityRole="button"
        accessibilityLabel={`Season ${season.n}, ${season.title}. ${locked ? 'Locked' : `${count} of ${season.episodes} episodes, ${pct} percent`}`}
        style={[s.card, shadow, !locked && { borderColor: C.mint }]}
      >
        <View style={s.art}>
          <Place place={season.place} width={150} height={112} still />
          {locked && (
            <View style={s.dimmer}>
              <View style={s.lock}><Icon name="lock" size={18} color="#fff" stroke={2.6} /></View>
            </View>
          )}
        </View>
        <View style={{ flex: 1, padding: 14, gap: 3, justifyContent: 'center' }}>
          <Text style={s.kicker}>SEASON {season.n}</Text>
          <Text style={[s.title, locked && { color: '#4A5070' }]}>{season.title}</Text>
          <Text style={s.meta}>{season.episodes} episodes</Text>
          {locked ? (
            <Text style={s.unlock}>Unlocks after completing Campus Life</Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <View style={s.track}>
                <Animated.View style={[s.bar, { backgroundColor: season.colour, width: fill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
              </View>
              <Text style={s.pct}>{pct}%</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.cream },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  cast: { flexDirection: 'row', marginTop: 6, marginBottom: 6 },
  card: { flexDirection: 'row', backgroundColor: C.white, borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', minHeight: 112 },
  art: { width: 112, overflow: 'hidden', alignItems: 'center' },
  dimmer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(236,238,245,0.6)', alignItems: 'center', justifyContent: 'center' },
  lock: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#8A90AE', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.white },
  kicker: { fontFamily: F.heavy, fontSize: 11, letterSpacing: 1, color: C.skyInk },
  title: { fontFamily: F.display, fontSize: 21, color: C.navy, letterSpacing: -0.3 },
  meta: { fontFamily: F.semi, fontSize: 13, color: C.muted },
  unlock: { fontFamily: F.semi, fontSize: 12, color: C.muted, marginTop: 4 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#E4E6F0', overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  pct: { fontFamily: F.heavy, fontSize: 12, color: C.navy },
});
