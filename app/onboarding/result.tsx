import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Character from '../../src/components/Character';
import { Heading, Screen, TopBar, k } from '../../src/components/kit';
import { Button } from '../../src/components/ui';
import { PARTS } from '../../src/content/b1Quiz';
import { draft, finishOnboarding } from '../../src/draft';
import { lastAssessment, lastQuiz } from '../../src/placement';
import { LEVELS, Level, updateProfile } from '../../src/storage';
import { C, F, shadow } from '../../src/theme';

const CRITERIA = [
  { key: 'range', title: 'Range (words and structures)' },
  { key: 'accuracy', title: 'Accuracy (grammar)' },
  { key: 'fluency', title: 'Fluency' },
  { key: 'coherence', title: 'Linking ideas' },
] as const;

/** Screen 08 · Level result (from the test) or level welcome (manual choice). */
export default function LevelResult() {
  const p = useLocalSearchParams<{ level?: Level; speaking?: Level; manual?: string; low?: string; edit?: string }>();
  const manual = !!p.manual;
  const low = !!p.low;
  const level = (manual ? draft.level : p.level) ?? 'B1';
  const info = LEVELS.find((l) => l.id === level)!;

  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, delay: 150, useNativeDriver: true }).start();
  }, [pop]);

  const start = async () => {
    if (p.edit) {
      await updateProfile({ level, levelSource: 'test' });
      router.dismissAll(); // back to the tabs, where Me is open
    } else {
      finishOnboarding();
    }
  };

  if (low) {
    return (
      <Screen
        top={<TopBar />}
        footer={
          <>
            <Button label="Retry the test" onPress={() => router.replace(p.edit ? '/onboarding/test?edit=1' : '/onboarding/test')} />
            <Button label="Choose my level" variant="secondary" onPress={() => router.replace(p.edit ? '/onboarding/level?edit=1' : '/onboarding/level')} />
          </>
        }
      >
        <View style={{ alignItems: 'center', marginTop: 12 }}><Character who="sara" size={150} /></View>
        <Heading title="We need a little more speech" sub="Your answers were too short for us to estimate a level. Try again and say a bit more each time, or choose your level yourself." />
      </Screen>
    );
  }

  return (
    <Screen
      top={<TopBar />}
      footer={<Button label={p.edit ? 'Save my new level' : 'Start my journey'} onPress={start} />}
    >
      <Heading
        title={manual ? `Welcome to ${level}` : 'Your Speakia level'}
        sub={manual ? 'Selected level' : 'Estimated speaking level'}
      />
      <Animated.View
        style={[s.card, shadow, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}
      >
        <View style={s.badge}>
          <Text style={s.level}>{level}</Text>
        </View>
        <Text style={s.ribbon}>{info.name}</Text>
        <Text style={s.about}>{info.about}</Text>
      </Animated.View>

      {!manual && lastQuiz && (
        <View style={[s.breakdown, shadow]}>
          <View style={s.row}>
            <Text style={s.rowTitle}>B1 quiz</Text>
            <Text style={[s.rowScore, { color: lastQuiz.passed ? C.mintDark : '#C2412B' }]}>
              {lastQuiz.correct}/{lastQuiz.total} · {lastQuiz.passed ? 'B1 ✓' : 'below B1'}
            </Text>
          </View>
          {(Object.keys(PARTS) as (keyof typeof PARTS)[]).map((part) => {
            const r = lastQuiz!.byPart[part];
            if (!r) return null;
            return (
              <View key={part} style={s.partRow}>
                <Text style={s.partName}>{PARTS[part].title}</Text>
                <View style={s.track}><View style={[s.fill, { width: `${(r.correct / r.total) * 100}%` }]} /></View>
                <Text style={s.partScore}>{r.correct}/{r.total}</Text>
              </View>
            );
          })}
          {p.speaking && (
            <View style={[s.row, { marginTop: 6 }]}>
              <Text style={s.rowTitle}>Speaking</Text>
              <Text style={s.rowScore}>{p.speaking}</Text>
            </View>
          )}
          {!lastQuiz.passed && p.speaking && p.speaking !== level && (
            <Text style={s.note}>
              Your speaking sounded like {p.speaking}, but B1 also needs B1 grammar and vocabulary, so your level is {level} for now.
              Practising in the stories will close that gap.
            </Text>
          )}
        </View>
      )}

      {!manual && lastAssessment && (
        <View style={[s.breakdown, shadow]}>
          <Text style={s.rowTitle}>Your speaking</Text>
          {CRITERIA.map(({ key, title }) => {
            const c = lastAssessment!.criteria[key];
            return (
              <View key={key} style={s.criterion}>
                <View style={s.row}>
                  <Text style={s.critTitle}>{title}</Text>
                  {c.level ? <Text style={s.critLevel}>{c.level}</Text> : <Text style={s.critNa}>not judged</Text>}
                </View>
                {!!c.note && <Text style={s.critNote}>{c.note}</Text>}
              </View>
            );
          })}
          {lastAssessment.strengths.length > 0 && (
            <View style={[s.feedback, { backgroundColor: C.mintTint }]}>
              <Text style={s.feedbackTitle}>What went well</Text>
              {lastAssessment.strengths.map((t) => <Text key={t} style={s.feedbackText}>• {t}</Text>)}
            </View>
          )}
          {lastAssessment.improve.length > 0 && (
            <View style={[s.feedback, { backgroundColor: C.peachTint }]}>
              <Text style={s.feedbackTitle}>Work on</Text>
              {lastAssessment.improve.map((t) => <Text key={t} style={s.feedbackText}>• {t}</Text>)}
            </View>
          )}
          {lastAssessment.corrections.length > 0 && (
            <View style={[s.feedback, { backgroundColor: C.sunTint }]}>
              <Text style={s.feedbackTitle}>Say it better</Text>
              {lastAssessment.corrections.map((c) => (
                <Text key={c.said} style={s.feedbackText}>
                  <Text style={{ textDecorationLine: 'line-through', color: C.muted }}>{c.said}</Text>  →  <Text style={{ fontFamily: F.heavy }}>{c.better}</Text>
                </Text>
              ))}
            </View>
          )}
          <Text style={s.disclaimer}>Pronunciation isn’t scored yet: the AI reads a transcript of what you said.</Text>
        </View>
      )}
      {!manual && !lastAssessment && (
        <Text style={k.tileSub as object}>Quick estimate: the AI teacher couldn’t be reached, so this level comes from how much and how varied you spoke.</Text>
      )}

      <View style={s.cast}>
        <Character who="yacine" size={96} happy />
        <Character who="sara" size={96} happy />
      </View>
      <Text style={[k.title, { fontSize: 22, lineHeight: 28 }]}>Your journey starts here.</Text>
      {!manual && <Text style={k.tileSub as object}>This is a practice estimate, not an official CEFR certification. You can change it anytime in Me.</Text>}
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 28, padding: 24, alignItems: 'center', gap: 10, marginTop: 8 },
  badge: { width: 128, height: 128, borderRadius: 64, borderWidth: 8, borderColor: C.skyTint, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  level: { fontFamily: F.display, fontSize: 52, color: C.skyInk, letterSpacing: -1 },
  ribbon: { fontFamily: F.heavy, fontSize: 16, color: C.navy, backgroundColor: C.sun, paddingHorizontal: 22, paddingVertical: 8, borderRadius: 12, overflow: 'hidden', marginTop: -26 },
  about: { fontFamily: F.semi, fontSize: 15, lineHeight: 22, color: C.muted, textAlign: 'center' },
  cast: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  breakdown: { backgroundColor: C.white, borderRadius: 22, padding: 16, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { fontFamily: F.display, fontSize: 18, color: C.navy },
  rowScore: { fontFamily: F.heavy, fontSize: 15, color: C.skyInk },
  partRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  partName: { width: 150, fontFamily: F.semi, fontSize: 13, color: C.muted },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.track, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: C.sky },
  partScore: { width: 32, textAlign: 'right', fontFamily: F.heavy, fontSize: 12, color: C.navy },
  note: { fontFamily: F.semi, fontSize: 13, lineHeight: 19, color: C.navy, backgroundColor: C.sunTint, borderRadius: 12, padding: 10, marginTop: 4 },
  criterion: { gap: 2, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.track },
  critTitle: { fontFamily: F.bold, fontSize: 14, color: C.navy, flex: 1 },
  critLevel: { fontFamily: F.heavy, fontSize: 13, color: C.skyInk, backgroundColor: C.skyTint, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  critNa: { fontFamily: F.semi, fontSize: 12, color: C.muted },
  critNote: { fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.muted },
  feedback: { borderRadius: 14, padding: 12, gap: 4 },
  feedbackTitle: { fontFamily: F.heavy, fontSize: 13, color: C.navy },
  feedbackText: { fontFamily: F.semi, fontSize: 13, lineHeight: 19, color: C.navy },
  disclaimer: { fontFamily: F.semi, fontSize: 11, lineHeight: 16, color: C.muted, marginTop: 2 },
});
