import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, AppState, Easing, KeyboardAvoidingView, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Button, Label } from '../../../src/components/ui';
import { Sheet } from '../../../src/components/kit';
import { BackButton } from '../../../src/components/BackButton';
import { CAST } from '../../../src/content/cast';
import { getEpisode, guideRole } from '../../../src/content/episodes';
import { isDemo, transcribe } from '../../../src/api';
import { answerPractice, requestId, startPractice, type PracticeReply } from '../../../src/practice-api';
import { duration, elapsed, measuredReport, revealHint, type Measurements } from '../../../src/practice-core';
import { addAttempt, getProfile, practiceLocal, savePracticeLocal, type Profile } from '../../../src/storage';
import { say, stopSpeaking } from '../../../src/voice';
import { C, F } from '../../../src/theme';

type Phase = 'partner' | 'you' | 'recording' | 'thinking' | 'paused' | 'review';
type Answer = Parameters<typeof answerPractice>[0];
type Saved = { response: PracticeReply; clock: { startedAt: number; pausedMs: number; pauseStarted: number | null }; hints: Measurements['hintReveals']; lastSeen: number; pending?: Answer; composer?: { draft: string; typing: boolean; review: { original: string; ms: number } | null } };
const MAX_MS = 45_000;

export default function Speak() {
  const { id, role: roleParam } = useLocalSearchParams<{ id: string; role: string }>();
  const ep = getEpisode(id)!;
  const roleIndex = Number(roleParam || 0);
  const role = ep.guide ? guideRole(ep.guide) : ep.roles[roleIndex];
  const partner = CAST[role.partner];

  const key = `active-${ep.id}-${roleIndex}`;
  const [response, setResponse] = useState<PracticeReply | null>(null);
  const current = useRef<PracticeReply | null>(null);
  const [phase, setPhase] = useState<Phase>('thinking');
  const phaseRef = useRef<Phase>('thinking');
  const changePhase = (p: Phase) => { phaseRef.current = p; setPhase(p); };
  const [talking, setTalking] = useState(false);
  const [typing, setTyping] = useState(isDemo);
  const [draft, setDraft] = useState('');
  const [review, setReview] = useState<{ original: string; ms: number } | null>(null);
  const [options, setOptions] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [hintsOpen, setHintsOpen] = useState(false);
  const transcript = useRef<ScrollView>(null);
  const [hintLevel, setHintLevel] = useState<1 | 2 | 3 | 0>(0);
  const [idle, setIdle] = useState(0);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const profile = useRef<Profile | null>(null);
  const clock = useRef({ startedAt: Date.now(), pausedMs: 0, pauseStarted: null as number | null });
  const hintEvents = useRef<Measurements['hintReveals']>([]);
  const pending = useRef<Answer | undefined>(undefined);
  const startId = useRef(requestId());
  const busy = useRef(false);
  const alive = useRef(true);
  const finished = useRef(false);
  const epoch = useRef(0);
  const recStart = useRef(0);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recState = useAudioRecorderState(recorder, 250);

  const composerState = useRef({ draft, typing, review });
  useEffect(() => { composerState.current = { draft, typing, review }; checkpoint(); }, [draft, typing, review]);
  const checkpoint = () => {
    if (!current.current || finished.current) return;
    const value: Saved = { response: current.current, clock: { ...clock.current }, hints: hintEvents.current, lastSeen: Date.now(), pending: pending.current, composer: composerState.current };
    void savePracticeLocal(key, value).catch(() => {});
  };
  const invalidateVoice = () => { epoch.current++; stopSpeaking(); setTalking(false); };
  const finish = async () => {
    const r = current.current;
    if (!r || finished.current || busy.current || phaseRef.current === 'recording') return;
    finished.current = true;
    invalidateVoice(); changePhase('thinking');
    const times = elapsed(clock.current.startedAt, Date.now(), clock.current.pausedMs, clock.current.pauseStarted);
    const measurements: Measurements = { totalMs: times.totalMs, pausedMs: times.totalMs - times.activeMs, hintReveals: hintEvents.current };
    const snapshot = { ...r.snapshot, endedAt: r.snapshot.endedAt || Date.now(), endReason: r.snapshot.endReason || 'manual_end' };
    const report = measuredReport(snapshot, measurements);
    const stars = snapshot.completed ? report.hintReveals === 0 ? 3 : report.hintReveals <= 2 ? 2 : 1 : 0;
    try {
      await savePracticeLocal(`report-${snapshot.id}`, { request: { requestId: requestId(), stateToken: r.stateToken, measurements }, snapshot });
      await addAttempt({ sessionId: snapshot.id, episodeId: ep.id, role: role.player ? CAST[role.player].shortName : 'You', stars, hints: report.hintReveals, words: report.words, turns: report.turns, speakingMs: report.recordingMs, finishedAt: snapshot.endedAt, report });
      await savePracticeLocal(key, null);
      router.replace({ pathname: '/episode/[id]/result', params: { id: ep.id, session: snapshot.id } });
    } catch {
      finished.current = false; setError('Could not save this session. Try End and save again.'); changePhase('you');
    }
  };
  const play = (r: PracticeReply) => {
    invalidateVoice(); const ticket = epoch.current;
    changePhase('partner');
    // Fish accepts at most 400 characters per request. Keep cached script and live reaction separate.
    const queue = r.speechParts.flatMap((part) => (part.text.match(/.{1,380}(?:\s|$)|.{1,380}/gs) || []).map((text) => ({ ...part, text: text.trim() }))).filter((p) => p.text);
    const next = () => {
      if (!alive.current || ticket !== epoch.current) return;
      const part = queue.shift();
      if (!part) { setTalking(false); if (r.done) void finish(); else changePhase('you'); return; }
      let partDone = false;
      const done = () => { if (partDone || ticket !== epoch.current) return; partDone = true; next(); };
      void say(role.partner, part.text, { onStart: () => { if (!partDone && ticket === epoch.current) setTalking(true); }, onDone: done }, false, part.live).catch(() => {
        if (ticket === epoch.current) setError('Voice playback failed. You can read the dialogue or replay it.');
        done();
      });
    };
    next();
  };
  const pause = () => {
    if (!current.current || !['you', 'partner', 'review'].includes(phaseRef.current)) return;
    clock.current.pauseStarted ??= Date.now(); invalidateVoice(); changePhase('paused'); checkpoint();
  };
  const resume = () => {
    if (clock.current.pauseStarted !== null) clock.current.pausedMs += Date.now() - clock.current.pauseStarted;
    clock.current.pauseStarted = null; changePhase(review ? 'review' : 'you'); checkpoint();
    if (current.current?.done) void finish();
  };
  const boot = async () => {
    if (busy.current) return; busy.current = true; setError(''); changePhase('thinking');
    try {
      profile.current = await getProfile();
      const saved = await practiceLocal<Saved>(key);
      if (!alive.current) return;
      if (saved) {
        current.current = saved.response; setResponse(saved.response);
        hintEvents.current = saved.hints; pending.current = saved.pending;
        clock.current = { ...saved.clock, pausedMs: saved.clock.pausedMs + Math.max(0, Date.now() - (saved.clock.pauseStarted || saved.lastSeen)), pauseStarted: Date.now() };
        if (saved.pending) {
          setDraft(saved.pending.text); setTyping(true);
          if (saved.pending.source === 'speech') setReview({ original: saved.pending.edited ? '' : saved.pending.text, ms: saved.pending.recordingMs });
        }
        if (saved.composer) { setDraft(saved.composer.draft); setTyping(saved.composer.typing); setReview(saved.composer.review); }
        changePhase('paused');
      } else {
        const r = await startPractice({ requestId: startId.current, episodeId: ep.id, roleIndex, learnerName: profile.current?.name });
        if (!alive.current) return;
        current.current = r; setResponse(r); clock.current.startedAt = Date.now(); checkpoint();
        busy.current = false; play(r);
      }
    } catch (e) { if (alive.current) { setError(e instanceof Error ? e.message : 'Could not start. Retry.'); changePhase('you'); } }
    finally { busy.current = false; }
  };
  useEffect(() => {
    alive.current = true; void boot();
    const tick = setInterval(() => { setNow(Date.now()); checkpoint(); }, 1000);
    const subscription = AppState.addEventListener('change', (s) => { if (s !== 'active') pause(); });
    return () => { alive.current = false; epoch.current++; stopSpeaking(); clearInterval(tick); subscription.remove(); clock.current.pauseStarted ??= Date.now(); checkpoint(); };
    // Session is mounted once per route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setIdle(0);
    if (phase !== 'you' || typing || draft.trim() || hintsOpen) return;
    const timer = setInterval(() => setIdle((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [phase, typing, draft, hintsOpen, response?.snapshot.turns.length]);
  useEffect(() => {
    if (phase === 'recording' && recState.durationMillis >= MAX_MS) void stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, recState.durationMillis]);

  const answer = async () => {
    const r = current.current; const text = draft.trim();
    if (!r || !text || busy.current || !['you', 'review'].includes(phaseRef.current)) return;
    const candidate: Answer = { requestId: '', stateToken: r.stateToken, text, source: review ? 'speech' : 'typed', recordingMs: review?.ms || 0, edited: !!review && text !== review.original, level: profile.current?.level || 'B1', major: profile.current?.major || '' };
    const prior = pending.current;
    candidate.requestId = prior && JSON.stringify({ ...prior, requestId: '' }) === JSON.stringify(candidate) ? prior.requestId : requestId();
    pending.current = candidate; busy.current = true; changePhase('thinking'); setError(''); checkpoint();
    try {
      const next = await answerPractice(candidate);
      current.current = next; pending.current = undefined; checkpoint();
      if (!alive.current) return;
      setResponse(next); setDraft(''); setReview(null); setHintLevel(0); setHintsOpen(false); setIdle(0);
      busy.current = false; play(next);
    } catch (e) {
      if (alive.current) { setError(e instanceof Error ? e.message : 'Connection failed. Your answer is kept; retry.'); changePhase(review ? 'review' : 'you'); setTyping(true); }
    } finally { busy.current = false; }
  };
  const startRecording = async () => {
    if (busy.current || phaseRef.current !== 'you') return;
    if (isDemo) { setTyping(true); setError('Voice needs the configured server. This is a script preview.'); return; }
    busy.current = true; setError('');
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) throw new Error('Allow the microphone or type your answer.');
      invalidateVoice();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync(); recorder.record(); recStart.current = Date.now(); changePhase('recording');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start microphone.'); setTyping(true); }
    finally { busy.current = false; }
  };
  const stopRecording = async () => {
    if (busy.current || phaseRef.current !== 'recording') return;
    busy.current = true; changePhase('thinking');
    try {
      await recorder.stop(); const ms = Math.min(MAX_MS, Date.now() - recStart.current);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!recorder.uri) throw new Error('No recording was captured. Try again.');
      const text = await transcribe(recorder.uri);
      if (!text) throw new Error('No words detected. Try again or type.');
      if (!alive.current) return;
      setDraft(text); setReview({ original: text, ms }); setTyping(true); changePhase('review');
    } catch (e) { if (alive.current) { setError(e instanceof Error ? e.message : 'Could not transcribe. Try again or type.'); changePhase('you'); } }
    finally { busy.current = false; }
  };
  const showHint = (tier: 1 | 2 | 3) => {
    if (phaseRef.current !== 'you') return;
    hintEvents.current = revealHint(hintEvents.current, current.current?.snapshot.turns.length || 0, tier);
    setHintLevel(tier); checkpoint();
  };
  const snapshot = response?.snapshot;
  const times = elapsed(clock.current.startedAt, now, clock.current.pausedMs, clock.current.pauseStarted);
  const lastPartner = [...(snapshot?.history || [])].reverse().find((l) => l.from === 'partner')?.text || 'You speak first. Welcome the new student.';
  const findings = snapshot?.turns.at(-1)?.corrections || [];
  const status = phase === 'recording' ? `Recording ${duration(recState.durationMillis)} / 00:45` : phase === 'thinking' ? 'Please wait…' : phase === 'partner' ? `${partner.shortName} is speaking…` : phase === 'paused' ? 'Paused' : phase === 'review' ? 'Review the transcript, then send' : 'Your turn';

  return (
    <View style={s.fill}>
      <SafeAreaView edges={['top']} style={s.sessionHeader}>
        <View style={s.headerRow}>
          <BackButton close onPress={() => { if (phase === 'recording' || busy.current) { setError('Stop recording or wait for the current answer before ending.'); return; } if (current.current) { pause(); setConfirmEnd(true); } else router.back(); }} />
          <View style={{ flex: 1, gap: 4 }}><Label>03 · Practise</Label><Text style={s.stage}>{response?.stage || 'Starting session'}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Session options" style={s.side} onPress={() => { pause(); setOptions(true); }} disabled={!response || phase === 'recording' || phase === 'thinking'}><Text style={s.ladderText}>More</Text></Pressable>
        </View>
        <View style={s.timerRow}><Text style={s.status}>Total {duration(times.totalMs)}</Text><Text style={s.missionText}>Active {duration(times.activeMs)}</Text><Text style={s.missionText}>{snapshot?.turns.length || 0} answers</Text></View>
      </SafeAreaView>
      <KeyboardAvoidingView style={s.sheet} behavior="padding">
        <Text style={s.missionText}>{role.mission}</Text>
        {isDemo && <Text style={s.error}>Script preview · AI feedback and goal assessment unavailable</Text>}
        <ScrollView ref={transcript} onContentSizeChange={() => transcript.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingVertical: 16 }}>
          {(snapshot?.history || []).map((line, i) => <View key={i} style={[s.msg, line.from === 'you' ? s.mine : s.theirs]}><Text style={s.msgWho}>{line.from === 'you' ? 'YOU' : partner.shortName.toUpperCase()}</Text><Text style={s.msgText}>{line.text}</Text></View>)}
          {findings.length > 0 && <View style={s.hintCard}><Text style={s.hintTitle}>Expression feedback · last accepted answer</Text>{findings.map((c, i) => <Text key={i} style={s.msgText}>{c.said} → {c.better}{'\n'}{c.explanation}</Text>)}</View>}
          {idle >= 8 && phase === 'you' && <Text style={s.missionText}>{idle >= 13 ? 'Need an idea? You can open a hint.' : 'Take your time.'}</Text>}
          {phase === 'you' && response && <View style={s.hintCard}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: hintsOpen }} onPress={() => setHintsOpen((v) => !v)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={s.hintTitle}>{hintsOpen ? 'Close hints' : 'Need a little help? Open hints'}</Text></Pressable>
            {hintsOpen && <>
            <View style={{ flexDirection: 'row', gap: 6 }}>{(['Idea', 'Starter', 'Example'] as const).map((label, i) => <Pressable key={label} style={[s.ladder, hintLevel === i + 1 && { backgroundColor: C.skyTint }]} accessibilityState={{ selected: hintLevel === i + 1 }} onPress={() => showHint((i + 1) as 1 | 2 | 3)} accessibilityRole="button"><Text style={s.ladderText}>{i + 1} · {label}</Text></Pressable>)}</View>
            {hintLevel > 0 && <Text style={s.hintText}>{hintLevel === 1 ? response.hints.idea : hintLevel === 2 ? response.hints.starter : response.hints.example}</Text>}
            </>}
          </View>}
        </ScrollView>
        {!!error && <Text style={s.error}>{error}</Text>}
        {!response && !!error && <Pressable onPress={() => void boot()}><Text style={s.status}>Retry starting</Text></Pressable>}
        {phase === 'review' && <Text style={s.missionText}>Speech-to-text can make mistakes. Edit this transcript before sending. Feedback appears after your answer is accepted.</Text>}
        <SafeAreaView edges={['bottom']} style={s.composer}>
          <Text style={s.status} accessibilityLiveRegion="polite">{status}</Text>
          {typing && ['you', 'review', 'thinking'].includes(phase) && <View style={{ gap: 10 }}>
            <TextInput style={s.input} value={draft} onChangeText={setDraft} multiline maxLength={2000} editable={phase === 'you' || phase === 'review'} placeholder="Your answer in English…" accessibilityLabel="Review or type your answer" />
            <Button label={phase === 'review' ? 'Send my answer' : 'Send answer'} loading={phase === 'thinking'} disabled={!response || !draft.trim() || !['you', 'review'].includes(phase)} onPress={() => void answer()} />
          </View>}
          {!typing && ['you', 'recording', 'partner', 'thinking'].includes(phase) && <View style={{ alignItems: 'center', paddingVertical: 8 }}><MicButton phase={phase} onPress={phase === 'recording' ? () => void stopRecording() : phase === 'you' && !!response ? () => void startRecording() : undefined} /></View>}
          {phase === 'paused' && <Button label="Resume conversation" onPress={resume} />}
          {phase === 'you' && <View style={s.headerRow}>
            <Button label={typing ? 'Use microphone' : 'Type instead'} variant="secondary" style={{ flex: 1 }} onPress={() => setTyping((v) => !v)} />
            <Button label="Replay reply" variant="secondary" style={{ flex: 1 }} disabled={!response || !snapshot?.history.some((l) => l.from === 'partner')} onPress={() => response && play({ ...response, speechParts: [{ text: lastPartner }], done: false })} />
          </View>}
          {phase === 'review' && <Button label="Record again" variant="secondary" onPress={() => { setReview(null); setDraft(''); setTyping(false); pending.current = undefined; changePhase('you'); }} />}
        </SafeAreaView>
      </KeyboardAvoidingView>
      <Sheet visible={options} onClose={() => setOptions(false)} title="Session options">
        <Text style={s.msgText}>Your conversation is paused. Accepted answers are saved.</Text>
        <Button label="Back to conversation" onPress={() => { setOptions(false); resume(); }} />
        <Button label="End session…" variant="secondary" onPress={() => { setOptions(false); setConfirmEnd(true); }} />
      </Sheet>
      <Sheet visible={confirmEnd} onClose={() => setConfirmEnd(false)} title="Finish for now?">
        <Text style={s.msgText}>Save your accepted answers and see your feedback. Any unsent answer will not be included.</Text>
        <Button label="End and view results" onPress={() => { setConfirmEnd(false); void finish(); }} />
        <Button label="Keep practising" variant="secondary" onPress={() => { setConfirmEnd(false); resume(); }} />
      </Sheet>
    </View>
  );
}

function MicButton({ phase, onPress }: { phase: Phase; onPress?: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const active = phase === 'you' || phase === 'recording';
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: phase === 'recording' ? 900 : 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [active, phase, pulse]);

  const bg = phase === 'recording' ? C.peach : active ? C.skyInk : '#AEB6D8';
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={phase === 'recording' ? 'Stop recording' : 'Start speaking'}>
      <View style={{ width: 84, height: 84 }}>
        {active && (
          <Animated.View
            style={{
              position: 'absolute', width: 84, height: 84, borderRadius: 42, backgroundColor: bg,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
            }}
          />
        )}
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          {phase === 'thinking' ? (
            <ActivityIndicator color="#fff" />
          ) : phase === 'recording' ? (
            <View style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: '#fff' }} />
          ) : (
            <Svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <Rect x={9} y={3} width={6} height={11} rx={3} />
              <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </Svg>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.cream },
  sessionHeader: { paddingHorizontal: 18, paddingBottom: 12, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stage: { fontFamily: F.display, fontSize: 19, color: C.navy },
  timerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 8 },
  composer: { gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line },
  top: { position: 'absolute', top: 0, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  progress: { flex: 1, flexDirection: 'row', gap: 4, backgroundColor: C.white, borderRadius: 999, padding: 6, marginTop: 8 },
  seg: { flex: 1, height: 8, borderRadius: 4 },
  partner: { position: 'absolute', left: 4, bottom: 6 },
  partnerBubble: {
    position: 'absolute', left: 170, right: 16, top: 112, backgroundColor: C.white, borderRadius: 20, borderBottomLeftRadius: 6, padding: 12,
    shadowColor: '#1E2440', shadowOpacity: 0.15, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  who: { fontFamily: F.heavy, fontSize: 11, marginBottom: 2 },
  bubbleText: { fontFamily: F.semi, fontSize: 15, lineHeight: 21, color: C.navy },
  sheet: { flex: 1, backgroundColor: C.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: 0, paddingHorizontal: 18, paddingTop: 16 },
  mission: { backgroundColor: C.cream, borderRadius: 14, padding: 10, borderWidth: 1.5, borderColor: C.line },
  missionText: { fontFamily: F.body, fontSize: 13, color: C.navy },
  msg: { maxWidth: '86%', borderRadius: 18, padding: 10 },
  mine: { alignSelf: 'flex-end', backgroundColor: C.skyTint, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: C.cream, borderBottomLeftRadius: 6 },
  msgWho: { fontFamily: F.heavy, fontSize: 10, color: C.skyInk, marginBottom: 2 },
  msgText: { fontFamily: F.semi, fontSize: 14, lineHeight: 20, color: C.navy },
  bridge: { alignSelf: 'flex-end', fontFamily: F.heavy, fontSize: 13, color: C.navy, backgroundColor: C.sunTint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, overflow: 'hidden' },
  hintCard: { backgroundColor: '#FFF6F2', borderRadius: 20, padding: 12, gap: 8, marginBottom: 6 },
  hintTitle: { fontFamily: F.heavy, fontSize: 14, color: C.navy },
  ladder: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  ladderText: { fontFamily: F.heavy, fontSize: 12, color: C.navy },
  hintText: { fontFamily: F.semi, fontSize: 14, lineHeight: 20, color: C.navy },
  error: { fontFamily: F.bold, fontSize: 13, color: '#B4372A', marginBottom: 6 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  input: { minHeight: 80, maxHeight: 140, textAlignVertical: 'top', paddingVertical: 12, borderRadius: 14, borderWidth: 2, borderColor: C.skyTint, paddingHorizontal: 14, fontFamily: F.semi, fontSize: 15, color: C.navy, backgroundColor: C.white },
  send: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.skyInk, alignItems: 'center', justifyContent: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingBottom: 8, paddingTop: 4 },
  side: { width: 56, height: 56, borderRadius: 18, borderWidth: 2, borderColor: C.skyTint, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  status: { fontFamily: F.heavy, fontSize: 13, color: C.navy },
});
