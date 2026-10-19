import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Character from '../../../src/components/Character';
import { BackButton } from '../../../src/components/BackButton';
import { Body, Button, Label, Title } from '../../../src/components/ui';
import { CAST } from '../../../src/content/cast';
import { getEpisode } from '../../../src/content/episodes';
import { C, F, shadow } from '../../../src/theme';

/** Screen 13 · Choose a side. The learner joins one character; the AI plays the other and has to be convinced. */
export default function Role() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ep = getEpisode(id)!;
  const [pick, setPick] = useState<number | null>(null);

  return (
    <SafeAreaView style={s.fill}>
      <ScrollView contentContainerStyle={s.content}>
        <BackButton />
        <View style={{ gap: 6 }}>
          <Label>02 · Choose a role</Label><Title>Who will you be?</Title>
          <Body>Choose who you want to play. The AI plays the other character.</Body>
        </View>
        {ep.roles.map((r, i) => {
          if (!r.player) return null; // guided episodes have no sides
          const c = CAST[r.player];
          const selected = pick === i;
          return (
            <Pressable
              key={r.player}
              onPress={() => setPick(i)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[s.card, selected && { borderColor: C.skyInk }]}
            >
              <View style={[s.portrait, { backgroundColor: c.tint }]}>
                <Character who={r.player} size={90} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.name}>{c.shortName}</Text>
                <Text style={s.trait}>{c.personality}</Text>
                <Text style={s.mission}>{r.mission}</Text>
                {selected && <Text style={s.you}>YOUR ROLE</Text>}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
        <Button
          label={pick === null ? 'Choose a role above' : `Practise as ${CAST[ep.roles[pick].player!].shortName}`}
          disabled={pick === null}
          onPress={() => router.replace({ pathname: '/episode/[id]/speak', params: { id: ep.id, role: String(pick) } })}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.cream },
  content: { padding: 24, gap: 16 },
  card: { flexDirection: 'row', gap: 14, backgroundColor: C.white, borderRadius: 24, padding: 12, borderWidth: 3, borderColor: C.line, alignItems: 'center' },
  portrait: { width: 84, height: 110, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  name: { fontFamily: F.display, fontSize: 22, color: C.navy },
  trait: { fontFamily: F.semi, fontSize: 13, color: C.muted },
  mission: { fontFamily: F.heavy, fontSize: 14, color: C.navy, marginTop: 4 },
  you: { fontFamily: F.heavy, fontSize: 11, color: C.skyInk, marginTop: 4, letterSpacing: 1 },
});
