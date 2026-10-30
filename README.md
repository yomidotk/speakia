# Speakia

**Step into the story. Speak.** Speakia is a mobile app where Algerian university students practise spoken English by stepping into short campus stories. Each episode is a real situation (Orientation Day, office hours with a professor, making friends, a group project). The learner listens to the scene, chooses who to play, and then talks out loud with the characters, who answer in their own voices and react to what the learner actually said.

Built for **ThirdUni Cohort 1** (October 2026).

- **Web demo:** https://fulldready.tech/speakia/ shows a phone with Speakia on its home screen, on a computer or a phone browser: tap the icon and the real app opens inside it. The bare app is at https://fulldready.tech/speakia/app/.
- **Android:** an APK built with EAS (see [Build the Android app](#build-the-android-app-apk))

**The problem:** students study English for years but rarely speak it, so their first real conversation often happens when it matters most: an internship interview, a team meeting, a presentation. Algerian universities are now moving teaching to English, and almost nothing trains the speaking part. Speakia is a place to rehearse those conversations first.

## What the app does

- **Accounts:** sign up or sign in with email and password or with Google, or continue as a guest. Progress is kept on the phone and synced to the learner's account (Firebase), so it follows them to any device. A guest who creates an account later keeps their progress.
- **Onboarding:** build an avatar (skin, hair or hijab, glasses…), add a profile, choose a major (Computer Science for Season 1), then pick a level (A1–C2) or take the placement test: the English teacher's 20-question B1 quiz plus 4 spoken answers that an AI rates against CEFR speaking criteria.
- **Season 1 map (Campus Life):** six episodes on a road from the bottom of the screen up; each one unlocks when the previous one is finished, and finishing one earns up to three stars.
- **Episodes 1–4** are playable, written by the team's English teacher at B1 level (5 *Deadline Trouble* and 6 *Presentation Day* are on the map but not written yet):
  1. **Orientation Day** with Sara, the student volunteer
  2. **Meeting the Professor** with Prof. Benali
  3. **Making Friends** with Rayan and Lina
  4. **The Group Project** with Rayan and Lina
- **How an episode works:**
  1. **Listen:** the characters play the teacher's scene, with Yacine (a new student) giving the example answers. Subtitles and playback speed.
  2. **Choose a role:** play Yacine (the characters talk to you), or in the one-to-one scenes play the host (Sara or the professor) while the AI plays Yacine.
  3. **Talk:** record your answer (or type it), check the transcript, and send. The character reacts to what you said, then the scene continues with the teacher's next line. The scene follows the teacher's script but stays flexible: different details, small talk and questions are answered naturally; a half answer gets one follow-up question; an off-topic message is gently brought back to the scene. Grammar mistakes never block the learner; they are collected for the feedback. Hints come in three steps: idea, sentence starter, example.
  4. **Results:** completion, independence stars (fewer hints, more stars), time, spoken and typed answers, corrections ("say it better") and short feedback in plain language.
- **Seasons tab:** Season 1 *Campus Life* is open. Season 2 *Internship Hunt* (career fair, phone call, interview, first week) and Season 3 *Going Global* (exchange interview, conference, networking) are shown locked: they unlock after Campus Life and aren't written yet.
- **Progress tab:** episodes finished, minutes recorded, practice indicators (words per turn, independence from hints, recording time), a checklist of communication skills (talking about yourself, polite questions, keeping a conversation going…), a recommended next practice, and the history of episodes with their stars.
- **Me tab:** profile and avatar, major, goals, level, retake the speaking test, voice settings, privacy, log out, delete account.

## What's next

These are plans, not features of the app yet:

- **Bring your own interview:** paste a real internship or job offer (Sonatrach, Djezzy, a startup…) and Speakia builds a mock interview for that exact role.
- **Live call mode:** a hands-free conversation with no record button, like a real phone interview.
- **Algerian-style mistakes:** feedback on the habits French and Darija leave in English ("I have 22 years" → "I'm 22", "make a meeting" → "have a meeting").
- **Confidence score:** count "uhh", "umm" and long pauses from the recording timings and show them going down over sessions.
- **Teacher dashboard:** a class code, who practised, and the class's most common mistakes. Free for students, paid by universities.
- Episodes 5–6 and Seasons 2–3.

## How it works

```
Phone app (Expo / React Native)  ──►  Cloudflare Worker (server/)  ──►  AI and voice services
  screens, recording, playback          checks the Firebase login,         · DigitalOcean (gpt-oss-120b): the conversation
  progress on the phone                 keeps every API key secret,        · Groq: speech-to-text (Whisper), backup chat
        │                               follows the episode script,        · ElevenLabs (Flash): character voices
        ▼                               stores voiced lines                · Fish Audio: backup voices
  Firebase (Auth + Firestore)
  accounts and synced progress
```

- **No API key is in the app.** Every AI or voice request goes through the server, which only answers learners signed in with Firebase.
- **The script lives on the server**, so a client can't skip steps or change the story. Each step has the teacher's expected answers as examples; the AI judges whether an answer does the step, and writes only a short reaction.
- **Voices are made once:** every voiced line is stored (Cloudflare KV on the server, and on the phone), so a scripted line costs one generation for all learners.
- **Backups everywhere:** if DigitalOcean fails, Groq answers; if ElevenLabs fails, Fish Audio speaks; if no voice is ready in time, the phone's own text-to-speech reads the line.

## Run it locally

Requirements: **Node.js 20 or newer**, and the **Expo Go** app on an Android phone or iPhone (same Wi-Fi as the computer).

```bash
git clone https://github.com/yomidotk/speakia.git
cd speakia
npm install
cp .env.example .env
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iPhone). Press `w` to open it in a browser.

**Fill in `.env`** (never commit it). Every value is public by design (it ends up in the app) but specific to our project:

| Variable | Where it comes from |
|---|---|
| `EXPO_PUBLIC_API_URL` | the server's address, e.g. `https://speakia-api.<you>.workers.dev` |
| `EXPO_PUBLIC_FIREBASE_*` (6 values) | Firebase → Project settings → Your apps → Web app |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Firebase → Authentication → Google → Web SDK configuration |

With `EXPO_PUBLIC_API_URL` empty, the app runs in **demo mode**: you can browse everything and read the scripts, but there is no AI or voice.

Google sign-in on a phone needs a built app (APK or development build); it isn't available inside Expo Go.

### Firebase setup (accounts and progress)

In the [Firebase console](https://console.firebase.google.com):

- **Authentication → Sign-in method:** enable **Email/Password**, **Anonymous** (guests) and **Google**.
- **Authentication → Settings → Authorized domains:** add the web demo's domain (`fulldready.tech`).
- **Project settings → Your apps → Add app → Android:** package `com.speakia.app` with the SHA-1 of the EAS signing key (`npx eas-cli credentials -p android`). Needed for Google sign-in on Android.
- **Firestore Database:** create it, then paste `firestore.rules` under **Rules** and **Publish**. Each learner can only read and write their own data.

### The server (AI and voices)

The server is a Cloudflare Worker in `server/`.

```bash
cd server
npm install
npx wrangler login
npx wrangler secret put GROQ_API_KEY          # console.groq.com (speech-to-text, backup chat)
npx wrangler secret put DO_MODEL_ACCESS_KEY   # DigitalOcean → Serverless Inference → Model Access Keys
npx wrangler secret put ELEVENLABS_API_KEY    # elevenlabs.io → API Keys
npx wrangler secret put FISH_API_KEY          # fish.audio → API keys (backup voices)
npx wrangler deploy                           # prints https://speakia-api.<you>.workers.dev
```

- Secrets are stored by Cloudflare, never in the code. For a local server, put the same keys in `server/.dev.vars` (ignored by git) and run `npx wrangler dev`.
- Character voices are chosen in `server/wrangler.toml` (`ELEVEN_VOICE_*` and `FISH_VOICE_*`); voice IDs are not secret. A character without an ElevenLabs voice uses Fish Audio.
- Only `GROQ_API_KEY` is required. Without DigitalOcean the conversation uses Groq's free plan (about 4 answers a minute for the whole app); without ElevenLabs or Fish, lines are read by the phone's built-in voice.
- When deploying your own copy, create the voice store with `npx wrangler kv namespace create AUDIO` and put its id in `server/wrangler.toml`.

### Checks

```bash
npm run typecheck              # the app
cd server
npm test                       # 36 tests: script steps, both roles, off-topic and goodbye handling, voices, providers…
npm run typecheck
npm run try                    # plays the scenarios with tricky answers against the real AI and flags problems
```

`npm run try` needs a key in the terminal (for example `$env:DO_MODEL_ACCESS_KEY="…"` in PowerShell) and uses a little of the AI quota.

## Build the Android app (APK)

```bash
npm install -g eas-cli
eas build -p android --profile preview
```

EAS builds in the cloud and gives a download link and a QR code. The build reads `.env` from your computer.

## Publish the web demo

```bash
bash scripts/deploy-web.sh
```

Builds the web version of the app, adds the phone mock-up page from `showcase/`, and publishes both to the `gh-pages` branch (GitHub Pages). The `main` branch is not touched.

## Project structure

```
app/                        screens (Expo Router: one file = one screen)
  index.tsx                 welcome
  signin.tsx, signup.tsx    accounts (email, Google, guest)
  onboarding/               avatar → profile → major → level → quiz → speaking test → result
  (tabs)/                   map, seasons, progress, me
  episode/[id]/             intro → watch (listen) → role → speak → result
src/
  content/episodes.ts       Season 1: the teacher's scenarios, expected answers, hints, facts
  content/cast.ts           the characters (look, personality, phone voice)
  content/avatars.ts        the learner's avatar builder
  content/b1Quiz.ts         the teacher's B1 placement quiz
  practice-api.ts           practice sessions with the server (and demo mode)
  practice-core.ts          shared rules: corrections, goodbyes, hints, results
  voice.ts                  character voices: download once, play, phone-voice fallback
  storage.ts                profile, progress, Firebase sign-in and sync
  placement.ts              placement level (quiz + speaking)
  components/               Character (animated SVG), Place (illustrated places), map icons, UI kit
server/
  src/index.ts              routes: speech-to-text, voices, placement assessment
  src/practice.ts           episode sessions: follows the script, asks the AI, builds results
  src/chat.ts               AI providers in order (DigitalOcean, then Groq)
  test/                     automated tests
  scripts/try-scenarios.ts  real-AI check of the scenarios
showcase/                   the web demo page (phone mock-up)
firestore.rules             who can read and write what in Firestore
```

**Adding an episode:** add it to `EPISODES` in `src/content/episodes.ts` with a `guide` (lines, what each answer must do, hints, facts) and `playable: true`, plus its listening-scene answers and expected answers in the same file. Then deploy the server, which reads the same file.

## Known limitations

- Episodes 5 and 6 aren't written yet.
- Pronunciation isn't scored: the AI reads a transcript of what the learner said.
- Speech recognition of Darija is unreliable; French or Arabic words mixed into English work better.
- The voice and AI services are paid by credit (ElevenLabs, DigitalOcean) or rate-limited (Groq's free plan); fine for testing and the demo, not sized for many users.
- Google sign-in on a phone needs the APK, not Expo Go.

## Team

| Name | What they did |
|---|---|
| Chiraz Benbelkhir | Designed and built the mobile app and its backend, developed the AI conversations and character voices, and designed the characters and campus map. |
| Norhene Benabbou | Designed and wrote the learning content: CEFR-based, scenario-driven episodes with staged dialogues, expected responses and graded hints. |
| Yousra Chahinez Aidaoui | Came up with the idea for Speakia and built the first version of the practice sessions: the flow for each conversation turn and the end-of-episode feedback report. |
| Ania | Brainstormed early design ideas for the app's look. |

## Tech stack

TypeScript, JavaScript, Expo (React Native), Expo Router, React Native Web, react-native-svg, expo-audio, expo-speech, Firebase Authentication, Cloud Firestore, Google Sign-In, Cloudflare Workers, Cloudflare KV, jose (JWT), DigitalOcean Serverless Inference (gpt-oss-120b), Groq (Whisper large-v3 turbo speech-to-text, gpt-oss), ElevenLabs (Flash v2.5 voices), Fish Audio (backup voices), EAS Build, GitHub Pages, Node.js test runner, Claude Code.

## How we used AI

AI is both inside the product and in how we built it:

- **In the app:** gpt-oss-120b (DigitalOcean, Groq as backup) runs each conversation and writes the feedback; Whisper turns the learner's speech into text; ElevenLabs gives every character a voice; an AI rates the placement test's spoken answers against CEFR criteria.
- **Building it:** we used Claude Code (Anthropic) heavily to write and review most of the code, the server tests, this README, and to find and fix bugs from our test sessions. We decided what to build, wrote the scenarios with the teacher, tested every episode on real phones, and checked the AI's work before it shipped.
