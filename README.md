# Speakia

**Step into the story. Speak.** A mobile app where Algerian university students practise spoken English by stepping into a story with fixed characters (Prof. Benali, Prof. Haddad, Yacine, Sara), watching a short scene, choosing a role, and speaking with an AI partner who answers out loud.

Built for Thirduni Cohort 1 (October 2026).

## What works in this first draft

- Welcome → Sign up / Sign in with Firebase (email and password, real reset-password email) or continue as a guest; progress syncs to Firestore
- Onboarding: profile (avatar, name, university, year) → major (10 options) → level (A1–C2) or a 4-question speaking placement test → level result
- Season 1 map (road climbs from level 1 at the bottom to the finale), Seasons, Progress, Me (edit profile, major, goals, level, retake test, privacy, help, log out)
- Levels 1–4, the teacher's B1 scenarios, as guided conversations where the learner talks as themselves:
  1. **Orientation Day** with Sara · 2. **Meeting the Professor** with Prof. Benali · 3. **Making Friends** with Rayan and Lina · 4. **The Group Project** with Rayan and Lina
  - Intro: place and characters, then straight into the conversation
  - Speak: characters say the teacher's lines in their own voices; after each answer the AI writes a short reaction to what you actually said, then the next line follows. You only move on when your answer does what the step asks (for example "give a reason"). Hint ladder (idea → starter → example), review the transcript before sending, "type instead", 45 s recording cap
  - Result: completion, independence stars (how few hints you needed), time, corrections and plain-language feedback
- **Demo mode**: with no server configured, the partner uses scripted replies and you type your answers

Not done yet: levels 5 and 6; Google sign-in; notifications; photo upload; "say it better" re-recording.

## Run the app

Requires Node.js LTS and the **Expo Go** app on your phone.

```bash
npx create-expo-app@latest speakia --template blank-typescript
cd speakia
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar react-native-svg expo-audio expo-speech @react-native-async-storage/async-storage expo-font @expo-google-fonts/bricolage-grotesque @expo-google-fonts/plus-jakarta-sans
```

Then:

1. Delete `App.tsx` and `index.ts`.
2. Copy the `app/` and `src/` folders from this repo into the project.
3. In `package.json` set `"main": "expo-router/entry"`.
4. In `app.json`, inside `"expo"`, add:
   ```json
   "scheme": "speakia",
   "plugins": [
     "expo-router",
     ["expo-audio", { "microphonePermission": "Speakia uses the microphone so you can speak in the story." }]
   ]
   ```
5. `npx expo start`, then scan the QR code with Expo Go (Android) or the Camera app (iPhone).

## Accounts and saved progress (Firebase, free)

Accounts use Firebase Authentication; each learner's profile and finished episodes are saved in Firestore under `users/{uid}` (and kept on the phone too, so the app opens instantly and works offline).

1. In the [Firebase console](https://console.firebase.google.com), project `speakia-e70e7`:
   - **Project settings → Your apps → Web app (`</>`)**: copy the config values into `.env` (see `.env.example`).
   - **Authentication → Sign-in method**: enable **Email/Password** and **Anonymous** (Anonymous lets guests use voice and keep their progress when they create an account later).
   - **Firestore Database → Create database** (production mode), then **Rules**: paste `firestore.rules` and **Publish**.
2. Restart `npx expo start`.

The Firebase config is not a secret; Firebase Auth plus `firestore.rules` is what protects each learner's data.

## Turn on voice and AI (free)

The server is a Cloudflare Worker in `server/`. It keeps the AI keys secret and uses Groq (free plan) for speech-to-text (Whisper) and the character replies (GPT-OSS 120B), and Fish Audio (`s2.1-pro-free`) for the characters' voices. It only answers requests that carry a valid Firebase ID token for `speakia-e70e7`, so no key lives in the app. Voiced lines are stored in Cloudflare KV, so a line every learner hears costs one Fish Audio call. Before deploying your own copy, create the KV store with `npx wrangler kv namespace create AUDIO` and put its id in `server/wrangler.toml`.

1. Pick a voice for each character on [fish.audio](https://fish.audio) (Discover), copy its ID, and paste it into `server/wrangler.toml` (`FISH_VOICE_SARA`, `FISH_VOICE_YACINE`, `FISH_VOICE_BENALI`, `FISH_VOICE_HADDAD`). Voice IDs are not secret.
2. Deploy:

```bash
cd server
npm install
npx wrangler login
npx wrangler secret put GROQ_API_KEY   # from console.groq.com
npx wrangler secret put FISH_API_KEY   # from fish.audio > API keys
npx wrangler deploy                    # prints https://speakia-api.<you>.workers.dev
```

If Fish Audio is not set up or a line fails, the app reads it with the phone's built-in voice instead.

In the app's `.env` (never commit it), set:

```
EXPO_PUBLIC_API_URL=https://speakia-api.<you>.workers.dev
```

Restart `npx expo start`. The Me tab shows "Connected" instead of "Demo mode".

## Project structure

```
app/                     screens (Expo Router: one file = one screen)
  index.tsx              Welcome
  signin.tsx, signup.tsx Accounts (stored on the phone for now)
  onboarding/            profile → major → level → test → result
  (tabs)/                Map, Seasons, Progress, Me
  episode/[id]/          intro → watch → role → speak → result
src/
  content/cast.ts        the four characters (colours, voices, personality)
  content/episodes.ts    Season 1 levels, scenes, roles, hints
  components/            Character (animated SVG), Place (six illustrated places), Icon, kit (inputs, tiles, sheets), buttons…
  placement.ts           speaking-test level estimate (a practice estimate, not CEFR certification)
  draft.ts               onboarding answers held in memory until finished
  api.ts                 calls to the server + demo mode
  voice.ts               character voices (phone text-to-speech)
  storage.ts             profile and attempts saved on the phone
server/                  Cloudflare Worker: /transcribe and /turn
```

Adding a level = add an episode object in `src/content/episodes.ts` and set `playable: true`.

## Known limitations

- Without the server, character voices use the phone's built-in text-to-speech, so they sound different on each phone.
- The Fish Audio free tier has usage limits; cached lines do not count again.
- Speech recognition of Darija is unreliable; French words mixed into English work better.
- Progress is stored only on the phone.
- The free AI plan has rate limits: fine for testing and judging, not for many users.

## Team

| Name | What they built |
|---|---|
| [Name] | [e.g. App screens, voice recording, AI server] |
| [Name] | [e.g. Character and place illustrations] |
| [Name] | [e.g. Level scripts and hints] |
| [Name] | [e.g. User interviews, testing, demo video] |

## Tech stack

TypeScript, Expo (React Native), Expo Router, react-native-svg, expo-audio, expo-speech, AsyncStorage, Cloudflare Workers, Groq (Whisper + GPT-OSS), Fish Audio, Firebase (Auth + Firestore). AI coding assistants were used to write much of the code.
