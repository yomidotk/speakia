import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState,
} from 'expo-audio';
import Character from '../../src/components/Character';
import { Icon } from '../../src/components/Icon';
import { Heading, Screen, StepBar, TopBar, k } from '../../src/components/kit';
import { Button } from '../../src/components/ui';
import { assessSpeaking, isDemo, transcribe } from '../../src/api';
import { draft } from '../../src/draft';
import { Level } from '../../src/storage';
import { QUESTIONS, combineLevel, estimateLevel, lastQuiz, setAssessment } from '../../src/placement';
import { C, F, shadow } from '../../src/theme';
import { Dialog } from '../../src/dialog';

type Phase = 'idle' | 'recording' | 'processing' | 'review' | 'nospeech' | 'error' | 'assessing';
const MAX_MS = 45_000;

// Kept outside the component so leaving and coming back preserves finished answers.
const answers: string[] = [];
const seconds: (number | undefined)[] = []; // speaking time per answer (undefined when typed)

const mmss = (ms: number) => {
  const sec = Math.min(45, Math.floor(ms / 1000));
  return `00:${String(sec).padStart(2, '0')}`;
};

/** Screen 07 · Speaking placement test: four prompts, each up to 45 seconds. */
export default function PlacementTest() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const [q, setQ] = useState(Math.min(answers.length, QUESTIONS.length - 1));
  const [phase, setPhase] = useState<Phase>(answers[q] ? 'review' : 'idle');
  const [text, setText] = useState(answers[q] ?? '');
  const [message, setMessage] = useState(isDemo ? 'Voice needs the server. For now, type your answer.' : '');

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder, 200);
  const elapsed = rec.durationMillis ?? 0;

  const pulse = useRef(new Animated.Value(0)).current;
  // made once: a new interpolation on every render makes react-native-web re-render in a loop
  const ring = useMemo(() => ({
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }),
  }), [pulse]);
  useEffect(() => {
    if (phase !== 'recording') return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => { loop.stop(); pulse.setValue(0); };
  }, [phase, pulse]);

  useEffect(() => {
    if (phase === 'recording' && elapsed >= MAX_MS) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, phase]);

  const start = async () => {
    setMessage('');
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setMessage('The microphone is off. Allow it in Settings, or type your answer.');
        setPhase('error');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch {
      setMessage('Could not start the microphone. Try again.');
      setPhase('error');
    }
  };

  const stop = async () => {
    const spokenMs = elapsed;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      setPhase('processing');
      const uri = recorder.uri;
      const t = uri ? await transcribe(uri) : '';
      if (!t) {
        setPhase('nospeech');
        return;
      }
      setText(t);
      seconds[q] = spokenMs / 1000;
      setPhase('review');
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      console.warn('[speakia] test recording failed:', why);
      setMessage(
        why.startsWith('Sign in')
          ? 'You’re not signed in, so your answer can’t be checked. Sign in, then try again, or type your answer.'
          : 'We couldn’t turn your answer into text. Try again, or type it.'
      );
      setPhase('error');
    }
  };

  const retry = () => {
    seconds[q] = undefined;
    setText('');
    setPhase('idle');
    setMessage('');
  };

  const next = () => {
    const answer = text.trim();
    if (!answer) return;
    answers[q] = answer;
    if (q < QUESTIONS.length - 1) {
      const n = q + 1;
      setQ(n);
      setText(answers[n] ?? '');
      setPhase(answers[n] ? 'review' : 'idle');
      return;
    }
    finish();
  };

  /** Send all answers to the AI teacher; fall back to the quick on-phone estimate if it can't answer. */
  const finish = async () => {
    setPhase('assessing');
    const given = QUESTIONS.map((Q, i) => ({ question: `${Q.title} ${Q.sub}`, text: answers[i] ?? '', seconds: seconds[i] }));
    let speaking: Level;
    let confident: boolean;
    try {
      const a = await assessSpeaking(given);
      setAssessment(a);
      speaking = a.level;
      confident = a.confident;
    } catch (e) {
      console.warn('[speakia] AI evaluation failed, using the quick estimate:', e instanceof Error ? e.message : e);
      setAssessment(null);
      const est = estimateLevel(answers);
      speaking = est.level;
      confident = est.confident;
    }
    answers.length = 0;
    seconds.length = 0;
    const level = combineLevel(speaking, lastQuiz);
    if (confident) Object.assign(draft, { level, levelSource: 'test' });
    router.replace({
      pathname: '/onboarding/result',
      params: { level, speaking, low: confident ? undefined : '1', edit },
    });
  };

  const leave = () =>
    Dialog.alert('Leave the test?', 'Your finished answers are kept for when you come back.', [
      { text: 'Continue test', style: 'cancel' },
      { text: 'Save and leave', onPress: () => router.back() },
    ]);

  const canNext = !!text.trim() && phase !== 'recording' && phase !== 'processing';
  const last5 = phase === 'recording' && elapsed >= MAX_MS - 5000;
  const Q = QUESTIONS[q];

  if (phase === 'assessing') {
    return (
      <Screen top={<TopBar onBack={() => {}} />}>
        <View style={s.assessing}>
          <Character who="sara" size={150} />
          <ActivityIndicator color={C.skyInk} size="large" />
          <Text style={[k.title, { fontSize: 22, textAlign: 'center' }]}>Checking your answers…</Text>
          <Text style={[k.sub, { textAlign: 'center' }]}>Our AI teacher is looking at your grammar, vocabulary, fluency and how you link your ideas.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      top={
        <>
          <TopBar onBack={phase === 'recording' ? undefined : leave} />
          <View style={{ paddingHorizontal: 24, paddingBottom: 8 }}><StepBar value={(q + (canNext ? 1 : 0.4)) / QUESTIONS.length} /></View>
        </>
      }
      footer={<Button label={q === QUESTIONS.length - 1 ? 'See my level' : 'Next question'} onPress={next} disabled={!canNext} />}
    >
      <Heading kicker={`Part 2 · Speaking · Question ${q + 1} of ${QUESTIONS.length}`} title="Now, speak" />

      <View style={s.promptRow}>
        <Character who="sara" size={84} talking={false} />
        <View style={[s.prompt, shadow]}>
          <Text style={s.promptTitle}>{Q.title}</Text>
          <Text style={s.promptSub}>{Q.sub}</Text>
        </View>
      </View>
      <Text style={s.cap}>Up to 45 seconds</Text>

      {(phase === 'review' || isDemo || phase === 'error') && (
        <View style={s.transcript}>
          <Text style={s.tLabel}>{isDemo || phase === 'error' ? 'YOUR ANSWER' : 'TRANSCRIPT · YOU CAN FIX IT'}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Say it in your own words…"
            placeholderTextColor="#9AA0BC"
            multiline
            maxLength={500}
            style={s.tInput}
            accessibilityLabel="Your answer"
          />
        </View>
      )}

      {!!message && <Text style={[k.sub, { textAlign: 'center' }]} accessibilityLiveRegion="polite">{message}</Text>}
      {phase === 'nospeech' && (
        <Text style={[k.sub, { textAlign: 'center', color: C.navy }]} accessibilityLiveRegion="polite">
          No speech detected. Try again a little closer to the phone.
        </Text>
      )}

      {!isDemo && (
        <View style={s.micArea}>
          <View style={s.micWrap}>
            {phase === 'recording' && (
              <Animated.View
                style={[s.ring, {
                  opacity: ring.opacity,
                  transform: [{ scale: ring.scale }],
                }]}
              />
            )}
            <Pressable
              onPress={phase === 'recording' ? stop : start}
              disabled={phase === 'processing'}
              accessibilityRole="button"
              accessibilityLabel={phase === 'recording' ? 'Stop recording' : 'Start recording'}
              style={[s.mic, { backgroundColor: phase === 'recording' ? C.peach : C.skyInk, opacity: phase === 'processing' ? 0.5 : 1 }]}
            >
              <Icon name={phase === 'recording' ? 'stop' : 'mic'} size={34} color="#fff" stroke={2.4} />
            </Pressable>
          </View>
          <Text style={[s.timer, last5 && { color: '#C2412B' }]} accessibilityLiveRegion="polite">
            {phase === 'recording'
              ? `${mmss(elapsed)} / 00:45 · ${last5 ? `${Math.ceil((MAX_MS - elapsed) / 1000)} s left` : 'Tap to stop'}`
              : phase === 'processing'
                ? 'Transcribing…'
                : phase === 'review'
                  ? ''
                  : 'Tap to speak'}
          </Text>
          {phase === 'review' && (
            <Pressable onPress={retry} accessibilityRole="button" style={s.retry}>
              <Icon name="replay" size={18} color={C.skyInk} />
              <Text style={s.retryText}>Record again</Text>
            </Pressable>
          )}
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  promptRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  prompt: { flex: 1, backgroundColor: C.skyTint, borderRadius: 20, borderBottomLeftRadius: 4, padding: 16, gap: 4, marginBottom: 20 },
  promptTitle: { fontFamily: F.heavy, fontSize: 18, color: C.navy },
  promptSub: { fontFamily: F.semi, fontSize: 14, color: C.muted },
  cap: { alignSelf: 'flex-start', fontFamily: F.heavy, fontSize: 12, color: C.navy, backgroundColor: C.skyTint, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden', marginTop: -6 },
  transcript: { backgroundColor: C.white, borderRadius: 18, padding: 14, gap: 6, borderWidth: 2, borderColor: '#E7E9F3' },
  tLabel: { fontFamily: F.heavy, fontSize: 11, letterSpacing: 1, color: C.skyInk },
  tInput: { fontFamily: F.semi, fontSize: 16, lineHeight: 23, color: C.navy, minHeight: 80, textAlignVertical: 'top' },
  micArea: { alignItems: 'center', gap: 12, marginTop: 8 },
  micWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: C.peach },
  mic: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', ...shadow },
  timer: { fontFamily: F.heavy, fontSize: 14, color: C.navy, minHeight: 20 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 },
  retryText: { fontFamily: F.heavy, fontSize: 14, color: C.skyInk },
  assessing: { alignItems: 'center', gap: 16, paddingTop: 40 },
});
