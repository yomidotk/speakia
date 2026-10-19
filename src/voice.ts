import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { CAST, CastId } from './content/cast';
import { idToken } from './storage';

// Character voices come from Fish Audio through our server (GET /speak). Each line is downloaded
// once and kept on the phone, so replays and lines prepared during the intro play instantly.
// Without a server, or if a line takes too long, the phone's built-in voice reads it instead.
const API = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const WAIT_MS = 6_000; // longest we keep the learner waiting before the phone voice takes over

type Callbacks = { onStart?: () => void; onDone?: () => void };

let current: AudioPlayer | null = null;
let currentDone: (() => void) | null = null;
let sayCount = 0; // bumps on every new line or stop, so a slow download can't play over a newer line

// ---------- phone voices (fallback) ----------

let voices: Speech.Voice[] | null = null;

async function englishVoices() {
  if (voices) return voices;
  try {
    const all = await Speech.getAvailableVoicesAsync();
    voices = all.filter((v) => v.language?.toLowerCase().startsWith('en'));
  } catch {
    voices = [];
  }
  return voices ?? [];
}

async function sayOnPhone(who: CastId, text: string, cb: Callbacks, slow: boolean, mine: number, playbackRate = 1) {
  const c = CAST[who];
  const list = await englishVoices();
  if (mine !== sayCount) return;
  const voice = list.length ? list[c.voice.index % list.length].identifier : undefined;
  Speech.speak(text, {
    language: 'en-US',
    voice,
    pitch: c.voice.pitch,
    rate: c.voice.rate * (slow ? 0.85 : 1) * playbackRate,
    onStart: cb.onStart,
    onDone: cb.onDone,
    onStopped: cb.onDone,
    onError: cb.onDone,
  });
}

// ---------- fetching lines (one download per line) ----------

const speakUrl = (who: CastId, text: string, slow: boolean) =>
  `${API}/speak?who=${who}&slow=${slow ? 1 : 0}&text=${encodeURIComponent(text)}`;

/** Short stable file name for a line's audio. */
function fileName(url: string) {
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) | 0;
  return `${(h >>> 0).toString(36)}-${url.length}.mp3`;
}

const voiceDir = Platform.OS === 'web' ? null : new Directory(Paths.cache, 'voice');
const inFlight = new Map<string, Promise<string | null>>();
const webAudio = new Map<string, string>(); // web: line url -> object URL

/**
 * A playable address for a line: a saved file (phone) or object URL (web). Saved lines resolve at
 * once; a line that is already downloading is shared instead of being requested twice.
 */
function fetchLine(who: CastId, text: string, slow: boolean): Promise<string | null> {
  const url = speakUrl(who, text, slow);
  const saved = webAudio.get(url);
  if (saved) return Promise.resolve(saved);
  const file = voiceDir ? new File(voiceDir, fileName(url)) : null;
  if (file?.exists) return Promise.resolve(file.uri);
  const pending = inFlight.get(url);
  if (pending) return pending;

  const job = (async () => {
    const token = await idToken();
    if (!token) { console.warn("[speakia] DIAGNOSIS: Firebase token missing; voice request was NOT sent to backend."); return null; }
    const t0 = Date.now();
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.warn(`[speakia] voice ${who}: server said ${res.status}`);
      return null;
    }
    const source = res.headers.get('x-speakia-voice') ?? 'server';
    if (file && voiceDir) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!voiceDir.exists) voiceDir.create({ intermediates: true, idempotent: true });
      file.write(bytes);
      console.log(`[speakia] voice ${who}: ready in ${Date.now() - t0} ms (${source}, ${bytes.length} bytes)`);
      return file.uri;
    }
    const objectUrl = URL.createObjectURL(await res.blob());
    webAudio.set(url, objectUrl);
    console.log(`[speakia] voice ${who}: ready in ${Date.now() - t0} ms (${source})`);
    return objectUrl;
  })()
    .catch((e) => {
      console.warn(`[speakia] voice ${who}: download failed`, e);
      return null;
    })
    .finally(() => inFlight.delete(url));

  inFlight.set(url, job);
  return job;
}

/**
 * Voice and save these lines now, so they play instantly later. Runs in the background, two at a
 * time, in order (the first lines are ready first).
 */
export async function prepareLines(lines: { who: CastId; text: string }[], slow = false) {
  if (!API || !(await idToken())) return;
  const queue = [...lines];
  const worker = async () => {
    for (let l = queue.shift(); l; l = queue.shift()) await fetchLine(l.who, l.text, slow);
  };
  await Promise.all([worker(), worker()]);
}

// ---------- playing ----------

type Source = string | { uri: string; headers: Record<string, string> };

/**
 * Play audio. Resolves true once it starts (or is stopped first), false if it has not started
 * within `startWithin` ms, in which case it is released and the caller can fall back.
 */
function play(source: Source, cb: Callbacks, startWithin?: number, playbackRate = 1): Promise<boolean> {
  return new Promise((resolve) => {
    const player = createAudioPlayer(source);
    player.shouldCorrectPitch = true;
    player.setPlaybackRate(playbackRate);
    current = player;
    let started = false;
    let finished = false;
    const release = () => {
      sub.remove();
      player.remove();
      if (current === player) { current = null; currentDone = null; }
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      release();
      cb.onDone?.();
      resolve(true);
    };
    const timer = startWithin
      ? setTimeout(() => {
          if (started || finished) return;
          finished = true;
          release();
          resolve(false);
        }, startWithin)
      : null;
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (!started && status.playing) {
        started = true;
        if (timer) clearTimeout(timer);
        cb.onStart?.();
        resolve(true);
      }
      if (started && status.didJustFinish) finish();
    });
    currentDone = finish;
    player.play();
  });
}

const timeout = (ms: number) => new Promise<null>((r) => setTimeout(() => r(null), ms));

const isSaved = (url: string) =>
  webAudio.has(url) || inFlight.has(url) || (!!voiceDir && new File(voiceDir, fileName(url)).exists);

/**
 * Speak a line as a character: their Fish Audio voice when the server is set up, otherwise the
 * phone's built-in voice with the character's own pitch.
 *
 * `live` is for brand-new lines (AI replies): instead of downloading the whole clip first, the
 * audio plays while it is still arriving, so the reply starts sooner.
 */
export async function say(who: CastId, text: string, cb: Callbacks = {}, slow = false, live = false, playbackRate = 1) {
  stopSpeaking();
  const mine = ++sayCount;
  if (API) {
    const t0 = Date.now();
    const url = speakUrl(who, text, slow);
    const logStart: Callbacks = {
      ...cb,
      onStart: () => {
        console.log(`[speakia] voice ${who}: sound after ${Date.now() - t0} ms${live ? ' (live)' : ''}`);
        cb.onStart?.();
      },
    };

    if (live && Platform.OS !== 'web' && !isSaved(url)) {
      const token = await idToken();
      if (token && mine === sayCount) {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        if (mine !== sayCount) return;
        if (await play({ uri: url, headers: { authorization: `Bearer ${token}` } }, logStart, WAIT_MS, playbackRate)) return;
        if (mine !== sayCount) return;
        console.warn(`[speakia] voice ${who}: live reply did not start in ${WAIT_MS} ms, using phone voice`);
        await sayOnPhone(who, text, cb, slow, mine, playbackRate);
        return;
      }
    }

    // if we stop waiting, the download carries on in the background: next time the line is instant
    const uri = await Promise.race([fetchLine(who, text, slow), timeout(WAIT_MS)]);
    if (mine !== sayCount) return; // a newer line, or a stop, replaced this one while we waited
    if (uri) {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      if (mine !== sayCount) return;
      if (!(await play(uri, logStart, WAIT_MS, playbackRate)) && mine === sayCount) await sayOnPhone(who, text, cb, slow, mine, playbackRate);
      return;
    }
    console.warn(`[speakia] voice ${who}: not ready after ${Date.now() - t0} ms, using phone voice`);
  }
  await sayOnPhone(who, text, cb, slow, mine, playbackRate);
}

export function stopSpeaking() {
  sayCount++;
  Speech.stop();
  if (current) {
    current.pause();
    const done = currentDone;
    current = null;
    currentDone = null;
    done?.(); // releases the player and tells the screen the line ended
  }
}
