import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Label, Title } from '../../../src/components/ui';
import { getEpisode } from '../../../src/content/episodes';
import { duration } from '../../../src/practice-core';
import { reportPractice, requestId, type ReportRequest } from '../../../src/practice-api';
import { addAttempt, getAttempts, practiceLocal, savePracticeLocal, type Attempt } from '../../../src/storage';
import { C, F } from '../../../src/theme';

export default function Result() {
  const { id, session } = useLocalSearchParams<{ id: string; session?: string }>();
  const ep = getEpisode(id)!;
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const locked = useRef(false);
  const alive = useRef(true);
  const analyse = async (a: Attempt, retry = false) => {
    if (!session || locked.current) return;
    locked.current = true; setAnalysing(true); setError('');
    try {
      const saved = await practiceLocal<{ request: ReportRequest }>(`report-${session}`);
      if (!saved) throw new Error('Detailed analysis cannot be retried on this device. Your measured results remain saved.');
      const request = retry ? { ...saved.request, requestId: requestId() } : saved.request;
      await savePracticeLocal(`report-${session}`, { ...saved, request });
      const result = await reportPractice(request);
      const updated = { ...a, report: result.report };
      await addAttempt(updated);
      if (alive.current) setAttempt(updated);
    } catch (e) {
      const updated = a.report ? { ...a, report: { ...a.report, analysisStatus: 'failed' as const } } : a;
      await addAttempt(updated);
      if (alive.current) { setAttempt(updated); setError(e instanceof Error ? e.message : 'Analysis unavailable. Your measured results are saved.'); }
    } finally { locked.current = false; if (alive.current) setAnalysing(false); }
  };
  useEffect(() => {
    alive.current = true;
    void getAttempts().then((all) => {
      if (!alive.current) return;
      const a = all.find((item) => item.sessionId === session) || null;
      setAttempt(a); setLoading(false);
      if (a?.report?.analysisStatus === 'pending') void analyse(a);
    });
    return () => { alive.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
  const r = attempt?.report;
  if (loading) return <SafeAreaView style={s.fill}><ActivityIndicator accessibilityLabel="Loading results" /></SafeAreaView>;
  if (!r) return <SafeAreaView style={[s.fill, s.content]}><Title>Results unavailable</Title><Text style={s.tip}>Open the episode again to create a measured practice session.</Text><Button label="Back to the story" onPress={() => router.replace('/map')} /></SafeAreaView>;
  const complete = r.status === 'completed';
  const corrections = showAll ? r.corrections : r.corrections.slice(0, 2);
  return (
    <SafeAreaView style={s.fill}>
      <ScrollView contentContainerStyle={s.content}>
        <Label>04 · Your results</Label>
        <Label>{complete ? 'Episode complete' : 'Session ended early · progress saved'}</Label>
        <Title>{ep.title}</Title>
        {complete && <Text style={s.tip}>{'★'.repeat(attempt?.stars || 0)} · Independence stars reflect hint use, not an English proficiency score.</Text>}
        <View style={s.row}><Stat label="Total session" value={duration(r.totalMs)} /><Stat label="Active time" value={duration(r.activeMs)} /><Stat label="Recording time" value={duration(r.recordingMs)} /></View>
        <Text style={s.small}>Active time excludes explicit pauses. Recording time is accepted audio duration, including silence. Speaking-only time is unavailable.</Text>
        <View style={s.row}><Stat label="Accepted turns" value={String(r.turns)} /><Stat label="Spoken / typed" value={`${r.spokenTurns} / ${r.typedTurns}`} /><Stat label="Words" value={String(r.words)} /></View>
        <Card style={s.card}>
          <Text style={s.heading}>Your practice</Text>
          <Text style={s.tip}>Role: {attempt?.role}. Objectives covered: {r.objectives.length}.</Text>
          <Text style={s.tip}>Hints revealed: {r.hintReveals} · Highest tier: {r.highestHintTier} · Turns with hints: {r.turnsWithHints}</Text>
          <Text style={s.small}>Opening the same hint again does not count twice.</Text>
        </Card>
        <Card style={s.card}>
          <Text style={s.heading}>Expression corrections · {r.errorCount}</Text>
          <Text style={s.small}>Grammar: {r.errorsByCategory.grammar || 0} · Vocabulary: {r.errorsByCategory.vocabulary || 0}. Punctuation and capital letters are excluded.</Text>
          {!r.corrections.length && <Text style={s.tip}>{r.unassessedTurns.length ? 'Some answers were not assessed; no confirmed correction is available.' : 'No expression corrections were recorded. This is not a pronunciation assessment.'}</Text>}
          {corrections.map((c, i) => <View key={`${c.turnId}-${i}`} style={{ gap: 3 }}><Text style={s.said}>{c.said}</Text><Text style={s.tip}>→ {c.better}</Text><Text style={s.small}>{c.explanation} · Answer {r.objectives.find((o) => o.turnId === c.turnId)?.id || c.turnId.slice(-6)}</Text></View>)}
          {r.corrections.length > 2 && <Pressable onPress={() => setShowAll((v) => !v)}><Text style={s.link}>{showAll ? 'Show fewer corrections' : `Show all ${r.corrections.length} corrections`}</Text></Pressable>}
          {r.recurringPatterns.filter((p) => p.occurrences > 1).map((p, i) => <Text key={i} style={s.tip}>Repeated {p.occurrences} times: {p.said} → {p.better}</Text>)}
        </Card>
        <Card style={s.card}>
          <Text style={s.heading}>Recommendations</Text>
          {analysing && <Text style={s.tip}>Generating notes from your accepted answers…</Text>}
          {r.strengths.map((text, i) => <Text key={`s-${i}`} style={s.tip}>Strength: {text}</Text>)}
          {r.priorities.map((text, i) => <Text key={`p-${i}`} style={s.tip}>Practise: {text}</Text>)}
          <Text style={s.tip}>{r.recommendation}</Text>
          {r.analysisStatus === 'failed' && <Text style={s.small}>AI notes are unavailable. Your measured results and confirmed corrections are saved.</Text>}
          {r.analysisStatus === 'unavailable' && <Text style={s.small}>No AI summary was generated for this session.</Text>}
          {!!error && <Text style={s.small}>{error}</Text>}
          {r.analysisStatus === 'failed' && !analysing && <Pressable onPress={() => attempt && void analyse(attempt, true)}><Text style={s.link}>Retry AI notes</Text></Pressable>}
        </Card>
        <Text style={s.small}>Pronunciation assessment: unavailable. Transcript corrections do not measure pronunciation.</Text>
        <Button label="Practise again" onPress={() => router.replace({ pathname: '/episode/[id]/intro', params: { id: ep.id } })} />
        <Button label="Back to the story" variant="secondary" onPress={() => router.replace('/map')} />
      </ScrollView>
    </SafeAreaView>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return <View style={s.stat}><Text style={s.small}>{label}</Text><Text style={s.value}>{value}</Text></View>;
}
const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.cream }, content: { padding: 24, gap: 16 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '44%', padding: 16, borderRadius: 16, backgroundColor: C.skyTint }, value: { fontFamily: F.display, fontSize: 23, color: C.navy },
  card: { gap: 10 }, heading: { fontFamily: F.display, fontSize: 18, color: C.navy }, tip: { fontFamily: F.semi, fontSize: 14, color: C.navy, lineHeight: 21 },
  small: { fontFamily: F.body, fontSize: 12, color: C.muted, lineHeight: 18 }, said: { fontFamily: F.semi, fontSize: 14, color: C.muted, textDecorationLine: 'line-through' },
  link: { fontFamily: F.bold, fontSize: 14, color: C.skyInk, paddingVertical: 8 },
});
