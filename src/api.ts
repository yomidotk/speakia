import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { Level, idToken } from './storage';

// Set in .env at the project root (see README):
//   EXPO_PUBLIC_API_URL=https://speakia-api.<you>.workers.dev
// The server only answers learners signed in with Firebase (account or guest), so no key lives in the app.
const API = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

async function authHeaders(): Promise<Record<string, string>> {
  const token = await idToken();
  if (!token) throw new Error('Sign in to use voice and AI');
  return { authorization: `Bearer ${token}` };
}

/** No server configured: the app runs in demo mode (practice-api.ts) with typing only. */
export const isDemo = !API;

export async function transcribe(uri: string): Promise<string> {
  if (!API) throw new Error('No server configured');
  const form = new FormData();
  if (Platform.OS === 'web') {
    // the browser recorder gives a blob: URL
    form.append('file', await (await fetch(uri)).blob(), 'speech.webm');
  } else {
    // Expo's fetch only uploads real file objects (the old {uri, name, type} form is rejected with
    // "Unsupported FormDataPart implementation"). The file keeps its name, e.g. recording-123.m4a.
    form.append('file', new File(uri) as unknown as Blob);
  }
  const res = await fetch(`${API}/transcribe`, { method: 'POST', headers: await authHeaders(), body: form });
  if (!res.ok) throw new Error(`Transcription failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? '').trim();
}

// ---------- placement test: CEFR speaking evaluation ----------

export type CriterionResult = { level: Level | null; note: string };
export type Assessment = {
  level: Level;
  confident: boolean;
  criteria: { range: CriterionResult; accuracy: CriterionResult; fluency: CriterionResult; coherence: CriterionResult };
  strengths: string[];
  improve: string[];
  corrections: { said: string; better: string }[];
};

/** Ask the server's AI teacher to grade the spoken answers against CEFR speaking criteria. */
export async function assessSpeaking(answers: { question: string; text: string; seconds?: number }[]): Promise<Assessment> {
  if (!API) throw new Error('No server configured');
  const res = await fetch(`${API}/assess`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) throw new Error(`Evaluation failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as Assessment;
}
