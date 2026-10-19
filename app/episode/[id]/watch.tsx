import { useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Character from '../../../src/components/Character';
import Place from '../../../src/components/Place';
import { BackButton } from '../../../src/components/BackButton';
import { Body, Button, Label } from '../../../src/components/ui';
import { Sheet, StepBar } from '../../../src/components/kit';
import { CAST } from '../../../src/content/cast';
import { getEpisode, personalise } from '../../../src/content/episodes';
import { useLearnerName } from '../../../src/useLearnerName';
import { prepareLines, say, stopSpeaking } from '../../../src/voice';
import { C, F } from '../../../src/theme';

export default function Watch() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ep = getEpisode(id)!;
  const { width, height } = useWindowDimensions();
  const name = useLearnerName();
  const scene = ep.scene.map((l) => ({ ...l, text: personalise(l.text, name ?? '') }));
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [talking, setTalking] = useState(false);
  const [ended, setEnded] = useState(false);
  const [subs, setSubs] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const resumeAfterSettings = useRef(false);
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState('');
  const [run, setRun] = useState(0);
  const alive = useRef(true);
  const token = useRef(0);
  const people = Array.from(new Set(ep.scene.map((l) => l.who)));
  const line = scene[Math.min(index, scene.length - 1)];
  const sceneHeight = Math.max(150, Math.min(240, height * 0.28));
  const pause = () => { token.current++; stopSpeaking(); setPlaying(false); setTalking(false); };

  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') pause(); });
    return () => { alive.current = false; token.current++; stopSpeaking(); subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!playing || ended || name === null) return;
    const mine = ++token.current;
    const current = () => alive.current && mine === token.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let completed = false;
    void say(line.who, line.text, {
      onStart: () => { if (current()) setTalking(true); },
      onDone: () => {
        if (!current() || completed) return;
        completed = true; setTalking(false);
        timer = setTimeout(() => {
          if (!current()) return;
          if (index + 1 >= scene.length) { setEnded(true); setPlaying(false); }
          else setIndex((i) => i + 1);
        }, 350);
      },
    }, false, false, speed).catch(() => { if (current()) { setError('Audio could not play. Try again.'); pause(); } });
    return () => { token.current++; if (timer) clearTimeout(timer); stopSpeaking(); };
  }, [index, playing, run, name, speed]);
  useEffect(() => {
    if (playing && name !== null) void prepareLines(scene.slice(index + 1, index + 2));
  }, [playing, index, name]);
  const replay = () => { pause(); setIndex(0); setEnded(false); setError(''); setRun((r) => r + 1); setPlaying(true); };

  const openSpeed = () => { resumeAfterSettings.current = playing; pause(); setSettings(true); };
  const closeSpeed = () => { setSettings(false); if (resumeAfterSettings.current && !ended) setPlaying(true); resumeAfterSettings.current = false; };
  return (
    <SafeAreaView style={s.fill}>
      <View style={s.header}><BackButton /><View style={{ flex: 1, gap: 3 }}><Label>01 · Listen</Label><Text style={s.title}>{ep.title}</Text></View></View>
      <ScrollView contentContainerStyle={s.body}>
        <View style={[s.scene, { height: sceneHeight }]}>
          <Place place={ep.place} width={Math.max(1, width - 40)} height={sceneHeight} />
          <View style={s.cast}>{people.map((p) => <View key={p} style={{ opacity: line.who === p ? 1 : 0.7 }}><Character who={p} size={Math.min(126, width * 0.32)} talking={line.who === p && talking} /></View>)}</View>
        </View>
        <View style={s.progress}><Text style={s.caption}>{ended ? 'Listening complete' : `Line ${index + 1} of ${scene.length}`}</Text><Text style={s.caption}>{ended ? 'Ready to choose a role' : playing ? talking ? 'Playing' : 'Preparing audio…' : 'Ready when you are'}</Text></View>
        <StepBar value={ended ? 1 : index / scene.length} />
        {subs && <View style={s.dialogue} accessibilityLiveRegion="polite">
          <Label>{CAST[line.who].shortName}</Label>
          <Text style={s.line}>{line.text}</Text>
        </View>}
        {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
        <Body>Listen to both characters. Then choose a role and answer in your own words.</Body>
      </ScrollView>
      <View style={s.footer}>
        <View style={s.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={subs ? 'Turn subtitles off' : 'Turn subtitles on'} accessibilityState={{ selected: subs }} style={[s.tool, subs && s.toolOn]} onPress={() => setSubs((v) => !v)}><Text style={s.toolTitle}>CC</Text><Text style={s.caption}>{subs ? 'On' : 'Off'}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Playback speed ${speed} times`} style={s.tool} onPress={openSpeed}><Text style={s.toolTitle}>{speed}×</Text><Text style={s.caption}>Speed</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Open full transcript" style={[s.tool, transcriptOpen && s.toolOn]} onPress={() => setTranscriptOpen(true)}><Text style={s.toolTitle}>Transcript</Text><Text style={s.caption}>All lines</Text></Pressable>
        </View>
        <Button label={ended ? 'Choose my role' : playing ? 'Pause scene' : index === 0 ? 'Play scene' : 'Continue listening'} onPress={ended ? () => router.push({ pathname: '/episode/[id]/role', params: { id: ep.id } }) : () => { setError(''); if (playing) pause(); else setPlaying(true); }} />
      </View>
      <Sheet visible={settings} onClose={closeSpeed} title="Playback speed">
        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => <Pressable key={rate} accessibilityRole="radio" accessibilityState={{ selected: speed === rate }} accessibilityLabel={`${rate} times speed`} style={[s.setting, speed === rate && s.toolOn]} onPress={() => { setSpeed(rate); closeSpeed(); }}><Text style={s.settingText}>{rate === 1 ? 'Normal · 1×' : `${rate}×`}</Text>{speed === rate && <Text style={s.toolTitle}>✓</Text>}</Pressable>)}
        <Body>When playing, changing speed restarts the current line at your chosen speed.</Body>
      </Sheet>
      <Sheet visible={transcriptOpen} onClose={() => setTranscriptOpen(false)} title="Scene transcript">
        <Body>Read the full scene. The current line is highlighted; playback continues while this panel is open.</Body>
        {scene.map((entry, i) => <View key={i} style={[s.transcriptLine, i === index && s.toolOn]}><Label>{`${i + 1} · ${CAST[entry.who].shortName}${i === index ? ' · Current' : ''}`}</Label><Text style={s.transcriptText}>{entry.text}</Text></View>)}
        <Button label="Restart scene" variant="secondary" onPress={() => { setTranscriptOpen(false); replay(); }} />
        <Button label="Close transcript" onPress={() => setTranscriptOpen(false)} />
      </Sheet>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontFamily: F.display, color: C.navy, fontSize: 21 },
  body: { padding: 20, paddingTop: 4, gap: 14 },
  scene: { borderRadius: 24, overflow: 'hidden', backgroundColor: C.skyTint },
  cast: { position: 'absolute', bottom: -12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-around' },
  progress: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 },
  caption: { fontFamily: F.bold, fontSize: 12, color: C.muted },
  dialogue: { backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 20, gap: 10, minHeight: 130 },
  line: { fontFamily: F.semi, color: C.navy, fontSize: 18, lineHeight: 28 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 10, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.line },
  actions: { flexDirection: 'row', gap: 10 },
  tool: { flex: 1, minHeight: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: C.cream },
  toolOn: { backgroundColor: C.skyTint },
  toolTitle: { fontFamily: F.bold, fontSize: 14, color: C.skyInk },
  transcriptLine: { padding: 14, borderRadius: 14, gap: 8 },
  transcriptText: { fontFamily: F.body, color: C.navy, fontSize: 15, lineHeight: 23 },
  setting: { paddingHorizontal: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, gap: 12 },
  settingText: { fontFamily: F.bold, color: C.navy, fontSize: 16, flex: 1 },
  error: { fontFamily: F.semi, color: '#B4372A', fontSize: 14 },
});
