import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Character, { Avatar } from '../../../src/components/Character';
import Place from '../../../src/components/Place';
import { BackButton } from '../../../src/components/BackButton';
import { Body, Button, Label, Title } from '../../../src/components/ui';
import { CAST } from '../../../src/content/cast';
import { getEpisode, personalise } from '../../../src/content/episodes';
import { useLearnerName } from '../../../src/useLearnerName';
import { prepareLines } from '../../../src/voice';
import { C, F } from '../../../src/theme';

/** Screen 11 · Episode introduction: where we are, who is here. */
export default function Intro() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ep = getEpisode(id);
  const { width, height } = useWindowDimensions();
  const artHeight = Math.min(300, Math.max(180, height * 0.32));

  const name = useLearnerName();

  // While the learner reads the intro, prepare just the first two lines; avoid generating unused scenes.
  useEffect(() => {
    if (!ep || name === null) return;
    const lines = ep.guide
      ? ep.guide.lines.map((l) => ({ who: ep.guide!.partner, text: l.say }))
      : [...ep.scene, ...ep.roles.map((r) => ({ who: r.partner, text: r.opening }))];
    prepareLines(lines.slice(0, 2).map((l) => ({ ...l, text: personalise(l.text, name) })));
  }, [ep, name]);

  if (!ep) return null;
  const people = ep.guide ? [ep.guide.partner] : Array.from(new Set(ep.scene.map((l) => l.who)));

  return (
    <View style={s.fill}>
      <View style={{ height: artHeight }}>
        <Place place={ep.place} width={width} height={artHeight} />
        <View style={s.cast}>
          {people.map((p) => (
            <Character key={p} who={p} size={150} />
          ))}
        </View>
        <SafeAreaView edges={['top']} style={s.topBar}>
          <BackButton />
          <Text style={s.pill}>{ep.time}</Text>
        </SafeAreaView>
      </View>
      <ScrollView style={s.sheet} contentContainerStyle={{ padding: 22, gap: 14, paddingBottom: 32 }}>
        <Label>{`Level ${ep.level} · ${ep.placeName}`}</Label>
        <Title size={34}>{ep.title}</Title>
        <Body>{ep.summary}</Body>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {people.map((p) => (
            <View key={p} style={[s.who, { backgroundColor: CAST[p].tint }]}>
              <Avatar who={p} size={28} />
              <Text style={s.whoText}>{CAST[p].shortName}</Text>
            </View>
          ))}
          <View style={[s.who, { backgroundColor: C.skyTint, paddingLeft: 12 }]}>
            <Text style={[s.whoText, { color: C.skyInk }]}>+ You</Text>
          </View>
        </View>
        <View style={s.focus}>
          <Text style={s.focusText}>
            <Text style={{ fontFamily: F.heavy }}>Speaking focus: </Text>
            {ep.focus.toLowerCase()}.{ep.guide ? ' Sara will talk to you straight away.' : ' First watch what happens, then step in.'}
          </Text>
        </View>
        {ep.guide ? (
          <Button label="Start talking" onPress={() => router.push({ pathname: '/episode/[id]/speak', params: { id: ep.id } })} />
        ) : (
          <Button label="Watch the scene" onPress={() => router.push({ pathname: '/episode/[id]/watch', params: { id: ep.id } })} />
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.cream },
  cast: { position: 'absolute', bottom: 18, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around' },
  topBar: { position: 'absolute', top: 0, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { fontFamily: F.heavy, fontSize: 12, color: C.navy, backgroundColor: C.white, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, overflow: 'hidden', marginTop: 8 },
  sheet: { flex: 1, marginTop: -28, backgroundColor: C.white, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingVertical: 5, paddingLeft: 5, paddingRight: 12 },
  whoText: { fontFamily: F.heavy, fontSize: 13, color: C.navy },
  focus: { backgroundColor: C.cream, borderColor: C.line, borderWidth: 1.5, borderRadius: 18, padding: 14 },
  focusText: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.navy },
});
