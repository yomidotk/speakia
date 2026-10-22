import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startPractice, practiceTurn, practiceReport, type PracticeReply } from '../src/practice';
import { confirmedCorrections, goodbyeSignal, measuredReport, revealHint, elapsed } from '../../src/practice-core';
import { getEpisode } from '../../src/content/episodes';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const env = { GROQ_API_KEY: 'test-only-not-a-provider-key', PRACTICE_SIGNING_KEY: 'test-session-signing-key' };
let n = 0;
const rid = () => `test-request-${++n}`;
const user = 'learner-one';
const start = async (roleIndex = 0, episodeId = 'orientation') => await startPractice({ requestId: rid(), episodeId, roleIndex }, user, env) as PracticeReply;
const turn = async (r: PracticeReply, text: string, extra = {}) => await practiceTurn({ requestId: rid(), stateToken: r.stateToken, text, source: 'typed', ...extra }, user, env) as PracticeReply;
function mockModel(answer: unknown, inspect?: (body: any) => void) {
  let calls = 0;
  globalThis.fetch = async (_url, init) => { calls++; inspect?.(JSON.parse(init!.body as string)); return Response.json({ choices: [{ message: { content: JSON.stringify(answer) } }] }); };
  return () => calls;
}

test('cosmetic changes, guessed spans and unsupported spelling findings never count', () => {
  const raw = [
    { said: 'hello sara', better: 'Hello, Sara.', category: 'grammar' },
    { said: 'i go yesterday', better: 'I went yesterday', category: 'grammar', explanation: 'Past tense.' },
    { said: 'I live here', better: 'I lived here', category: 'grammar' },
    { said: 'Sara', better: 'Sarah', category: 'spelling' },
    { said: 'i go yesterday', better: 'I went yesterday', category: 'grammar' },
  ];
  const found = confirmedCorrections(raw, 'hello sara i go yesterday', 'turn-1');
  assert.equal(found.length, 1); assert.equal(found[0].start, 11); assert.equal(found[0].turnId, 'turn-1');
  assert.deepEqual(confirmedCorrections([{ said: 'is', better: 'was', category: 'grammar' }], 'this', 't'), []);
});
test('goodbye detection uses whole-message intent', () => {
  assert.equal(goodbyeSignal('Bye!'), 1); assert.equal(goodbyeSignal('bye bye bye'), 2);
  assert.equal(goodbyeSignal('Please stop'), 2); assert.equal(goodbyeSignal('I want to stop now.'), 2);
  for (const text of ['What does goodbye mean?', 'I said bye to my mum this morning.', 'Goodbye is a word.', 'Do not stop']) assert.equal(goodbyeSignal(text), 0);
});
test('ordered steps advance once, anchored to evidence, with canonical next question and hints', async () => {
  const s = await start();
  const calls = mockModel({ reply: 'Welcome! What club would you like?', advance: true, evidence: 'first day', corrections: [{ said: 'my first day', better: 'my first day.', category: 'grammar' }] });
  const r = await turn(s, "Yes, I am. It's my first day today.");
  assert.equal(r.snapshot.step, 1); assert.equal(r.snapshot.objectives[0].id, 'step-1');
  assert.match(r.reply, /name and your department/); assert.doesNotMatch(r.reply, /What club/); assert.equal(r.snapshot.turns[0].corrections.length, 0);
  assert.equal(r.hints.starter, getEpisode('orientation')!.roles[0].guide!.lines[1].hints!.starter); assert.equal(calls(), 1);
});
test('off-topic and unresolved follow-ups do not skip scenario questions', async () => {
  const s = await start();
  mockModel({ reply: 'The check-in desk is right here.', advance: false, evidence: '', needsClarification: false });
  const r = await turn(s, 'Where is the check-in desk?');
  assert.equal(r.snapshot.step, 0); assert.match(r.reply, /first-year student/);
  mockModel({ reply: 'Thanks.', advance: true, evidence: 'imaginary answer' });
  const r2 = await turn(r, 'Tell me about football.'); assert.equal(r2.snapshot.step, 0);
});
test('first goodbye redirects once, second closes without provider calls', async () => {
  const s = await start(); globalThis.fetch = async () => { throw new Error('must not call provider'); };
  const r = await turn(s, 'bye'); assert.equal(r.done, false); assert.equal(r.snapshot.step, 0);
  const end = await turn(r, 'goodbye'); assert.equal(end.done, true); assert.equal(end.snapshot.completed, false); assert.equal(end.snapshot.endReason, 'learner_requested_stop');
  assert.equal(end.snapshot.turns.length, 2);
  await assert.rejects(() => turn(end, 'hello'), /already ended/);
});
test('repeated goodbye in one message or explicit stop ends immediately', async () => {
  for (const text of ['bye bye bye', 'I want to stop']) {
    const r = await turn(await start(), text); assert.equal(r.done, true); assert.equal(r.snapshot.turns.length, 1);
  }
});
test('every scenario has a listening scene with Yacine’s example answers, then roles', () => {
  for (const id of ['orientation', 'professor', 'friends', 'group-project']) {
    const ep = getEpisode(id)!; assert.equal(ep.guide, undefined);
    assert.ok(ep.scene.some((l) => l.who === 'yacine')); assert.equal(ep.roles[0].player, 'yacine');
    assert.equal(ep.roles.length, id === 'orientation' || id === 'professor' ? 2 : 1);
  }
  // the listening scene keeps the teacher's full lines
  assert.ok(getEpisode('orientation')!.scene.at(-1)!.text.includes('strict about deadlines'));
});
test('playing the host: the AI is the new student, never the host', async () => {
  const s = await start(1); assert.equal(s.reply, ''); assert.match(s.hints.idea, /Welcome/);
  mockModel({ reply: 'Yes, I am. It’s my first day today.', advance: true, evidence: 'first-year' }, (body) => {
    const system = body.messages[0].content; const data = JSON.parse(body.messages[1].content);
    assert.match(system, /You are Yacine/); assert.match(system, /The learner plays Sara/); assert.match(system, /Never welcome them/);
    assert.equal(data.youAre, 'Yacine'); assert.equal(data.learnerPlays, 'Sara'); assert.ok(data.factsAboutYacine.length > 0); assert.equal(data.facts, undefined);
  });
  const r = await turn(s, 'Hi, welcome! Are you a new first-year student?');
  assert.equal(r.snapshot.step, 1); assert.equal(r.reply, 'Yes, I am. It’s my first day today.'); assert.deepEqual(r.speechParts.map((p) => p.who), ['yacine']);
  assert.match(r.hints.idea, /name/);
  mockModel({ reply: 'Fine.', advance: false }, (body) => {
    const data = JSON.parse(body.messages[1].content);
    assert.deepEqual(data.history.map((h: any) => h.speaker), ['Sara (the learner)', 'Yacine']); assert.equal(data.learnerLastMessage, 'Great!');
  });
  await turn(r, 'Great!');
});
test('scenes with several people give each line its own speaker', async () => {
  let r = await start(0, 'friends');
  assert.deepEqual(r.speechParts.map((p) => p.who), ['rayan']); assert.equal(r.snapshot.history[0].who, 'rayan');
  for (let i = 0; i < 4; i++) {
    mockModel({ reply: 'Nice!', advance: true, evidence: 'my answer' }, (body) => {
      assert.match(body.messages[0].content, /You are Rayan/); assert.match(body.messages[0].content, /The learner plays Yacine/);
    });
    r = await turn(r, 'This is my answer.');
  }
  // Rayan reacts to the answer he asked for, introduces Lina, then Lina speaks
  assert.deepEqual(r.speechParts.map((p) => p.who), ['rayan', 'rayan', 'lina']); assert.match(r.speechParts[1].text, /here’s Lina/);
  assert.deepEqual(r.snapshot.history.slice(-3).map((l) => l.who), ['rayan', 'rayan', 'lina']);
  mockModel({ reply: 'Oh!', advance: false, evidence: '' }, (body) => assert.match(body.messages[0].content, /You are Lina/));
  const again = await turn(r, 'What?');
  // not answered yet: Lina repeats her question, Rayan doesn't introduce her again
  assert.deepEqual(again.speechParts.map((p) => p.who), ['lina', 'lina']); assert.doesNotMatch(again.reply, /here’s Lina/);
});
test('complete guided scenario covers every configured objective in order', async () => {
  for (const id of ['orientation', 'professor', 'friends', 'group-project']) {
    const answers = getEpisode(id)!.roles[0].guide!.lines.length - 1; // the last line closes the scene
    let r = await start(0, id);
    for (let i = 0; i < answers; i++) {
      mockModel({ reply: 'All right.', advance: true, evidence: 'My answer', needsClarification: false });
      r = await turn(r, 'My answer meets the current objective.');
      assert.equal(r.snapshot.step, i + 1); assert.equal(r.done, i === answers - 1);
    }
    assert.equal(r.snapshot.completed, true); assert.equal(r.snapshot.objectives.length, answers);
  }
});
test('provider failure keeps the previous accepted state and retry does not double count', async () => {
  const s = await start(); const body = { requestId: rid(), stateToken: s.stateToken, text: 'I registered online.', source: 'speech', recordingMs: 4000 };
  globalThis.fetch = async () => new Response('quota', { status: 429 });
  await assert.rejects(() => practiceTurn(body, user, env), /quota/); assert.equal(s.snapshot.turns.length, 0);
  const calls = mockModel({ reply: 'Thanks.', advance: true, evidence: 'registered online' });
  const r = await practiceTurn(body, user, env) as PracticeReply;
  const retry = await practiceTurn(body, user, env) as PracticeReply;
  assert.deepEqual(r, retry); assert.equal(calls(), 1); assert.equal(retry.snapshot.turns.length, 1);
  assert.equal(retry.snapshot.turns[0].recordingMs, 4000);
  await assert.rejects(() => practiceTurn({ ...body, text: 'changed' }, user, env), /reused/);
});
test('concurrent retries share one provider call and reject conflicting payloads', async () => {
  const s = await start(); const body = { requestId: rid(), stateToken: s.stateToken, text: 'I registered online.' };
  let release!: () => void; let calls = 0;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  globalThis.fetch = async () => { calls++; await wait; return Response.json({ choices: [{ message: { content: JSON.stringify({ reply: 'Thanks.', advance: false }) } }] }); };
  const a = practiceTurn(body, user, env); const b = practiceTurn(body, user, env);
  // Allow async signature/digest work to enter the pending map.
  await new Promise((resolve) => setTimeout(resolve, 30));
  await assert.rejects(() => practiceTurn({ ...body, text: 'different' }, user, env), /reused/);
  release(); const [r1, r2] = await Promise.all([a, b]); assert.deepEqual(r1, r2); assert.equal(calls, 1);
});
test('signed session cannot be changed or used by another Firebase learner', async () => {
  const s = await start();
  await assert.rejects(() => practiceTurn({ requestId: rid(), stateToken: s.stateToken, text: 'bye' }, 'other-user', env), /another account/);
  const [header, payload, sig] = s.stateToken.split('.');
  const changed = JSON.parse(Buffer.from(payload, 'base64url').toString()); changed.practice.completed = true;
  const token = `${header}.${Buffer.from(JSON.stringify(changed)).toString('base64url')}.${sig}`;
  await assert.rejects(() => practiceTurn({ requestId: rid(), stateToken: token, text: 'bye' }, user, env), /expired/);
});
test('hint reveals are unique per turn/tier and direct example opens only that tier', () => {
  let events = revealHint([], 0, 3); events = revealHint(events, 0, 3); assert.equal(events.length, 1);
  events = revealHint(events, 1, 3); assert.equal(events.length, 2);
  assert.deepEqual(elapsed(1000, 11_000, 2000, 9000), { totalMs: 10_000, activeMs: 6000 });
});
test('measured report keeps actual zero counts, partial sessions, typed/spoken split and all findings', async () => {
  const s = await start();
  const empty = measuredReport(s.snapshot, { totalMs: 1000, pausedMs: 5000, hintReveals: [] });
  assert.equal(empty.turns, 0); assert.equal(empty.activeMs, 0); assert.equal(empty.status, 'ended_early');
  mockModel({ reply: 'All right.', advance: false, corrections: [{ said: 'I go yesterday', better: 'I went yesterday', category: 'grammar', explanation: 'Use past tense.' }] });
  const r = await turn(s, 'I go yesterday', { source: 'speech', recordingMs: 4500 });
  const r2 = await turn(r, 'I go yesterday', { source: 'typed', recordingMs: 9000 });
  const report = measuredReport(r2.snapshot, { totalMs: 90_000, pausedMs: 10_000, hintReveals: [{ turnIndex: 0, tier: 3 }, { turnIndex: 0, tier: 3 }, { turnIndex: 100, tier: 1 }] });
  assert.equal(report.activeMs, 80_000); assert.equal(report.recordingMs, 4500); assert.equal(report.learnerSpeakingMs, null);
  assert.equal(report.typedTurns, 1); assert.equal(report.spokenTurns, 1); assert.equal(report.hintReveals, 1); assert.equal(report.highestHintTier, 3);
  assert.equal(report.errorCount, 2); assert.equal(report.recurringPatterns[0].occurrences, 2); assert.equal(report.pronunciation.status, 'unavailable');
});
test('summary failure still returns measured results and report retry is idempotent', async () => {
  const s = await start(); const r = await turn(s, 'bye bye');
  globalThis.fetch = async () => new Response('quota', { status: 429 });
  const body = { requestId: rid(), stateToken: r.stateToken, measurements: { totalMs: 12_000, pausedMs: 2000, hintReveals: [] } };
  const first = await practiceReport(body, user, env) as any;
  const second = await practiceReport(body, user, env) as any;
  assert.deepEqual(first, second); assert.equal(first.report.analysisStatus, 'failed'); assert.equal(first.report.totalMs, 12_000); assert.equal(first.report.turns, 1);
  mockModel({ strengths: [{ text: 'Unsupported', answers: [99] }, { text: 'Closed politely.', answers: [1] }], priorities: [], recommendation: 'Try a longer answer.' });
  const retry = await practiceReport({ ...body, requestId: rid() }, user, env) as any;
  assert.equal(retry.report.analysisStatus, 'done'); assert.deepEqual(retry.report.strengths, ['Closed politely.']); assert.equal(retry.report.turns, 1);
});

test('malformed hint events are ignored instead of breaking a saved report', async () => {
  const s = await start();
  const r = measuredReport(s.snapshot, { totalMs: 100, pausedMs: 0, hintReveals: [null, 12, {}, { turnIndex: 0, tier: 1, extra: 'ignored' }] as any });
  assert.deepEqual(r.hintEvents, [{ turnIndex: 0, tier: 1 }]);
});

test('Worker routes authenticate Firebase tokens and return structured practice errors', async () => {
  const { default: worker } = await import('../src/index');
  const { generateKeyPair, exportJWK, SignJWT } = await import('jose');
  const fullEnv = { ...env, FIREBASE_PROJECT_ID: 'test-project' };
  const ctx = { waitUntil() {}, passThroughOnException() {} } as any;
  const noAuth = await worker.fetch(new Request('https://test/practice/start', { method: 'POST', body: '{}' }), fullEnv, ctx);
  assert.equal(noAuth.status, 401);
  assert.equal((await worker.fetch(new Request('https://test/', { method: 'GET' }), fullEnv, ctx)).status, 200);
  assert.equal((await worker.fetch(new Request('https://test/practice/start', { method: 'OPTIONS' }), fullEnv, ctx)).status, 200);
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), alg: 'RS256', use: 'sig', kid: 'test-key' };
  globalThis.fetch = async (url) => {
    assert.match(String(url), /googleapis.com/);
    return Response.json({ keys: [jwk] }, { headers: { 'cache-control': 'public, max-age=3600' } });
  };
  const token = await new SignJWT({}).setSubject(user).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setIssuer('https://securetoken.google.com/test-project').setAudience('test-project').setIssuedAt().setExpirationTime('1h').sign(privateKey);
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const malformed = await worker.fetch(new Request('https://test/practice/start', { method: 'POST', headers, body: 'bad json' }), fullEnv, ctx);
  assert.equal(malformed.status, 400);
  const response = await worker.fetch(new Request('https://test/practice/start', { method: 'POST', headers, body: JSON.stringify({ requestId: rid(), episodeId: 'orientation', roleIndex: 0 }) }), fullEnv, ctx);
  assert.equal(response.status, 200); const state = await response.json() as PracticeReply; assert.ok(state.stateToken);
  const badReport = await worker.fetch(new Request('https://test/practice/report', { method: 'POST', headers, body: JSON.stringify({ requestId: rid(), stateToken: state.stateToken }) }), fullEnv, ctx);
  assert.equal(badReport.status, 400); assert.match((await badReport.json() as any).error, /Measured session/);
});

test('transcripts drop Whisper echoing its prompt and parts it marks as not speech', async () => {
  const { heardText } = await import('../src/index');
  assert.equal(heardText({ text: ' A university student speaking English, sometimes using a French or Arabic word.' }), '');
  assert.equal(heardText({ segments: [{ text: 'Hi, welcome!', no_speech_prob: 0.05 }, { text: ' Thank you.', no_speech_prob: 0.9 }] }), 'Hi, welcome!');
  assert.equal(heardText({ text: 'I came by tram.' }), 'I came by tram.');
});

test('evidence counts despite small copying changes, but not when it was never said', async () => {
  const { quotes } = await import('../src/practice');
  const said = "Yes, I'm a new first year student here. I just came.";
  assert.ok(quotes('I’m a new first-year student', said));
  assert.ok(quotes('Yes, I am a new first year student', said));
  assert.ok(!quotes('I registered online last week', said));
  assert.ok(!quotes('', said));
  let r = await start();
  mockModel({ reply: 'Great, welcome!', advance: true, evidence: 'I’m a new first-year student' });
  r = await turn(r, said);
  assert.equal(r.snapshot.step, 1); assert.match(r.reply, /name and your department/);
});

test('the AI is told not to use the learner’s name before hearing it', async () => {
  mockModel({ reply: 'Welcome!', advance: true, evidence: 'new student' }, (body) => assert.match(body.messages[0].content, /never call the learner by name/));
  await turn(await start(), "Yes, I'm a new student.");
});

test('a half answer gets a follow-up for the missing part, not the whole question again', async () => {
  let r = await start();
  mockModel({ reply: 'Great!', advance: true, evidence: 'new student' });
  r = await turn(r, "Yes, I'm a new student.");
  mockModel({ reply: 'Nice to meet you, Noor! And which department are you in?', advance: false, evidence: '' });
  const half = await turn(r, 'My name is Noor.');
  assert.equal(half.snapshot.step, 1); assert.equal(half.reply, 'Nice to meet you, Noor! And which department are you in?');
  assert.doesNotMatch(half.reply, /Can I have your name/);
});

test('steps are judged on meaning: the AI is told grammar never blocks moving on', async () => {
  for (const id of ['orientation', 'professor', 'friends', 'group-project']) {
    for (const l of getEpisode(id)!.roles[0].guide!.lines) assert.doesNotMatch(l.criterion ?? '', /tense|present perfect/i);
  }
  mockModel({ reply: 'Oh, nice!', advance: true, evidence: 'My parents drive me' }, (body) => assert.match(body.messages[0].content, /grammar or vocabulary mistakes never stop advance=true/));
  await turn(await start(), 'My parents drive me to the campus today.');
});

test('every step that needs an answer carries the teacher’s expected answers, and the AI gets them as examples', async () => {
  for (const id of ['orientation', 'professor', 'friends', 'group-project']) {
    for (const role of getEpisode(id)!.roles) {
      const lines = role.guide!.lines;
      lines.slice(0, -1).forEach((l) => assert.ok(l.expected?.length, `${id} ${role.player} ${l.id}`));
    }
  }
  mockModel({ reply: 'Oh, nice!', advance: true, evidence: 'My parents drove me' }, (body) => {
    const data = JSON.parse(body.messages[1].content);
    assert.deepEqual(data.learnerTask.exampleAnswers, getEpisode('orientation')!.roles[0].guide!.lines[0].expected);
    assert.match(body.messages[0].content, /never the only ones/); assert.ok(data.learnerMission);
  });
  await turn(await start(), 'Yes, I am new.');
});
test('an off-topic message never moves on, and the question comes back', async () => {
  mockModel({ reply: 'Ha, let’s keep practising: we’re still checking you in!', advance: true, offTopic: true, evidence: 'pizza' });
  const r = await turn(await start(), 'Do you like pizza?');
  assert.equal(r.snapshot.step, 0); assert.match(r.reply, /keep practising/); assert.match(r.reply, /first-year student/);
});

test('when the main model is at its rate limit, the smaller one answers', async () => {
  const models: string[] = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init!.body as string); models.push(body.model);
    if (models.length === 1) return new Response('rate limit', { status: 429 });
    return Response.json({ choices: [{ message: { content: JSON.stringify({ reply: 'Great!', advance: true, evidence: 'new student' }) } }] });
  };
  const r = await turn(await start(), "Yes, I'm a new student.");
  assert.deepEqual(models, ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']); assert.equal(r.snapshot.step, 1);
});

test('DigitalOcean answers first when its key is set; Groq takes over if it fails', async () => {
  const { chat } = await import('../src/chat');
  const calls: string[] = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init!.body as string); calls.push(`${new URL(String(url)).host} ${body.model}`);
    if (String(url).includes('do-ai.run') && calls.length === 1) return new Response('busy', { status: 503 });
    return Response.json({ choices: [{ message: { content: '{"ok":true}' } }] });
  };
  const keys = { DO_MODEL_ACCESS_KEY: 'do-test', GROQ_API_KEY: 'groq-test' };
  const req = { messages: [{ role: 'user' as const, content: 'hi' }], temperature: 0, effort: 'low' as const, maxTokens: 10 };
  assert.deepEqual(await chat(keys, req), { ok: true, content: '{"ok":true}' });
  assert.deepEqual(calls, ['inference.do-ai.run openai-gpt-oss-120b', 'api.groq.com openai/gpt-oss-120b']);
  calls.length = 0; calls.push('skip');
  await chat(keys, req); assert.equal(calls[1], 'inference.do-ai.run openai-gpt-oss-120b'); assert.equal(calls.length, 2);
});

test('a reply where the AI speaks as the learner is never said', async () => {
  mockModel({ reply: 'Sure, I’m Yacine, Computer Science.', advance: true, evidence: 'yes' });
  const r = await turn(await start(), 'yes');
  assert.doesNotMatch(r.reply, /I’m Yacine|I'm Yacine/); assert.match(r.reply, /name and your department/);
});

test('a step never loops: after two on-topic tries it moves on, but off-topic tries don’t count', async () => {
  let r = await start(0, 'group-project');
  mockModel({ reply: 'Why do you think so?', advance: false, evidence: '' });
  r = await turn(r, 'Maybe more buses?'); assert.equal(r.snapshot.step, 0);
  mockModel({ reply: 'Ha, maybe later!', advance: false, offTopic: true, evidence: '' });
  r = await turn(r, 'Do you like cats?'); assert.equal(r.snapshot.step, 0);
  mockModel({ reply: 'What reason?', advance: false, evidence: '' });
  r = await turn(r, 'Transport is important.'); assert.equal(r.snapshot.step, 0);
  mockModel({ reply: 'And why exactly?', advance: false, evidence: '' });
  r = await turn(r, 'Because buses are full.'); assert.equal(r.snapshot.step, 1); assert.match(r.reply, /cafeteria/);
});
