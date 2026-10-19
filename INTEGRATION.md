# Speakia practice integration

Based on yomidotk/speakia main at `a71e5d02d3e2ed1c792301e1969b93191a67b55e`.
Local review branch: `feat/practice-feedback-integration`.

## What changes

- Keeps Cloudflare Workers, Firebase sign-in/guest authentication, Groq chat and Whisper,
  Fish Audio character voices, existing cache and placement evaluation.
- Orientation Day now has a listening scene and two selectable roles: new student Yacine
  and orientation helper Sara. Example student details are fictional; the teacher's campus
  facts and question order remain in `src/content/episodes.ts`.
- The server selects the episode/role configuration; clients cannot supply a different script.
  Each objective advances at most once per accepted turn, with an exact quote as evidence.
  Semantic completion is judged by the LLM, so live dialogue testing is still necessary.
  A clarification does not advance automatically. The helper role answers as the student.
- A standalone goodbye redirects at most once. A second consecutive goodbye, repeated
  “bye bye” in one message, or an explicit stop ends early even with unanswered objectives.
- Grammar/vocabulary findings quote the accepted learner text. Cosmetic punctuation,
  capitalization and spacing changes are filtered out. ASR spelling advice is excluded by
  the prompt; ambiguous transcription should be fixed by the learner before submission.
- Recorded answers are transcribed, reviewed/edited, then sent. Feedback appears after
  acceptance. This version does **not** stream a live transcript or assess pronunciation.
- Hints are role/objective specific: idea, starter, example. Each tier counts once per turn.
  The idle prompt appears after 8 seconds and offers help after 13; recording, typing,
  playback, open hints, processing and explicit pauses stop the idle prompt.
- Total and active session timers remain visible. Active time excludes explicit pauses;
  backgrounding pauses when the platform reports it. Saved sessions resume paused.
- Results store actual accepted turns, spoken/typed counts, words, recording duration,
  hint events, corrections, repeated patterns, covered objectives and AI notes. Recording
  duration includes silence and is not labelled speaking-only time. Early exits save a
  partial report and do not unlock completion stars. History opens the saved dashboard.
- Network/provider failures keep the accepted state and pending answer. Retrying the same
  payload reuses its request ID. AI summary failure leaves measured results available and
  can be retried separately. One chat call combines reaction, completion judgement and
  correction; one optional report call generates notes. Voice and transcription calls are
  still separate, and free quotas can still run out.

## Windows CMD: install and review

Use a **new folder** so the original project and its `.env` remain available. Either extract
`speakia-integrated-source.zip`, or apply the patch to a clean clone:

```cmd
cd /d C:\Users\Chahinez\Downloads
git clone https://github.com/yomidotk/speakia.git speakia-integrated
cd speakia-integrated
git switch -c feat/practice-feedback-integration
git apply "C:\Users\Chahinez\Downloads\speakia-integration.patch"
npm ci
cd server
npm ci
cd ..
npm run typecheck
npm --prefix server run typecheck
npm test
```

The patch is based on the commit above. If upstream changed, resolve conflicts before running.
The root lockfile is unchanged; server lockfile adds the `tsx` test runner only.

Copy the existing **Expo app's** `.env` into this new project root, or copy `.env.example`
to `.env` and fill its Firebase public configuration and `EXPO_PUBLIC_API_URL` with Chiraz's
values. The previous Python prototype's Gemini environment variables are not used here.
Never put Groq or Fish secret keys in `EXPO_PUBLIC_*` variables.

To preview the screens without credentials:

```cmd
npm run web
```

Without an API URL this is an explicitly labelled script preview; it cannot assess answers
or mark goals complete. With an API URL, Firebase login (including anonymous guests) is required.

## Backend owner: deploy matching API and Firestore rules

The new app requires the updated Worker and updated rules. Existing Groq/Fish secrets,
Firebase project and Fish voice IDs can stay as configured in Chiraz's Cloudflare account.
If using another account, create your own AUDIO KV namespace and replace its ID in
`server/wrangler.toml`; do not deploy against another person's namespace.

From the project folder:

```cmd
cd server
npx wrangler login
npx wrangler deploy --dry-run
```

After review, the owner can deploy with `npx wrangler deploy`. In Firebase Console →
Firestore Database → Rules, publish the included `firestore.rules` (it keeps owner-only
access and permits the new `sessionId`/`report` fields). Deploy the Worker/rules before
rebuilding or releasing the app. Then, from the root, run `npm run web` or `npx expo start`.
Restart Expo when changing `.env`.

No new provider account is needed. An optional dedicated signing secret is supported:
`npx wrangler secret put PRACTICE_SIGNING_KEY`. If absent, the server derives a separate
signing key from its existing Groq secret using HKDF. Rotating the signing seed expires
existing sessions. Tokens expire after 24 hours; an expired session must be ended and a
new one started. Local measured results can still be saved without successful AI notes.

## API contract

All routes require `Authorization: Bearer <Firebase ID token>` and JSON:

| Route | Request | Result |
| --- | --- | --- |
| `POST /practice/start` | `requestId`, `episodeId`, `roleIndex`, optional `learnerName` | Signed `stateToken`, accepted `snapshot`, reply/audio parts, next hints, stage |
| `POST /practice/turn` | `requestId`, `stateToken`, `text`, `source` (`typed`/`speech`), `recordingMs`, `edited`, `level`, `major` | Updated signed state after successful acceptance only |
| `POST /practice/report` | `requestId`, `stateToken`, `measurements: {totalMs, pausedMs, hintReveals:[{turnIndex,tier}]}` | Measured report plus optional AI notes and final signed state |

`source`, recording durations and timer/hint events are client measurements, not trusted
exam telemetry. Signed tokens protect accepted dialogue and objective state, are bound to
Firebase UID, and stay on the device; only report data syncs to Firestore. Old `/turn`,
`/assess`, `/transcribe` and `/speak` routes remain available for older clients. Old `/turn`
clients do not acquire the new session/order logic until updated.

Request replay results are cached in the Worker isolate and optional existing AUDIO KV
for 24 hours. Identical retries in an isolate share a running provider call; conflicting
payloads with the same request ID are rejected. KV is eventually consistent, so this is
best-effort across regions/restarts, **not** globally exactly-once execution. Use a Durable
Object if strict cross-device/concurrent serialization is later required. Current app
controls prevent overlapping sends in a screen. The server also caps answer length,
recording duration and accepted turns.

## Verification and live checklist

Automated tests mock provider responses and exercise order/evidence, both roles, exits,
cosmetic correction filtering, retries/concurrency, token tampering/account isolation,
actual timing/counts, hint deduplication and report quota fallback. They do not prove
LLM semantic accuracy, voice playback, Firebase rules deployment or provider availability.

```cmd
npm test
npm run typecheck
npm --prefix server run typecheck
npx expo export --platform web
cd server
npx wrangler deploy --dry-run
```

With the owner's configured services, test both roles and check:

1. Listen, select a role, record, review the transcript, then submit. Corrections should
   concern expressions rather than punctuation; failed requests must retain the answer.
2. Give an off-topic answer, ask a practical follow-up, then answer the current question.
   Verify the stage does not jump ahead and the helper/student roles stay correct.
3. Say “bye”, then “bye” again; also try “bye bye bye” and “please stop”. The dashboard
   should save an early exit. “What does goodbye mean?” must stay in the conversation.
4. Open Example twice; one reveal should be counted. Pause/resume, then finish. Check
   total time, active time and accepted recording duration separately.
5. Exhaust/mock report quota: measured results should remain, and Retry AI notes should
   update the same history entry. Complete all objectives to test normal completion.
6. Test microphone permissions and audio on the actual target phone/browser. No Azure
   pronunciation assessment or live partial transcription has been added.

No production deployment, Firebase rule publication or live key-based AI test is included
in this local handoff.
