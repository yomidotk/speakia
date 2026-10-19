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
  const calls = mockModel({ reply: 'Thank you. What club would you like?', advance: true, evidence: 'registered online', corrections: [{ said: 'I registered online', better: 'I registered online.', category: 'grammar' }] });
  const r = await turn(s, 'I registered online last week.');
  assert.equal(r.snapshot.step, 1); assert.equal(r.snapshot.objectives[0].id, 'registration');
  assert.match(r.reply, /full name/); assert.doesNotMatch(r.reply, /What club/); assert.equal(r.snapshot.turns[0].corrections.length, 0);
  assert.equal(r.hints.starter, getEpisode('orientation')!.roles[0].guide!.lines[1].hints!.starter); assert.equal(calls(), 1);
});
test('off-topic and unresolved follow-ups do not skip scenario questions', async () => {
  const s = await start();
  mockModel({ reply: 'You can register here.', advance: false, evidence: '', needsClarification: false });
  const r = await turn(s, 'Where can I register?');
  assert.equal(r.snapshot.step, 0); assert.match(r.reply, /registered online/);
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
test('both roles use correct cast, role-specific hints and learner-first helper opening', async () => {
  const ep = getEpisode('orientation')!; assert.equal(ep.roles.length, 2); assert.ok(ep.scene.length > 20); assert.equal(ep.guide, undefined);
  const s = await start(1); assert.equal(s.reply, ''); assert.match(s.hints.idea, /Welcome/);
  mockModel({ reply: 'I registered online last week.', advance: true, evidence: 'registered' }, (body) => {
    assert.match(body.messages[0].content, /partner, Yacine/); assert.match(body.messages[0].content, /new student, not the orientation helper/);
  });
  const r = await turn(s, 'Welcome! Have you registered online?'); assert.equal(r.snapshot.step, 1); assert.equal(r.reply, 'I registered online last week.');
  assert.doesNotMatch(r.reply, /full name/); assert.match(r.hints.idea, /full name/);
});
test('complete guided scenario covers every configured objective in order', async () => {
  let r = await start();
  for (let i = 0; i < 13; i++) {
    mockModel({ reply: 'All right.', advance: true, evidence: 'My answer', needsClarification: false });
    r = await turn(r, 'My answer meets the current objective.');
    assert.equal(r.snapshot.step, i + 1); assert.equal(r.done, i === 12);
  }
  assert.equal(r.snapshot.completed, true); assert.equal(r.snapshot.objectives.length, 13); assert.match(r.reply, /cafeteria/);
});
test('discussion goal requires two different grounded reasons, never fabricated or nested quotes', async () => {
  const s = await start(0, 'team-project');
  mockModel({ reply: 'Go on.', reasonQuotes: ['works on every device', 'every device', 'made up reason'] });
  const r = await turn(s, 'It works on every device.'); assert.equal(r.done, false);
  mockModel({ reply: 'Good reasons.', reasonQuotes: ['works on every device', 'easier to test quickly'] });
  const end = await turn(r, 'It is easier to test quickly.'); assert.equal(end.snapshot.completed, true);
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
  mockModel({ strengths: [{ text: 'Unsupported', turnIds: ['fake'] }, { text: 'Closed politely.', turnIds: [r.snapshot.turns[0].id] }], priorities: [], recommendation: 'Try a longer answer.' });
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
