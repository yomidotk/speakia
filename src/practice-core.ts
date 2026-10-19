/** Shared, provider-free practice rules used by the Worker and Expo client. */
export type Correction = { said: string; better: string; category: 'grammar' | 'vocabulary'; explanation: string; turnId: string; start: number; end: number };
export type PracticeTurn = { id: string; text: string; source: 'typed' | 'speech'; recordingMs: number; edited: boolean; corrections: Correction[]; assessed: boolean; objectiveId?: string };
export type PracticeLine = { from: 'you' | 'partner'; text: string; turnId?: string };
export type HintReveal = { turnIndex: number; tier: 1 | 2 | 3 };
export type PracticeSnapshot = {
  id: string; episodeId: string; roleIndex: number; startedAt: number; endedAt?: number;
  step: number; goodbyeCount: number; completed: boolean; endReason?: string;
  turns: PracticeTurn[]; history: PracticeLine[]; objectives: { id: string; turnId: string; quote: string }[];
};
export type Measurements = { totalMs: number; pausedMs: number; hintReveals: HintReveal[] };
export type PracticeReport = {
  sessionId: string; episodeId: string; status: 'completed' | 'ended_early'; endReason: string;
  totalMs: number; activeMs: number; recordingMs: number; learnerSpeakingMs: null; timingSource: 'client_events';
  turns: number; spokenTurns: number; typedTurns: number; words: number; listeningMs: null;
  hintReveals: number; highestHintTier: number; turnsWithHints: number; hintEvents: HintReveal[];
  errorCount: number; errorsByCategory: Record<string, number>; recurringPatterns: { said: string; better: string; occurrences: number }[];
  corrections: Correction[]; objectives: PracticeSnapshot['objectives']; unassessedTurns: string[];
  pronunciation: { status: 'unavailable'; explanation: string }; strengths: string[]; priorities: string[];
  recommendation: string; analysisStatus: 'pending' | 'done' | 'failed' | 'unavailable';
};

export const spokenForm = (text: string) => text.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]/gu, '');

/** Evidence is grounded to the accepted turn. Cosmetic ASR writing changes never count. */
export function confirmedCorrections(raw: unknown, text: string, turnId: string): Correction[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const found: Correction[] = [];
  for (const value of raw.slice(0, 12)) {
    if (!value || typeof value !== 'object') continue;
    const c = value as Record<string, unknown>;
    if (typeof c.said !== 'string' || typeof c.better !== 'string' || !c.said || !c.better || c.said.length > 500 || c.better.length > 500) continue;
    let start = text.indexOf(c.said);
    while (start >= 0 && ((/^[\p{L}\p{N}]/u.test(c.said) && /[\p{L}\p{N}]/u.test(text[start - 1] || '')) || (/[\p{L}\p{N}]$/u.test(c.said) && /[\p{L}\p{N}]/u.test(text[start + c.said.length] || '')))) start = text.indexOf(c.said, start + 1);
    if (start < 0 || spokenForm(c.said) === spokenForm(c.better)) continue;
    if (c.category !== 'grammar' && c.category !== 'vocabulary') continue;
    const category = c.category;
    const key = `${start}|${c.better}|${category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ said: c.said, better: c.better, category, explanation: typeof c.explanation === 'string' ? c.explanation.slice(0, 240) : 'A suggested expression correction.', turnId, start, end: start + c.said.length });
  }
  return found.slice(0, 4);
}

/** Whole-message exit intent: "what does goodbye mean?" is not an exit. */
export function goodbyeSignal(text: string): 0 | 1 | 2 {
  const value = text.toLowerCase().replace(/’/g, "'").replace(/\bi'm\b/g, 'i am').replace(/\blet's\b/g, 'let us').replace(/[^a-z\s]/g, ' ').trim().replace(/\s+/g, ' ').replace(/good bye/g, 'goodbye');
  if (['stop', 'please stop', 'stop now', 'please end the conversation', 'end this conversation', 'end the session', 'i want to stop', 'i want to stop now', 'i want to end the conversation', 'i have to go', 'i need to go', 'i am done', 'let us stop'].includes(value)) return 2;
  if (text.includes('?')) return 0;
  const tokens = value.split(' ');
  const allowed = new Set(['bye', 'goodbye', 'thanks', 'thank', 'you', 'okay', 'ok', 'for', 'your', 'help', 'now', 'see', 'later', 'take', 'care']);
  if (tokens.some((t) => !allowed.has(t))) return 0;
  const count = tokens.filter((t) => t === 'bye' || t === 'goodbye').length;
  return count > 1 ? 2 : count === 1 || ['see you', 'see you later', 'take care'].includes(value) ? 1 : 0;
}

export function removeQuestions(text: string) {
  return text.split(/(?<=[.!?])\s+/).filter((part) => !part.includes('?')).join(' ').trim();
}

export function revealHint(events: HintReveal[], turnIndex: number, tier: 1 | 2 | 3): HintReveal[] {
  return events.some((e) => e.turnIndex === turnIndex && e.tier === tier) ? events : [...events, { turnIndex, tier }];
}

export function elapsed(startedAt: number, now: number, pausedMs: number, pauseStarted?: number | null) {
  const totalMs = Math.max(0, now - startedAt);
  const paused = pausedMs + (pauseStarted == null ? 0 : Math.max(0, now - pauseStarted));
  return { totalMs, activeMs: Math.max(0, totalMs - paused) };
}
export function duration(ms: number) {
  const n = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(n / 60).toString().padStart(2, '0')}:${(n % 60).toString().padStart(2, '0')}`;
}

export function measuredReport(s: PracticeSnapshot, measurements: Measurements): PracticeReport {
  const totalMs = Math.min(86_400_000, Math.max(0, Number.isFinite(measurements.totalMs) ? measurements.totalMs : 0));
  const pausedMs = Math.min(totalMs, Math.max(0, Number.isFinite(measurements.pausedMs) ? measurements.pausedMs : 0));
  const events: HintReveal[] = [];
  for (const h of (measurements.hintReveals || []).slice(0, 300)) {
    if (h && typeof h === 'object' && Number.isInteger(h.turnIndex) && h.turnIndex >= 0 && h.turnIndex <= s.turns.length && [1, 2, 3].includes(h.tier) && !events.some((e) => e.turnIndex === h.turnIndex && e.tier === h.tier)) events.push({ turnIndex: h.turnIndex, tier: h.tier });
  }
  const corrections = s.turns.flatMap((t) => confirmedCorrections(t.corrections, t.text, t.id));
  const errorsByCategory: Record<string, number> = {};
  const patterns = new Map<string, { said: string; better: string; occurrences: number }>();
  for (const c of corrections) {
    errorsByCategory[c.category] = (errorsByCategory[c.category] || 0) + 1;
    const key = `${spokenForm(c.said)}|${spokenForm(c.better)}`;
    const entry = patterns.get(key) || { said: c.said, better: c.better, occurrences: 0 };
    entry.occurrences++; patterns.set(key, entry);
  }
  const spokenTurns = s.turns.filter((t) => t.source === 'speech');
  return {
    sessionId: s.id, episodeId: s.episodeId, status: s.completed ? 'completed' : 'ended_early', endReason: s.endReason || 'manual_end',
    totalMs, activeMs: totalMs - pausedMs, recordingMs: spokenTurns.reduce((sum, t) => sum + t.recordingMs, 0), learnerSpeakingMs: null, timingSource: 'client_events',
    turns: s.turns.length, spokenTurns: spokenTurns.length, typedTurns: s.turns.length - spokenTurns.length,
    words: s.turns.reduce((sum, t) => sum + t.text.trim().split(/\s+/).filter(Boolean).length, 0), listeningMs: null,
    hintReveals: events.length, highestHintTier: Math.max(0, ...events.map((e) => e.tier)), turnsWithHints: new Set(events.map((e) => e.turnIndex)).size, hintEvents: events,
    errorCount: corrections.length, errorsByCategory, recurringPatterns: [...patterns.values()], corrections, objectives: s.objectives,
    unassessedTurns: s.turns.filter((t) => !t.assessed).map((t) => t.id),
    pronunciation: { status: 'unavailable', explanation: 'No audio pronunciation assessment ran. Recording time includes silence and is not speaking-only time.' },
    strengths: [], priorities: [], recommendation: s.turns.length ? 'Review your accepted answers and practise one useful expression again.' : 'Start a short scene and try one answer.',
    analysisStatus: 'pending',
  };
}
