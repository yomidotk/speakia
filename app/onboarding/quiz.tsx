import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Heading, Screen, StepBar, TopBar } from '../../src/components/kit';
import { Button } from '../../src/components/ui';
import { B1_QUIZ, PARTS, TEXTS } from '../../src/content/b1Quiz';
import { clearQuiz, scoreQuiz } from '../../src/placement';
import { C, F, shadow } from '../../src/theme';
import { Dialog } from '../../src/dialog';

const LETTERS = ['A', 'B', 'C', 'D'];

/** Placement test, part 1: the teacher's B1 quiz (grammar, vocabulary, linking, conversation, reading). */
export default function Quiz() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>(() => B1_QUIZ.map(() => null));
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => clearQuiz(), []);
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [i, fade]);

  const q = B1_QUIZ[i];
  const part = PARTS[q.part];
  const partNumber = Object.keys(PARTS).indexOf(q.part) + 1;
  const picked = picks[i];
  const last = i === B1_QUIZ.length - 1;

  const choose = (opt: number) => setPicks((p) => p.map((v, n) => (n === i ? opt : v)));

  const next = () => {
    if (picked === null) return;
    if (!last) return setI(i + 1);
    scoreQuiz(picks);
    router.replace(edit ? '/onboarding/test?edit=1' : '/onboarding/test');
  };

  const back = () => {
    if (i > 0) return setI(i - 1);
    Dialog.alert('Leave the test?', 'Your answers will not be kept.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  // show the gap as a visible blank
  const [before, after] = q.prompt.includes('___') ? q.prompt.split('___') : [q.prompt, ''];
  const hasGap = q.prompt.includes('___');

  return (
    <Screen
      top={
        <>
          <TopBar onBack={back} />
          <View style={{ paddingHorizontal: 24, paddingBottom: 8 }}><StepBar value={(i + (picked === null ? 0 : 1)) / B1_QUIZ.length} /></View>
        </>
      }
      footer={<Button label={last ? 'Continue to speaking' : 'Next'} onPress={next} disabled={picked === null} />}
    >
      <Heading
        kicker={`Part 1 · Quiz · Question ${q.n} of ${B1_QUIZ.length}`}
        title={`${partNumber}. ${part.title}`}
        sub={`${part.skill}. ${part.instruction}`}
      />

      <Animated.View style={{ gap: 14, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
        {q.text && (
          <View style={[s.textCard, shadow]}>
            <Text style={s.textTitle}>{TEXTS[q.text].title}</Text>
            <Text style={s.textBody}>{TEXTS[q.text].body}</Text>
          </View>
        )}

        <Text style={s.prompt} accessibilityLabel={q.prompt.replace('___', 'blank')}>
          {before}
          {hasGap && <Text style={[s.gap, picked !== null && s.gapFilled]}>{picked !== null ? ` ${q.options[picked]} ` : '          '}</Text>}
          {after}
        </Text>

        <View style={{ gap: 10 }}>
          {q.options.map((opt, n) => {
            const on = picked === n;
            return (
              <Pressable
                key={n}
                onPress={() => choose(n)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${LETTERS[n]}, ${opt}`}
                style={({ pressed }) => [s.option, on && s.optionOn, pressed && !on && { backgroundColor: C.skyTint }]}
              >
                <View style={[s.letter, on && { backgroundColor: C.skyInk }]}>
                  <Text style={[s.letterText, on && { color: C.white }]}>{LETTERS[n]}</Text>
                </View>
                <Text style={s.optionText}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </Screen>
  );
}

const s = StyleSheet.create({
  textCard: { backgroundColor: C.white, borderRadius: 18, padding: 16, gap: 8, borderLeftWidth: 5, borderLeftColor: C.sky },
  textTitle: { fontFamily: F.heavy, fontSize: 12, letterSpacing: 0.6, color: C.skyInk, textTransform: 'uppercase' },
  textBody: { fontFamily: F.body, fontSize: 15, lineHeight: 23, color: C.navy },
  prompt: { fontFamily: F.bold, fontSize: 20, lineHeight: 30, color: C.navy },
  gap: { textDecorationLine: 'underline', color: C.muted, backgroundColor: C.skyTint, borderRadius: 6 },
  gapFilled: { color: C.skyInk, fontFamily: F.heavy },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 2, borderColor: '#E7E9F3', backgroundColor: C.white },
  optionOn: { borderColor: C.skyInk, backgroundColor: C.skyTint },
  letter: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.skyTint, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontFamily: F.heavy, fontSize: 14, color: C.skyInk },
  optionText: { flex: 1, fontFamily: F.semi, fontSize: 16, lineHeight: 22, color: C.navy },
});
