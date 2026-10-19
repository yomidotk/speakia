import { idToken } from './storage';
import { getEpisode, guideRole, type Hints } from './content/episodes';
import { goodbyeSignal, measuredReport, type Measurements, type PracticeSnapshot } from './practice-core';
const API = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
export type PracticeReply = { stateToken: string; snapshot: PracticeSnapshot; reply: string; speechParts: { text: string; live?: boolean }[]; hints: Hints; done: boolean; stage: string; bridgeWords: { from: string; to: string }[] };
export type ReportRequest = { requestId: string; stateToken: string; measurements: Measurements };
export const requestId = () => `req-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
async function post<T>(path: string, body: unknown): Promise<T> {
  const token = await idToken();
  if (!token) throw new Error('Sign in to use the AI. Your answer is kept.');
  const r = await fetch(`${API}/practice/${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(45_000) });
  const data = await r.json().catch(() => ({}));
  if (r.status === 404) throw new Error('This server needs the practice update. Ask the backend owner to deploy the matching Worker.');
  if (r.status === 429) throw new Error('The AI usage limit was reached. Your answer is kept; wait before retrying.');
  if (!r.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Request failed; retry your saved answer.');
  return data as T;
}
function demoReply(snapshot: PracticeSnapshot, reply: string): PracticeReply {
  const ep = getEpisode(snapshot.episodeId)!; const role = ep.guide ? guideRole(ep.guide) : ep.roles[snapshot.roleIndex];
  return { snapshot, stateToken: JSON.stringify(snapshot), reply, speechParts: reply ? [{ text: reply }] : [], hints: role.firstHints, done: !!snapshot.endedAt, stage: 'Script preview · AI not configured', bridgeWords: [] };
}
export async function startPractice(body: { requestId: string; episodeId: string; roleIndex: number; learnerName?: string }): Promise<PracticeReply> {
  if (API) return post('start', body);
  const ep = getEpisode(body.episodeId)!; const role = ep.guide ? guideRole(ep.guide) : ep.roles[body.roleIndex];
  const opening = role.firstSpeaker === 'learner' ? '' : role.opening;
  return demoReply({ id: requestId(), episodeId: ep.id, roleIndex: body.roleIndex, startedAt: Date.now(), step: 0, goodbyeCount: 0, completed: false, turns: [], objectives: [], history: opening ? [{ from: 'partner', text: opening }] : [] }, opening);
}
export async function answerPractice(body: { requestId: string; stateToken: string; text: string; source: 'speech' | 'typed'; recordingMs: number; edited: boolean; level: string; major: string }): Promise<PracticeReply> {
  if (API) return post('turn', body);
  const s = JSON.parse(body.stateToken) as PracticeSnapshot;
  s.turns.push({ id: body.requestId, text: body.text, source: body.source, recordingMs: body.recordingMs, edited: body.edited, assessed: false, corrections: [] });
  if (goodbyeSignal(body.text)) { s.endedAt = Date.now(); s.endReason = 'demo_ended'; }
  const reply = s.endedAt ? 'Goodbye! This was a script preview.' : 'This preview cannot assess or advance your answer. Configure the AI server to practise the conversation.';
  s.history.push({ from: 'you', text: body.text, turnId: body.requestId }, { from: 'partner', text: reply });
  return demoReply(s, reply);
}
export async function reportPractice(body: ReportRequest) {
  if (API) return post<{ report: ReturnType<typeof measuredReport>; stateToken: string; snapshot: PracticeSnapshot }>('report', body);
  const s = JSON.parse(body.stateToken) as PracticeSnapshot; s.endedAt ??= Date.now();
  const report = measuredReport(s, body.measurements); report.analysisStatus = 'unavailable';
  return { report, stateToken: JSON.stringify(s), snapshot: s };
}
