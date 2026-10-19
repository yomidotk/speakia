/**
 * Speakia API: a free Cloudflare Worker that keeps the AI keys off the phone.
 *
 *   POST /transcribe   multipart "file" (audio)  -> { text }
 *   POST /turn         JSON (see TurnRequest)    -> TurnResult
 *   GET  /speak?who=sara&text=...&slow=1          -> audio/mpeg (Fish Audio voice for that character)
 *   POST /assess       JSON (see AssessRequest)  -> CEFR speaking evaluation of the placement answers
 *
 * Every request must carry a Firebase ID token (Authorization: Bearer <token>) from a signed-in
 * learner (email account or anonymous guest). The token is checked against Google's public keys,
 * so nothing secret lives in the app.
 *
 * Secrets (set with `npx wrangler secret put NAME`):
 *   GROQ_API_KEY   from console.groq.com (free plan)
 *   FISH_API_KEY   from fish.audio > API keys
 * Vars in wrangler.toml: FIREBASE_PROJECT_ID, CHAT_MODEL, STT_MODEL, FISH_MODEL, FISH_VOICE_<CHARACTER>.
 * Optional KV binding AUDIO stores voiced lines (the Cache API does nothing on *.workers.dev).
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { confirmedCorrections } from '../../src/practice-core';
import { PracticeError, startPractice, practiceTurn, practiceReport } from './practice';

export interface Env {
  GROQ_API_KEY: string;
  PRACTICE_SIGNING_KEY?: string;
  FISH_API_KEY?: string;
  FIREBASE_PROJECT_ID: string;
  CHAT_MODEL?: string;
  STT_MODEL?: string;
  FISH_MODEL?: string;
  FISH_VOICE_SARA?: string;
  FISH_VOICE_YACINE?: string;
  FISH_VOICE_BENALI?: string;
  FISH_VOICE_HADDAD?: string;
  AUDIO?: KVNamespace; // optional: stores generated lines so each is made only once
}

// Google's public keys for Firebase ID tokens (cached by jose between requests).
const FIREBASE_KEYS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

/** The learner's Firebase uid if the request carries a valid ID token for our project, else null. */
async function verifiedUser(req: Request, env: Env): Promise<string | null> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !env.FIREBASE_PROJECT_ID) return null;
  try {
    const { payload } = await jwtVerify(token, FIREBASE_KEYS, {
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      audience: env.FIREBASE_PROJECT_ID,
      algorithms: ['RS256'],
    });
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

type ChatLine = { from: 'you' | 'partner'; text: string };

type TurnRequest = {
  setting: string;
  partner: { name: string; personality: string };
  player?: { name: string };
  learnerName?: string;
  /** Guided episodes: the partner's next scripted line and the facts it may use to answer questions. */
  guided?: { next: string; facts: string[] };
  goal: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  major: string;
  turn: number;
  maxTurns: number;
  history: ChatLine[];
};

const GROQ = 'https://api.groq.com/openai/v1';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-expose-headers': 'x-speakia-voice',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...CORS } });

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'speakia-api' });
    const route = `${req.method} ${url.pathname}`;
    if (!['POST /transcribe', 'POST /turn', 'GET /speak', 'POST /assess', 'POST /practice/start', 'POST /practice/turn', 'POST /practice/report'].includes(route)) return json({ error: 'Not found' }, 404);
    const uid = await verifiedUser(req, env);
    if (!uid) return json({ error: 'Sign in to use voice and AI' }, 401);

    try {
      if (route.startsWith('POST /practice/')) {
        if (Number(req.headers.get('content-length') || 0) > 1_000_000) return json({ error: 'Request too large' }, 413);
        const raw = await req.text();
        if (raw.length > 1_000_000) return json({ error: 'Request too large' }, 413);
        let body: Record<string, unknown>;
        try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON' }, 400); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request' }, 400);
        const handler = route.endsWith('/start') ? startPractice : route.endsWith('/turn') ? practiceTurn : practiceReport;
        return json(await handler(body, uid, env));
      }
      if (route === 'POST /transcribe') return await transcribe(req, env);
      if (route === 'POST /turn') return await turn(req, env);
      if (route === 'POST /assess') return await assess(req, env);
      return await speak(url, env, ctx);
    } catch (e) {
      return json({ error: e instanceof PracticeError ? e.message : 'The service could not finish this request. Please retry.' }, e instanceof PracticeError ? e.status : 500);
    }
  },
};

async function transcribe(req: Request, env: Env) {
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ error: 'Missing audio file' }, 400);

  // keep the uploaded name: its extension (.m4a on phones, .webm on the web) tells Whisper the format
  const name = (file as File).name && /\.[a-z0-9]{2,5}$/i.test((file as File).name) ? (file as File).name : 'speech.m4a';
  const out = new FormData();
  out.append('file', file, name);
  out.append('model', env.STT_MODEL || 'whisper-large-v3-turbo');
  out.append('response_format', 'json');
  // A short prompt helps Whisper keep English and not "translate" French words students mix in.
  out.append('prompt', 'A university student speaking English, sometimes using a French or Arabic word.');

  const res = await fetch(`${GROQ}/audio/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: out,
  });
  if (!res.ok) {
    const detail = await res.text();
    console.log(`whisper failed ${res.status}: ${detail.slice(0, 300)} (file ${(file as File).type || '?'}, ${(file as File).size ?? '?'} bytes)`);
    return json({ error: `Transcription failed: ${detail}` }, 502);
  }
  const data = (await res.json()) as { text?: string };
  return json({ text: (data.text ?? '').trim() });
}

function systemPrompt(raw: TurnRequest) {
  // the name is typed by the learner: keep it to a plain first name before it goes in the prompt
  const learnerName = (raw.learnerName ?? '').replace(/[^\p{L}\p{M} '-]/gu, '').trim().slice(0, 40);
  const r = { ...raw, learnerName };
  const style =
    r.level === 'Beginner'
      ? 'Use very simple words and short sentences (A2 level). Speak slowly and clearly.'
      : r.level === 'Advanced'
        ? 'Speak naturally like a fluent student, with some idioms.'
        : 'Use clear, everyday spoken English (B1-B2 level).';

  return `You are ${r.partner.name}, a university student in Algeria (${r.partner.personality}).
You are in a spoken English roleplay with a learner${r.learnerName ? ` called ${r.learnerName}` : ''}, a fellow student who is on ${r.player?.name ?? 'the other'}'s side.
Setting: ${r.setting}
The learner's goal: ${r.goal}. The learner studies ${r.major}.

Rules for "reply":
- Stay in character. 1 or 2 short spoken sentences, max 30 words. ${style}${r.learnerName ? `
- You know the learner. Call them ${r.learnerName} now and then, like a friend would (not in every reply).` : ''}
- Disagree politely at first and ask ONE natural follow-up question that pushes the learner to give a reason.
- Never correct grammar inside the reply.
- If the learner used a French or Arabic word, understand it and continue naturally.
- When the learner has given at least two clear reasons, or this is turn ${r.maxTurns} or later, agree warmly and set "done": true.
Current learner turn: ${r.turn} of ${r.maxTurns}.

Return ONLY a JSON object with exactly these keys:
{
 "reply": string,
 "done": boolean,
 "goalProgress": number between 0 and 1,
 "bridgeWords": [{"from": "<French/Arabic word the learner used>", "to": "<English word>"}],
 "hints": {"idea": "<what the learner could say next, no full sentence>", "starter": "<first 3-6 words of an answer>", "example": "<one full example answer, max 25 words>"},
 "corrections": [{"said": "<exact short phrase from the learner's LAST message>", "better": "<corrected phrase>"}]
}
Never correct punctuation, capitalization, spacing or ASR spelling. Focus on spoken grammar and vocabulary only. "corrections": at most 2, only real mistakes, empty array if none. "bridgeWords": empty array if none.
The hints are for the learner's NEXT answer to your reply.`;
}

/**
 * Guided episodes: the partner follows the teacher's script. The AI only writes a short reaction to
 * what the learner just said (answering their question from the facts); the app then plays the
 * next scripted line, so the reaction must not ask a question or repeat that line.
 */
function guidedPrompt(r: TurnRequest, learnerName: string) {
  const g = r.guided!;
  const facts = g.facts.slice(0, 20).map((f) => `- ${String(f).slice(0, 300)}`).join('\n');
  return `You are ${r.partner.name} (${r.partner.personality}) in a spoken English roleplay with a learner${learnerName ? ` called ${learnerName}` : ''}.
Setting: ${r.setting}

Your NEXT line is fixed and will be said right after your reaction:
"${String(g.next).slice(0, 600)}"

Write ONLY a short spoken reaction to the learner's LAST message, as a friendly student would:
- 1 short sentence, max 15 words. Natural and warm. Never correct grammar inside it.
- If the learner asked a question, answer it briefly using ONLY these facts:
${facts}
- If the facts don't cover their question, say you're not sure and suggest asking at Student Services. Never invent details.
- Do NOT ask a question and do NOT repeat or announce your next line.
- If the learner used a French or Arabic word, understand it and react naturally.

Return ONLY a JSON object:
{"reply": "<your reaction>", "bridgeWords": [{"from": "<French/Arabic word used>", "to": "<English word>"}], "corrections": [{"said": "<exact short phrase from the learner's LAST message>", "better": "<corrected phrase>"}]}
Never correct punctuation, capitalization, spacing or ASR spelling. Focus on spoken grammar and vocabulary only. "corrections": at most 2 real mistakes, empty array if none. "bridgeWords": empty array if none.`;
}

async function turn(req: Request, env: Env) {
  const r = (await req.json()) as TurnRequest;
  if (!r?.history?.length) return json({ error: 'Missing history' }, 400);
  if (r.guided && (typeof r.guided.next !== 'string' || !Array.isArray(r.guided.facts))) return json({ error: 'Bad guided turn' }, 400);

  const learner = (r.learnerName ?? '').replace(/[^\p{L}\p{M} '-]/gu, '').trim().slice(0, 40);
  const messages = [
    { role: 'system', content: r.guided ? guidedPrompt(r, learner) : systemPrompt(r) },
    ...r.history.slice(-12).map((l) => ({
      role: l.from === 'partner' ? 'assistant' : 'user',
      content: l.from === 'partner' ? JSON.stringify({ reply: l.text }) : l.text,
    })),
  ];

  const res = await fetch(`${GROQ}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.GROQ_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env.CHAT_MODEL || 'openai/gpt-oss-120b',
      messages,
      temperature: 0.7,
      // gpt-oss is a reasoning model: keep the thinking short (speed) and out of the reply
      reasoning_effort: 'low',
      include_reasoning: false,
      max_completion_tokens: 1024,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.log(`groq turn failed ${res.status}: ${detail.slice(0, 300)}`);
    return json({ error: `AI failed: ${detail}` }, 502);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  let out: Record<string, unknown> = {};
  try {
    out = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
  } catch {
    out = {};
  }

  // Defensive defaults so the app never breaks on a sloppy AI answer.
  const hints = (out.hints ?? {}) as Record<string, string>;
  return json({
    reply: typeof out.reply === 'string' && out.reply ? out.reply : r.guided ? '' : 'Sorry, can you say that again?',
    done: r.guided ? false : Boolean(out.done) || r.turn >= r.maxTurns + 1,
    goalProgress: typeof out.goalProgress === 'number' ? out.goalProgress : Math.min(1, r.turn / r.maxTurns),
    bridgeWords: Array.isArray(out.bridgeWords) ? out.bridgeWords.slice(0, 3) : [],
    hints: {
      idea: hints.idea || 'Answer the question, then add one more reason.',
      starter: hints.starter || 'That’s true, but…',
      example: hints.example || 'That’s true, but I still think my idea is better because it is simpler.',
    },
    corrections: spokenCorrections(out.corrections, r.history.filter((l) => l.from === 'you').at(-1)?.text || '').slice(0, 2),
  });
}

// ---------- character voices (Fish Audio) ----------

const VOICES: Record<string, keyof Env> = {
  sara: 'FISH_VOICE_SARA',
  yacine: 'FISH_VOICE_YACINE',
  benali: 'FISH_VOICE_BENALI',
  haddad: 'FISH_VOICE_HADDAD',
};

/**
 * Speak one line in a character's voice. The same line in the same voice always sounds the same,
 * so generated audio is kept in KV (when bound): a line any learner has heard is never made twice.
 * The x-speakia-voice header says "stored" or "generated", which the app logs with its timings.
 */
async function speak(url: URL, env: Env, ctx: ExecutionContext) {
  if (!env.FISH_API_KEY) return json({ error: 'Voices are not set up on the server' }, 503);
  const who = url.searchParams.get('who') ?? '';
  const text = (url.searchParams.get('text') ?? '').trim();
  const slow = url.searchParams.get('slow') === '1';
  if (!VOICES[who]) return json({ error: 'Unknown character' }, 400);
  if (!text || text.length > 400) return json({ error: 'Text must be 1 to 400 characters' }, 400);

  const model = env.FISH_MODEL || 's2.1-pro-free';
  const voice = env[VOICES[who]] as string | undefined;
  const audioHeaders = { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=2592000', ...CORS };

  // Key: everything that changes the audio, nothing about who asked.
  const key = await sha256(`${model}|${voice ?? 'default'}|${slow ? 1 : 0}|${text}`);
  if (env.AUDIO) {
    const stored = await env.AUDIO.get(key, 'arrayBuffer');
    if (stored) return new Response(stored, { headers: { ...audioHeaders, 'x-speakia-voice': 'stored' } });
  }

  const started = Date.now();
  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.FISH_API_KEY}`, 'content-type': 'application/json', model },
    body: JSON.stringify({
      text,
      ...(voice ? { reference_id: voice } : {}),
      format: 'mp3',
      mp3_bitrate: 64,
      latency: 'low',
      chunk_length: 100,
      prosody: { speed: slow ? 0.85 : 1 },
    }),
  });
  if (!res.ok || !res.body) return json({ error: `Voice failed: ${res.ok ? 'empty audio' : await res.text()}` }, 502);
  console.log(`fish ${who}: first byte after ${Date.now() - started} ms (${text.length} chars)`);

  // Stream to the learner now; save a copy to KV in the background.
  const [toLearner, toStore] = res.body.tee();
  if (env.AUDIO) {
    const store = env.AUDIO;
    ctx.waitUntil(
      new Response(toStore).arrayBuffer().then((buf) => {
        console.log(`fish ${who}: complete after ${Date.now() - started} ms (${buf.byteLength} bytes)`);
        return store.put(key, buf, { expirationTtl: 60 * 60 * 24 * 90 });
      })
    );
  } else {
    ctx.waitUntil(toStore.cancel());
  }
  return new Response(toLearner, { headers: { ...audioHeaders, 'x-speakia-voice': 'generated' } });
}

async function sha256(s: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- speaking evaluation (placement test) ----------

type AssessRequest = {
  answers: { question: string; text: string; seconds?: number }[];
};

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
type Cefr = (typeof CEFR)[number];
const isCefr = (v: unknown): v is Cefr => typeof v === 'string' && (CEFR as readonly string[]).includes(v);

// Short working summary of the CEFR qualitative aspects of spoken language (range, accuracy,
// fluency, coherence). It guides the model; it is not the official descriptor text.
const RUBRIC = `CEFR spoken language, summarised per level:
RANGE (vocabulary and structures): A1 isolated words and memorised phrases; A2 basic sentence patterns, everyday words, limited; B1 enough language to talk about familiar topics with some circumlocution; B2 clear descriptions and viewpoints, some complex sentences, varied vocabulary; C1 broad range, flexible, precise, idiomatic.
ACCURACY (grammar control): A1 very limited control of simple forms; A2 simple structures but systematic basic mistakes (e.g. "I am agree", missing past tense); B1 reasonably accurate in familiar contexts, mistakes occur but meaning is clear; B2 good control, few errors that do not cause misunderstanding; C1 consistently high accuracy, rare slips.
FLUENCY: A1 many pauses, very short utterances; A2 short contributions, frequent pauses and false starts; B1 keeps going with noticeable pauses for planning; B2 fairly even tempo, few long pauses; C1 fluent and spontaneous. Use words-per-minute when given: under 60 A1-A2, 60-100 A2-B1, 100-130 B1-B2, over 130 B2+.
COHERENCE (linking ideas): A1 "and", "then"; A2 simple connectors "but", "because"; B1 a linear sequence of points with common linkers; B2 a range of linking words to mark relationships clearly; C1 well-organised, varied cohesive devices.`;

type Criterion = { level: Cefr | null; note: string };

async function assess(req: Request, env: Env) {
  const r = (await req.json()) as AssessRequest;
  const answers = (r.answers ?? []).slice(0, 6).map((a) => ({
    question: String(a.question ?? '').slice(0, 200),
    text: String(a.text ?? '').slice(0, 1500),
    seconds: typeof a.seconds === 'number' && a.seconds > 0 ? Math.round(a.seconds) : undefined,
  }));
  if (!answers.length) return json({ error: 'Missing answers' }, 400);

  const listing = answers
    .map((a, i) => {
      const words = a.text.split(/\s+/).filter(Boolean).length;
      const timing = a.seconds
        ? `Spoken in ${a.seconds}s (${words} words, about ${Math.round((words / a.seconds) * 60)} words per minute)`
        : `Typed, not spoken (${words} words): fluency cannot be judged from it`;
      return `Answer ${i + 1}. Question: "${a.question}"\nTranscript: "${a.text}"\n${timing}`;
    })
    .join('\n\n');

  const system = `You are an experienced English teacher assessing a university student's SPOKEN English for a placement test, using the CEFR. You only see transcripts (speech-to-text) plus timing, so you cannot judge pronunciation: never comment on it. Speech-to-text may smooth over small slips, so do not invent mistakes that are not in the transcript.

${RUBRIC}

Assess each criterion separately from the evidence, then give one overall level (usually the level most criteria agree on; never higher than the accuracy level plus one step). If there is too little speech to judge (very short or off-topic answers), set "confident": false.

Return ONLY a JSON object:
{
 "level": "A1"|"A2"|"B1"|"B2"|"C1"|"C2",
 "confident": boolean,
 "criteria": {
   "range": {"level": "...", "note": "<one short sentence, addressed to the student as 'you'>"},
   "accuracy": {"level": "...", "note": "..."},
   "fluency": {"level": "...", "note": "..."},
   "coherence": {"level": "...", "note": "..."}
 },
 "strengths": ["<max 2 short points>"],
 "improve": ["<max 2 short, practical points>"],
 "corrections": [{"said": "<exact short phrase from a transcript>", "better": "<corrected phrase>"}]
}
Never correct punctuation, capitalization, spacing or ASR spelling. Focus on spoken grammar and vocabulary only. "corrections": at most 3 real mistakes, empty array if none. Keep every text short, friendly and concrete.`;

  const res = await fetch(`${GROQ}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.GROQ_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env.CHAT_MODEL || 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: listing },
      ],
      temperature: 0.2,
      reasoning_effort: 'medium',
      include_reasoning: false,
      max_completion_tokens: 2048,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.log(`groq assess failed ${res.status}: ${detail.slice(0, 300)}`);
    return json({ error: `AI failed: ${detail}` }, 502);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  let out: Record<string, any> = {};
  try {
    out = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
  } catch {
    return json({ error: 'The AI returned an unreadable evaluation' }, 502);
  }
  if (!isCefr(out.level)) return json({ error: 'The AI returned no level' }, 502);

  const criterion = (c: any): Criterion => ({
    level: isCefr(c?.level) ? c.level : null,
    note: typeof c?.note === 'string' ? c.note.slice(0, 200) : '',
  });
  const strings = (v: any, n: number) =>
    Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, n).map((x: string) => x.slice(0, 160)) : [];
  return json({
    level: out.level,
    confident: out.confident !== false,
    criteria: {
      range: criterion(out.criteria?.range),
      accuracy: criterion(out.criteria?.accuracy),
      fluency: criterion(out.criteria?.fluency),
      coherence: criterion(out.criteria?.coherence),
    },
    strengths: strings(out.strengths, 2),
    improve: strings(out.improve, 2),
    corrections: answers.flatMap((a) => spokenCorrections(out.corrections, a.text)).filter((c, i, all) => all.findIndex((other) => other.said === c.said && other.better === c.better) === i).slice(0, 3),
  });
}

/** Legacy clients/placement keep their response shape while sharing the spoken-expression filter. */
function spokenCorrections(raw: unknown, text: string) {
  return confirmedCorrections(Array.isArray(raw) ? raw.map((c) => ({ ...c, category: c?.category || 'grammar' })) : [], text, 'legacy')
    .map(({ said, better }) => ({ said, better }));
}
