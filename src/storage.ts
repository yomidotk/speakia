import type { PracticeReport } from './practice-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EmailAuthProvider, createUserWithEmailAndPassword, deleteUser, linkWithCredential, sendPasswordResetEmail,
  signInAnonymously, signInWithEmailAndPassword, signOut as fbSignOut,
} from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { AvatarSpec, toAvatarSpec } from './content/avatars';
import { auth, db, firebaseReady } from './firebase';

export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const LEVELS: { id: Level; name: string; about: string }[] = [
  { id: 'A1', name: 'Beginner', about: 'You can use simple words and phrases about yourself.' },
  { id: 'A2', name: 'Elementary', about: 'You can talk about familiar topics in short sentences.' },
  { id: 'B1', name: 'Intermediate', about: 'You communicate well in familiar situations. Let’s build more spontaneous explanations.' },
  { id: 'B2', name: 'Upper Intermediate', about: 'You can explain and defend your ideas with some detail.' },
  { id: 'C1', name: 'Advanced', about: 'You speak fluently and adapt your English to the situation.' },
  { id: 'C2', name: 'Proficient', about: 'You express yourself precisely, even on complex topics.' },
];
export const levelName = (l: Level) => LEVELS.find((x) => x.id === l)?.name ?? '';

export type Profile = {
  name: string;
  avatar: AvatarSpec;
  university?: string;
  year?: string;
  major: string;
  level: Level;
  levelSource: 'manual' | 'test';
  goals: string[];
};

export type Attempt = {
  sessionId?: string;
  report?: PracticeReport;
  episodeId: string;
  role: string;
  stars: number;
  hints: number;
  words: number;
  turns: number;
  speakingMs: number;
  finishedAt: number;
};

// The phone keeps a copy of everything so the app works offline and opens instantly.
// When the learner has a Firebase user, every change is also written to Firestore:
//   users/{uid}                 { profile, updatedAt }
//   users/{uid}/attempts/{id}   Attempt
const PROFILE = 'speakia.profile';
const ATTEMPTS = 'speakia.attempts';
const GUEST = 'speakia.guest';

const user = () => auth?.currentUser ?? null;
const userDoc = (uid: string) => doc(db!, 'users', uid);

/** Firestore writes never block the app: if the network or the database is unavailable, the phone copy stays the source. */
const cloud = (work: (uid: string) => Promise<unknown>) => {
  const u = user();
  if (!u || !db) return;
  work(u.uid).catch((e) => console.warn('[speakia] cloud sync skipped:', e?.code ?? e?.message ?? e));
};

// Profiles saved by the first draft used three named levels.
const OLD_LEVELS: Record<string, Level> = { Beginner: 'A2', Intermediate: 'B1', Advanced: 'C1' };

function normalise(p: Partial<Profile> & { goal?: string }): Profile {
  return {
    name: p.name ?? 'Student',
    // older profiles saved a fixed avatar or a story character; both become editable choices
    avatar: toAvatarSpec(p.avatar),
    university: p.university,
    year: p.year,
    major: p.major ?? 'Computer Science / IT',
    level: OLD_LEVELS[p.level as string] ?? (p.level as Level) ?? 'B1',
    levelSource: p.levelSource ?? 'manual',
    goals: p.goals ?? (p.goal ? [p.goal] : []),
  };
}

// Firestore rejects undefined values.
const clean = <T extends object>(o: T) => JSON.parse(JSON.stringify(o)) as T;

export async function getProfile(): Promise<Profile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE);
    return raw ? normalise(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export async function saveProfile(p: Profile) {
  await AsyncStorage.setItem(PROFILE, JSON.stringify(p));
  cloud((uid) => setDoc(userDoc(uid), { profile: clean(p), updatedAt: serverTimestamp() }, { merge: true }));
}

export async function updateProfile(patch: Partial<Profile>) {
  const p = await getProfile();
  if (p) await saveProfile({ ...p, ...patch });
}

export async function getAttempts(): Promise<Attempt[]> {
  try {
    const raw = await AsyncStorage.getItem(ATTEMPTS);
    return raw ? (JSON.parse(raw) as Attempt[]) : [];
  } catch {
    return [];
  }
}

export async function addAttempt(a: Attempt) {
  const all = await getAttempts();
  const i = all.findIndex((old) => a.sessionId ? old.sessionId === a.sessionId : old.finishedAt === a.finishedAt);
  if (i >= 0) all[i] = a; else all.push(a);
  await AsyncStorage.setItem(ATTEMPTS, JSON.stringify(all));
  cloud((uid) => setDoc(doc(db!, 'users', uid, 'attempts', a.sessionId || String(a.finishedAt)), clean(a)));
}

/** Best stars per episode, for the map. */
export function bestStars(attempts: Attempt[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of attempts) {
    if (a.report && a.report.status !== 'completed') continue;
    out[a.episodeId] = Math.max(out[a.episodeId] ?? 0, a.stars);
  }
  return out;
}

// ---------- sync ----------

/** Replace the phone copy with what is saved in the learner's account. */
async function pullFromCloud(uid: string): Promise<Profile | null> {
  const [snap, attempts] = await Promise.all([getDoc(userDoc(uid)), getDocs(collection(db!, 'users', uid, 'attempts'))]);
  const profile = snap.exists() && snap.data().profile ? normalise(snap.data().profile) : null;
  const list = attempts.docs.map((d) => d.data() as Attempt).sort((a, b) => a.finishedAt - b.finishedAt);
  await AsyncStorage.multiRemove([PROFILE, ATTEMPTS]);
  if (profile) await AsyncStorage.setItem(PROFILE, JSON.stringify(profile));
  if (list.length) await AsyncStorage.setItem(ATTEMPTS, JSON.stringify(list));
  return profile;
}

/** Copy what is on the phone (e.g. progress made as a guest) into the account. */
async function pushToCloud(uid: string) {
  const [profile, attempts] = await Promise.all([getProfile(), getAttempts()]);
  const batch = writeBatch(db!);
  if (profile) batch.set(userDoc(uid), { profile: clean(profile), updatedAt: serverTimestamp() }, { merge: true });
  for (const a of attempts) batch.set(doc(db!, 'users', uid, 'attempts', a.sessionId || String(a.finishedAt)), clean(a));
  await batch.commit();
}

// ---------- accounts (Firebase Auth) ----------

export type AuthResult = 'ok' | 'exists' | 'invalid-email' | 'weak' | 'wrong' | 'network' | 'too-many' | 'unavailable';

const authError = (e: unknown): AuthResult => {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use') return 'exists';
  if (code === 'auth/invalid-email') return 'invalid-email';
  if (code === 'auth/weak-password') return 'weak';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'wrong';
  if (code === 'auth/network-request-failed') return 'network';
  if (code === 'auth/too-many-requests') return 'too-many';
  console.warn('[speakia] auth error:', code || e);
  return 'unavailable';
};

/** Wait until Firebase has restored the saved session (call before deciding where to route). */
export async function authReady() {
  if (auth) await auth.authStateReady();
}

/** Email of a signed-in account; null for guests (anonymous users) and when signed out. */
export function getAccountEmail(): string | null {
  const u = user();
  return u && !u.isAnonymous ? u.email : null;
}

/** Where the app should open: signed in or guest with a profile → map; otherwise the welcome screen. */
export async function startRoute(): Promise<'map' | 'onboarding' | 'welcome'> {
  await authReady();
  const [profile, guest] = await Promise.all([getProfile(), AsyncStorage.getItem(GUEST)]);
  console.log(`[speakia] started: ${whoIsSignedIn()}${guest === '1' ? ' (guest mode)' : ''}, profile ${profile ? 'yes' : 'no'}`);
  if (getAccountEmail()) return profile ? 'map' : 'onboarding';
  if (guest === '1') return profile ? 'map' : 'onboarding';
  return 'welcome';
}

/**
 * Create an account. A guest who already has an anonymous Firebase user is upgraded in place,
 * so the progress they made as a guest stays with them.
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (!auth || !firebaseReady) return 'unavailable';
  try {
    const u = user();
    if (u?.isAnonymous) await linkWithCredential(u, EmailAuthProvider.credential(email, password));
    else await createUserWithEmailAndPassword(auth, email, password);
    await AsyncStorage.removeItem(GUEST);
    cloud(pushToCloud);
    return 'ok';
  } catch (e) {
    return authError(e);
  }
}

/** Sign in and load this account's profile and progress onto the phone. Returns the profile, if any. */
export async function signIn(email: string, password: string): Promise<{ result: AuthResult; profile: Profile | null }> {
  if (!auth || !firebaseReady) return { result: 'unavailable', profile: null };
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await AsyncStorage.removeItem(GUEST);
    let profile: Profile | null = null;
    try {
      profile = await pullFromCloud(cred.user.uid);
    } catch (e) {
      console.warn('[speakia] could not load saved progress:', (e as { code?: string })?.code ?? e);
      profile = await getProfile();
    }
    return { result: 'ok', profile };
  } catch (e) {
    return { result: authError(e), profile: null };
  }
}

/** Always resolves the same way whether or not the account exists, so emails cannot be probed. */
export async function resetPassword(email: string): Promise<'sent' | 'network' | 'invalid-email'> {
  if (!auth) return 'network';
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (e) {
    const r = authError(e);
    if (r === 'network') return 'network';
    if (r === 'invalid-email') return 'invalid-email';
  }
  return 'sent';
}

/** Continue without an account. Uses an anonymous Firebase user when that sign-in method is enabled. */
export async function startGuest() {
  await AsyncStorage.setItem(GUEST, '1');
  if (auth && !user()) {
    signInAnonymously(auth).catch((e) =>
      console.warn('[speakia] guest has no sign-in, so voice and AI will not work. Enable Anonymous in Firebase Authentication:', e?.code ?? e)
    );
  }
}

/** Sign out and remove this account's data from the phone (it stays saved in the account). */
export async function signOut() {
  await clearPracticeLocal();
  if (auth) await fbSignOut(auth).catch(() => {});
  await AsyncStorage.multiRemove([PROFILE, ATTEMPTS, GUEST]);
}

/** Delete the learner's saved data everywhere, and their account. */
export async function deleteEverything(): Promise<'ok' | 'relogin'> {
  await clearPracticeLocal();
  const u = user();
  if (u && db) {
    try {
      const attempts = await getDocs(collection(db, 'users', u.uid, 'attempts'));
      const batch = writeBatch(db);
      attempts.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      await deleteDoc(userDoc(u.uid));
    } catch (e) {
      console.warn('[speakia] cloud delete failed:', (e as { code?: string })?.code ?? e);
    }
    try {
      await deleteUser(u);
    } catch (e) {
      if ((e as { code?: string })?.code === 'auth/requires-recent-login') return 'relogin';
    }
  }
  await AsyncStorage.multiRemove([PROFILE, ATTEMPTS, GUEST]);
  return 'ok';
}

/** Firebase ID token for the voice/AI server, or null when there is no user. */
export async function idToken(): Promise<string | null> {
  await authReady(); // after a reload, Firebase needs a moment to restore the saved sign-in
  return (await user()?.getIdToken()) ?? null;
}

/** Who is using the app right now, for routing and for clear messages. */
export function whoIsSignedIn(): 'account' | 'guest' | 'nobody' {
  const u = user();
  return !u ? 'nobody' : u.isAnonymous ? 'guest' : 'account';
}

/** Session tokens/drafts stay on this device, scoped to the current Firebase user. */
export async function practiceLocal<T>(key: string): Promise<T | null> {
  await authReady();
  const raw = await AsyncStorage.getItem(`speakia.practice.${user()?.uid || 'offline'}.${key}`);
  try { return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
export async function savePracticeLocal(key: string, value: unknown) {
  await authReady();
  const scoped = `speakia.practice.${user()?.uid || 'offline'}.${key}`;
  if (value === null) await AsyncStorage.removeItem(scoped);
  else await AsyncStorage.setItem(scoped, JSON.stringify(value));
}
async function clearPracticeLocal() {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('speakia.practice.'));
  if (keys.length) await AsyncStorage.multiRemove(keys);
}
