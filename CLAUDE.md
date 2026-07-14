# OrCurriculum — Contributor & Agent Context

Short, focused context for anyone (human or AI) picking up this project. Read this first, then dive into the code.

## What this is

A cute pastel-pink **PWA** for tracking weekly and daily study goals per course. You add courses (e.g. "Anatomy"), attach goals to them (e.g. "40 questions per week", "10 hours per week"), and log progress in small increments through the day. Goals come in two kinds — **count** (arbitrary free-text metric) and **time** (minutes stored / hours displayed). Time-based goals can be logged via a countdown-timer study session with a chime alarm, a manual entry, or a scheduled day-plan block (which can optionally push itself to Google Calendar). Each goal shows an animated ring of progress; period rollovers auto-archive to a history collection.

Live: <https://orcurriculum.web.app>

## Stack at a glance

| Concern       | Choice                                                          |
| ------------- | --------------------------------------------------------------- |
| Framework     | React 18 + Vite + TypeScript (strict)                           |
| Styling       | Tailwind CSS (custom pink palette in `tailwind.config.js`)      |
| Animation     | Framer Motion                                                   |
| PWA           | `vite-plugin-pwa` (`registerType: 'autoUpdate'`)                |
| Auth          | Firebase Auth — Google popup + client-side email allowlist      |
| Data          | Firebase Firestore                                              |
| Hosting       | Firebase Hosting (Spark / free plan)                            |
| Firebase project ID | `orcurriculum`                                            |

The design system: soft pastel-pink, rounded-4xl cards, `Quicksand` display + `Nunito` body, ring progress with a gradient stroke. Palette tokens live in `tailwind.config.js` (`blush`, `petal`, `rose`, `berry`, `deepRose`, `mauve`, `cream`) and reusable component classes in `src/index.css` (`card`, `btn-primary`, `btn-soft`, `btn-ghost`, `input`, `chip`).

## Repo layout

```
src/
  App.tsx                    # auth gate + hash-route dispatch (Dashboard | CoursePage); mounts UpdatePrompt
  main.tsx
  firebase.ts                # initializeApp, GoogleAuthProvider, ALLOWED_EMAILS, isAllowed()
  types.ts                   # Course, Goal, Entry, HistoryRecord, PeriodKind,
                             # Task, TaskType, QuestionStatus, QUESTION_STATUS_META, QUESTION_STATUS_ORDER
  vite-env.d.ts              # types for vite/client and vite-plugin-pwa/react (needed for useRegisterSW)
  index.css                  # Tailwind layers + component classes
  lib/
    periods.ts               # startOfDay/Week, periodKey (YYYY-MM-DD | YYYY-Wnn), formatters
    archive.ts               # archivePastPeriods() — rolls stale entries into `history`
  hooks/
    useAuth.ts               # onAuthStateChanged wrapper
    useCourses.ts            # live Firestore listener + CRUD
    useGoals.ts
    useEntries.ts
    useHistory.ts            # read-only listener on archived periods
    useSessions.ts           # all sessions listener + discardSession/discardEntry (used by HistoryView)
    useTasks.ts              # regular + practice-test CRUD, updateQuestionStatus, resetPracticeTest
    useRoute.ts              # tiny hashchange router — returns Route ({view:'dashboard'} | {view:'course', courseId})
  components/
    AuthScreen.tsx           # Google sign-in + "not on allowlist" message
    Dashboard.tsx            # header, grid of CourseCards, floating "+ Course", history dialog
    CoursePage.tsx           # per-course detail page: themed header, goals, TaskList, per-course history
    CourseCard.tsx           # clickable dashboard card: ring progress per goal + inline +Log
    CourseFormDialog.tsx     # create / edit / delete a course
    GoalFormDialog.tsx       # create / edit / delete a goal (metric + target + weekly|daily)
    QuickAddSheet.tsx        # +1 / +2 / +5 / +10 quick-add or custom amount
    TaskList.tsx             # dispatches TaskRow vs PracticeTestRow; hosts add-task input + "+ Practice test"
    PracticeTestDialog.tsx   # create-test modal: title + question-count stepper (defaults to last test's count)
    PracticeTestRow.tsx      # expandable practice-test row: donut, badges, question grid + status picker
    HistoryView.tsx          # dialog listing every study session + manual time log with per-row Discard
    RingProgress.tsx         # SVG ring with gradient + spring animation
    UpdatePrompt.tsx         # "🌸 New version ready" toast; polls SW every 60s via useRegisterSW
    ui/Dialog.tsx            # base modal with animated backdrop, ESC-to-close
    ui/ConfirmDialog.tsx     # reusable confirm-then-close dialog (Discard, Sign-out)

firestore.rules              # public — restricts all docs to owning user
firebase.json                # hosting config + rewrites + cache headers
vite.config.ts               # PWA manifest & workbox config
public/                      # PWA icons (192, 512, apple-touch), favicon.svg
```

## Data model (Firestore)

Everything is scoped under `users/{uid}`. The security rules in `firestore.rules` restrict every read/write to `request.auth.uid == uid`, so **the client-side allowlist is a UX filter, not the actual data guard** — Firestore rules are.

| Collection                       | Fields                                                                                   | Notes |
| -------------------------------- | ---------------------------------------------------------------------------------------- | ----- |
| `users/{uid}/courses/{id}`       | `name`, `emoji`, `color`, `createdAt`                                                    | User-managed. Colors from `COURSE_COLORS`, emojis from `COURSE_EMOJIS` in `types.ts`. |
| `users/{uid}/goals/{id}`         | `courseId`, `metric` (free text), `target` (int), `period: 'weekly'|'daily'`, `active`, `createdAt` | Multiple goals per course allowed. Deleting a goal doesn't cascade to entries — they still archive on next load. |
| `users/{uid}/entries/{id}`       | `courseId`, `goalId`, `metric`, `amount`, `at` (serverTimestamp), `periodKey`            | `periodKey` is set at write time from the goal's period. |
| `users/{uid}/tasks/{id}`         | `courseId`, `title`, `done`, `createdAt`, `completedAt`, plus optional `type: 'regular' \| 'practiceTest'`, `questionCount`, `questions: QuestionStatus[]` | Untimed to-dos, live under a course. Docs without a `type` field are treated as `regular` (backwards-compatible). Practice-test `done` is auto-derived — see below. |
| `users/{uid}/goals/{id}` (added `unit`) | `unit?: 'count' | 'minutes'` — absent = `'count'` (backwards compat). Time goals store `target` in whole minutes and set `metric = 'minutes'`. |
| `users/{uid}/sessions/{id}`      | `courseId`, `goalId` (nullable), `plannedMinutes`, `startedAt`, `endedAt`, `outcome: 'running'|'completed'|'canceled'`, `loggedMinutes`, `entryId`, `alarmedAt?` | Only one `outcome: 'running'` per user at a time — enforced in `useSession`, not in rules. Completing writes an `entries` doc and links it via `entryId`. `alarmedAt` is set when the end-of-session chime has fired — persisted so page reload / `SessionBanner` remount on an over-elapsed running session doesn't re-fire. |
| `users/{uid}/breaks/{id}`        | `plannedMinutes`, `startedAt`, `endedAt`, `outcome`, `alarmedAt?` | Top-level (no `courseId`). Same lifecycle as sessions, minus the entry write. `alarmedAt` is set when the end-of-break chime has fired — persisted so BreakFab unmount/remount (Dashboard ↔ CoursePage) doesn't re-fire the alarm. |
| `users/{uid}/plannedBlocks/{id}` | `courseId`, `title`, `startAt`, `endAt`, `notes?`, `calendarEventId?`, `createdAt` | The day-plan. `calendarEventId` present ⇔ mirrors a Google Calendar event we created; editing/deleting the block updates/deletes the calendar event too. |
| `users/{uid}/history/{id}`       | `courseId`, `goalId`, `metric`, `target`, `achieved`, `periodStart`, `periodEnd`, `period`, `periodKey` | Written by `archivePastPeriods()`. Time-goal history has `metric = 'minutes'` and integer-minute `achieved`/`target`. |

### Tasks and practice tests

Regular tasks are simple: a title with a `done` boolean toggled by the checkbox. They stay visible in a "Done" group after completion.

Practice tests are a task subtype (`type: 'practiceTest'`) with a fixed `questionCount` and a `questions: QuestionStatus[]` array (`'unanswered' | 'succeeded' | 'failed' | 'retry'`). The row is expandable to reveal a color-coded question grid; tapping a question opens a small status picker dialog. Question metadata (colors, labels, order) lives in `QUESTION_STATUS_META` and `QUESTION_STATUS_ORDER` in `types.ts`.

**Practice-test `done` is auto-derived**, never manually toggled:
```
done = questions.every(q => q === 'succeeded' || q === 'failed')
```
That means `retry` and `unanswered` both keep the test in the **Open** group — `retry` is an explicit "come back to this" signal, so it belongs where the user is looking for work to do. Reset via `resetPracticeTest` in `useTasks`.

When creating a new practice test on a course, `TaskList` defaults the question count to the most recent practice test's count on the same course (fallback: 20).

### Period keys

- **Daily**: `YYYY-MM-DD` (from local time, start-of-day).
- **Weekly**: `YYYY-Wnn` where `nn` is the index of the week starting **Sunday** (see `startOfWeek` in `lib/periods.ts`). If you ever want configurable week-start, that's the single place to change.

### Progress calculation

Single source of truth: `computeProgress(goal, entries)` in `src/lib/progress.ts`, used by both `CourseCard.tsx` and `CoursePage.tsx`.

- **Count goals**: sum of `amount` on entries where `goalId === g.id` and `periodKey === periodKey(g.period)`. Per-goal, per-metric.
- **Time goals** (`unit === 'minutes'`): sum of `amount` on entries where `courseId === g.courseId`, `metric === 'minutes'`, and `entry.at` falls within `[periodStart(g.period), periodEnd(g.period)]`. **Pooled across the course** — a session credits every active time goal in that course/period, and a time goal created mid-period picks up minutes already logged. `entry.periodKey` is ignored for time goals because a daily entry may need to count toward a weekly goal (and vice versa).

No counters, no race conditions, idempotent. UI formats minute amounts via `formatDuration()` in `src/lib/time.ts`.

**Archival caveat**: `archivePastPeriods` still groups by `goalId`, so history records for time goals only reflect entries tagged with that specific goal — historical pooling is not yet in sync with the live pooling above.

### Auto-archive on load

`Dashboard.tsx` calls `archivePastPeriods(uid, goals)` in an effect whenever `goals` change. For every active goal, it groups entries whose `periodKey` != the current key, writes one `history` doc per `(goalId, periodKey)` group summarising `achieved` vs `target`, and deletes those entries. The operation is idempotent — safe to run on every load, safe if two tabs run it at once (later run just finds nothing to archive).

## Auth & the email allowlist

Google popup sign-in via `signInWithPopup(auth, googleProvider)`. After sign-in the app checks `isAllowed(user.email)` before showing the dashboard. Non-allowlisted users see a friendly message and a sign-out button.

The allowlist comes from a **comma-separated `VITE_ALLOWED_EMAILS` env var**. It's read at build time by Vite and baked into the client bundle (which is public — assume anyone can read the list). Because it's client-side only, it's a UX filter; the real data guard is Firestore rules.

**To add or remove an allowed email:** edit `.env`, run `npm run build && firebase deploy --only hosting`. Do **not** commit `.env` (it's git-ignored).

If `VITE_ALLOWED_EMAILS` is empty/missing, `isAllowed` returns true for anyone (dev convenience). Never deploy with it empty.

## Firebase security rules (`firestore.rules`)

Committed to git — public and short:

```
match /users/{uid}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

Rules to remember:
- Every doc is namespaced under `users/{uid}/…`.
- Hooks always pass the current `uid` to Firestore paths.
- If you add a new top-level collection, add a rules block for it too or the app breaks silently in production.

Deploy rules with `firebase deploy --only firestore:rules`.

## Time tracking

Time-based goals reuse the same `entries` + `periodKey` model as count goals — no parallel data path. Storage-unit convention: **all time amounts are integer minutes** everywhere (goal `target`, entry `amount`, session `plannedMinutes` / `loggedMinutes`, break `plannedMinutes`, history `achieved` / `target`). The display layer converts to `Xh Ym` via `formatDuration()` in `src/lib/time.ts`. Do not introduce floats — aggregation drifts.

**Goal.unit**: `'count'` (default when absent) or `'minutes'`. `GoalFormDialog` shows a Kind toggle at the top; when `'minutes'` the metric input hides and the target field switches to decimal hours (`step="0.25"`). The value is converted to minutes on save.

**Sessions** (`useSession` + `SessionTimer`):
- Only one `outcome: 'running'` session per user at a time. The hook filters on `where('outcome', '==', 'running')` and treats the first result as the active session.
- Session state lives entirely in Firestore, so a browser refresh mid-session resumes cleanly — elapsed is computed as `now - startedAt`.
- On start: session doc created with `startedAt: serverTimestamp()`. Component asks for notification permission and primes the audio element.
- On end (timer reaches zero): `fireAlarm()` from `src/lib/alarm.ts` (browser Notification + audio chime + focus tab). A confirmation dialog opens; user confirms the minutes to log. Completion writes one `entries` doc and links its id back on the session.
- "End now & log" credits the actual elapsed minutes (rounded). Cancel writes no entry.
- The `useWakeLock` hook keeps the screen awake while a session runs; it re-acquires on `visibilitychange` because browsers drop the lock when the tab hides. Sites gate on `active && !active.alarmedAt` — once the end-of-session/break chime has fired, the wake lock releases even if the user hasn't Log'd or Discarded, so a stale running session/break can't pin the display on.

**Breaks** (`useBreak` + `BreakFab`): same lifecycle, no entry write. Break is top-level (not per course). The FAB lives on the dashboard bottom-left. While a break is running (`active && !alarmed`), the break popup is rendered as **non-dismissible** via `Dialog`'s `dismissible={false}` prop — X, ESC, and backdrop clicks are all disabled and the popup auto-opens on remount. Safety valves so the user is never stuck: `handleEnd` calls `stopAlarm()` up front and the End button is never `disabled`; a local `alarmedLocal` echo unlocks the popup the instant the timer expires, even if the Firestore `markAlarmed` write is slow or fails; and once alarmed, the popup becomes fully dismissible again.

**Manual time entry**: reuses `QuickAddSheet`. When `goal.unit === 'minutes'`, presets become `+15 / +30 / +60 / +90` and the custom input is minutes.

**Day plan** (`usePlannedBlocks` + `DayPlan` + `PlanView`): planned time blocks live in `plannedBlocks`. The `DayPlan` component is rendered from `PlanView.tsx` (top-level `#/plan` route) across all courses with a date navigator. It renders a Google-Calendar-style hour grid via the internal `CalendarGrid` sub-component: `9:00–21:00` by default, auto-extending in 2-hour steps to cover any block that falls outside. Overlapping blocks lay out side-by-side using a sweep column assignment; on today, a live `deepRose` "now" line is drawn and the grid auto-scrolls to ~1 h before now on first mount.

Each block is tappable (opens edit) and has a small "▶ Start" pill (bottom-right) that mounts `SessionTimer` with duration pre-filled from the block's length. Editing a block updates its calendar event too (if it was synced); deleting removes the calendar event.

**Overlap prompt**: when a new/edited block's time range overlaps any existing block in the current day + course-filter scope, `ConflictDialog` opens with Cancel / Merge / Replace. **Merge** deletes the conflicting blocks and creates one that spans `min(start) … max(end)` with the new block's course/title/notes. **Replace** deletes the conflicting blocks and keeps the new one exactly as entered. Calendar-synced conflicts get their Google Calendar events deleted too.

**Time dashboard** (`TimeDashboard`, `#/time`): 4 range chips (7d / 30d / 90d / all-time). Sums entries by `at` timestamp and includes archived `history` records (using each history record's period midpoint for date-bucketing) so all-time is complete. Daily average = total ÷ days in window.

**Alarm library** (`src/lib/alarm.ts`) exports:
- `requestNotificationPermission()` — safe to call multiple times
- `primeAudio()` — call on user gesture to unlock playback
- `fireAlarm({ title, body })` — plays `/chime.mp3` via the Web Audio API (`AudioBufferSourceNode`, not `HTMLAudioElement` — `pause()` was unreliable on iOS PWA) and shows a `Notification`. The chime re-fires when it ends until acknowledged, up to 60 s total (`REPEAT_WINDOW_MS`). `stopAlarm()` bumps a monotonic token that both cancels any pending replay and short-circuits any in-flight `fireAlarm` still awaiting the buffer
- `useWakeLock(active: boolean)` — keeps screen on

`public/chime.mp3` must be provided before shipping (see `public/CHIME.md`). If missing, the alarm still fires visually; only audio is silent. Workbox precaches `.mp3` (see `vite.config.ts` `globPatterns`).

## Google Calendar sync

One-way write only: the app creates / updates / deletes events on the user's primary Google Calendar to mirror their `plannedBlocks`. **We do not read events back.**

**Why not extend the Firebase Auth Google scope**: Firebase Auth returns the OAuth access token at sign-in, but it expires in ~1 hour and Firebase does not refresh it. So we keep `GoogleAuthProvider` bare (identity only) and mount **Google Identity Services** separately for the calendar scope, so a fresh token is available on demand.

**Flow** (`src/hooks/useCalendarSync.ts`):
1. Load the GIS script tag in `index.html` (`<script src="https://accounts.google.com/gsi/client" async defer>`).
2. Lazy-initialize a token client via `google.accounts.oauth2.initTokenClient({ client_id: VITE_GOOGLE_CLIENT_ID, scope: 'https://www.googleapis.com/auth/calendar.events' })` on first use.
3. `getAccessToken()` returns a cached token if fetched <55 min ago; otherwise silent-refresh via `requestAccessToken({ prompt: '' })`. Interactive `authorize()` uses `prompt: 'consent'` on first grant.
4. `createEvent(block)` → `POST calendar/v3/calendars/primary/events`; store returned `id` as `plannedBlock.calendarEventId`.
5. `updateEvent(block)` → `PATCH …/events/{id}` when a synced block is edited.
6. `deleteEvent(eventId)` → `DELETE …/events/{id}` when a synced block is deleted (or its "Add to Google Calendar" is unchecked).
7. On 401 → clear cached token and retry once. On 403 → mark `status = 'needs_auth'` and surface a warning in the block form.

**Color mapping** (`src/lib/calendarColors.ts`): Google Calendar has 11 fixed color IDs. Each `COURSE_COLORS` swatch is mapped to the visually-closest calendar color. Unmapped colors fall through to the calendar's default.

**Env var**: `VITE_GOOGLE_CLIENT_ID` — an OAuth 2.0 Web client ID from Google Cloud Console. If empty, the "Add to Google Calendar" toggle still appears but shows a "not configured" warning instead of firing. Everything else works without it.

**Background alarms (not in this feature)**: today's alarm only fires reliably while the tab is open. `docs/future-fcm-alarms.md` documents the FCM design for a follow-up PR.

## Routing

Hash-based, no router library. See `src/hooks/useRoute.ts`.

- `#/` (or empty hash) → Dashboard
- `#/course/{courseId}` → CoursePage for that course

Navigate with `openCourse(id)` / `openDashboard()` helpers exported from `useRoute.ts`. Browser back / forward works because `hashchange` is a real event. Hash routing was picked over history-mode because it doesn't need Firebase Hosting SPA rewrites for deep-linking to work — nice with the installed PWA.

## PWA behavior — deploys propagate fast

The stale-cache problem this project hit in its first weeks is gone. The current setup makes every deploy visible to open tabs within about a minute, with no manual hard-refresh needed. Three pieces work together:

1. **Firebase cache headers** (`firebase.json`)
   - `/`, `/index.html`, `/sw.js`, `/registerSW.js`, `/manifest.webmanifest` → `no-cache` (browser always revalidates the shell + SW).
   - `assets/*.@(js|css|svg|png|woff2)` and `workbox-*.js` → `max-age=31536000, immutable` (content-hashed filenames make this safe).
   - Firebase Hosting applies the **last** matching header rule, so the wildcard `immutable` block comes first and the specific `no-cache` overrides come after. Reordering breaks this.

2. **Workbox** (`vite.config.ts`)
   - `registerType: 'autoUpdate'`, `skipWaiting: true`, `clientsClaim: true`, `cleanupOutdatedCaches: true`. New SW installs, activates, and claims open pages without waiting for tabs to close.

3. **In-app prompt** (`src/components/UpdatePrompt.tsx`)
   - Uses `useRegisterSW` from `virtual:pwa-register/react` (types come from `src/vite-env.d.ts`).
   - Polls the SW every 60 s. When a waiting SW is detected, renders the cute pink "🌸 New version ready — Reload / Later" pill. `Reload` calls `updateServiceWorker(true)` which activates the new SW and refreshes.

If you touch any of the three, keep the trio consistent. Don't loosen the header rules; don't disable `skipWaiting`/`clientsClaim` without a reason; don't remove the poll from `UpdatePrompt.tsx` — it's what makes the toast feel timely.

Icons live in `public/` (192, 512, apple-touch). If you replace the pink motif, update all three or the manifest audit fails.

## Local dev

```bash
cp .env.example .env       # then fill in Firebase web-config + VITE_ALLOWED_EMAILS
npm install
npm run dev                # http://localhost:5173
npm run typecheck          # tsc -b --noEmit
npm run build              # tsc -b && vite build → dist/ + sw.js
```

Firebase project auth for CLI: `firebase login` (Google), `firebase use --add orcurriculum`. `.firebaserc` is git-ignored so each contributor runs `firebase use --add` locally.

## Deploy

```bash
npm run build
firebase deploy --only hosting        # or --only firestore:rules,hosting
```

Hosting URL: <https://orcurriculum.web.app>. Deploys touch nothing about auth providers — those changes go through the Firebase console.

## Git workflow

These are the working conventions for this repo. **Follow them by default** — divergence needs a clear reason.

### Branch protection on `main`
- `main` is protected on GitHub. Every change ships via **pull request with 1 approving review**. Force-pushes and deletions of `main` are blocked. Stale reviews are dismissed on new commits.
- Admins can bypass in emergencies, but do **not** push directly to `main` for normal work. If you catch yourself thinking "this is trivial, I'll push straight," open the PR instead — it takes 30 seconds and preserves history.

### Feature branches
- Naming: `feature/<short-kebab-name>` — descriptive, one concern per branch.
- **Always base off `main`.** Do not branch off another feature branch unless there's a real dependency, and if you do, call it out in the PR body ("Stacked on #N").
- One PR = one focused concern. Two features → two branches → two PRs.

### Merging — the rule that has already burned us

GitHub offers three merge styles. Pick based on the PR's shape, not habit:

| Merge style | When to use | Danger |
| --- | --- | --- |
| **Squash and merge** | Single-feature PR whose commits are only meaningful together. Preferred for clean linear history. | **Silently drops any commits merged into the PR branch from other branches.** If another PR was merged into this branch, its work vanishes on `main`. |
| **Rebase and merge** | PRs that have absorbed commits from other branches (stacked work), or where individual commits carry independent meaning. | Rewrites SHAs — usually fine, but avoid if others have already pulled the branch. |
| **Create a merge commit** | Anything where an explicit "N was merged into main at time T" record matters. | Slightly noisier history; harmless. |

**Never squash a PR that has other PRs merged into its branch.** We hit this exact bug: PR #3 was merged into `feature/practice-tests`, then `feature/practice-tests` was squash-merged into `main`, and PR #3's changes disappeared from `main`. Recovery required cherry-picking the lost commit onto a fresh branch and opening a new PR (#4).

### Never do (without explicit user approval)
- **`git push --force` / `--force-with-lease`** — rewrites remote history, dismisses reviews, can drop work.
- **`git reset --hard` on a shared branch** — same reason.
- **`git commit --amend` on a pushed commit** — same reason.
- **`--no-verify`** — hooks are there for a reason.
- **Delete branches with unreviewed work.**
- **Approve your own PR** — GitHub blocks it anyway, and it defeats the point of the review.

If the tooling blocks one of these actions and you think it's genuinely needed, stop and ask the user. Don't work around the block.

### Moving work between branches
- To rebase your local branch on top of an updated base, `git rebase <base>` locally is fine — just don't push the result over an existing PR without asking.
- **To move a commit onto a different base** (e.g. unstack a PR to target `main` after its dependency lands with a squash), **cherry-pick the commit onto a fresh branch off the new base, push, and open a new PR.** Don't rewrite the existing branch.

### Commits
- Subject: imperative mood, ≤ 72 chars ("Add practice test task type", not "Added practice tests" or "practice tests").
- Body: explain **why**, not what. Include the reason a reader (or future you) can't derive from the diff — the constraint, the incident, the tradeoff. Skip the body for truly trivial commits (typos, single-line fixes).
- Never commit unless the user asked for it. "Please make X bigger" implies committing the change, but ambiguous asks should be confirmed.

### PR bodies
Use this shape unless the change is genuinely trivial:

```markdown
## Summary
- 1–3 bullets, plain English

## What changed
- `path/file` — one line per file explaining the role of the change
- `path/newfile` (new) — purpose

## Data model (only if Firestore shape changed)
Describe added/renamed/removed fields.

## Test plan
- [ ] Concrete, clickable checkboxes the reviewer can walk through
```

If the change is stacked on another PR, add a **Stacked on #N** callout at the top so the reviewer knows the diff base.

### Docs stay in sync with code — every PR

`README.md` and `CLAUDE.md` are part of the surface area every PR must consider, not files to update "later."

**Update `README.md` when**
- Features change (add / remove / rename anything a user would notice)
- Setup steps change (new prerequisites, env vars, console clicks)
- The data-model table or environment example drifts from reality
- Deploy story or scripts change

**Update `CLAUDE.md` when**
- Architecture changes (new top-level collections, new hook patterns, new folders in `src/`)
- A convention is added, removed, or refined (workflow, style, naming)
- A gotcha is discovered that would bite a future contributor
- A section becomes inaccurate because the code moved on

**In the PR body**
- If docs are touched: include them in the "What changed" list with a one-liner explaining the update.
- If docs are *not* touched: include an explicit line — "**Docs**: no README / CLAUDE.md update needed (bug fix / internal refactor / etc.)" — so it's clear the question was considered, not overlooked.

**Reviewer's job**
Push back on any PR that:
- Adds a user-visible feature without touching `README.md`
- Changes architecture, conventions, or gotchas without touching `CLAUDE.md`
- Says "docs to follow in another PR" without linking the follow-up

**When separate is fine**
Small doc-only fixes discovered while working on something unrelated can either ride along with a one-line note in the PR summary, or land as their own tiny doc-only PR. Either is fine — the goal is *keep the docs true*, not force artificial bundling.

### Deploys are separate from merges
- `firebase deploy --only hosting` ships whatever is in `dist/` **regardless of git state.** The branch protection gates code review, not production.
- For a two-person hobby project this is convenient — deploy to try things live, then land the PR when review's clean. If we grow this or if the app starts holding critical data, we should tighten this (CI-driven deploys from `main` only).
- Never deploy without first running `npm run typecheck && npm run build` locally — there is no CI to catch breakage.

### Housekeeping
- After a PR merges, its feature branch can be deleted (the merged PR keeps its history). Prefer deletion so the branch list stays scannable.
- Merged branches to clean up periodically: any `feature/*` where the corresponding PR is closed as merged.

## What is **not** in this repo (by design)

Anything with a value that shouldn't leak into a public GitHub repo:

- `.env` — Firebase web-config values and the allowlist. Git-ignored.
- `.firebaserc` — project ID alias. Git-ignored (project ID itself is not secret, but keeping the file out avoids accidental cross-project deploys by collaborators).
- `.firebase/` — CLI local cache. Git-ignored.
- No hardcoded emails in any committed file. Reviewers should reject any PR that inlines a personal email in code or rules.

Firebase web-config keys are technically identifiers, not secrets — but keeping them out of git keeps forks/history clean and forces each collaborator to point at their own Firebase project during dev.

## Conventions & style notes

- **TypeScript**: strict, `noUnusedLocals`, `noUnusedParameters`. Prefer inferred types; annotate at API boundaries (hook signatures, Firestore doc shapes in `types.ts`).
- **React**: function components, hooks. State stays close to where it's used; there's no global store — Firestore's `onSnapshot` is the source of truth.
- **CSS**: Tailwind classes. Common patterns get an `@layer components` class in `src/index.css` (see `card`, `btn-*`, `input`, `chip`) — reuse those before inventing new ones.
- **Colors** in component code: use palette tokens (`bg-petal`, `text-berry`, etc.), not hex. The only exception is `course.color` which is a per-user chosen swatch and comes in as an inline `style`.
- **Emojis** are the app's "icons" — no icon library. `COURSE_EMOJIS` in `types.ts` is the picker source.
- **Animations**: Framer Motion. Keep spring configs consistent — `damping: 22, stiffness: 260` is the modal default; ring progress uses `120` stiffness for the slower fill.
- **Comments**: write none by default. Only add a comment when *why* is non-obvious (e.g. "idempotent — safe to run on every load"). Don't restate what the code says.

## Common tasks — where to look

| Task                                        | Files                                                        |
| ------------------------------------------- | ------------------------------------------------------------ |
| Add a new field on a course/goal/entry/task | `src/types.ts` → the relevant hook in `src/hooks/` → the form dialog |
| Change how progress is calculated            | `computeProgress` in `src/lib/progress.ts` (used by `CourseCard.tsx` and `CoursePage.tsx`) |
| Change week start (Sun → Mon)                | `startOfWeek` in `src/lib/periods.ts`                        |
| Add a new period kind (e.g. monthly)         | `PeriodKind` in `types.ts`, then `lib/periods.ts` functions, then goal-form UI |
| Add a new time-goal preset (session/break)   | `DURATION_PRESETS` in `SessionTimer.tsx` or `BREAK_PRESETS` in `BreakTimer.tsx` |
| Add a new dashboard range                    | `RANGES` array in `TimeDashboard.tsx` + a `rangeStart()` case |
| Change the alarm chime                       | Drop a new `public/chime.mp3`; caller does not need editing  |
| Change the calendar color mapping            | `COURSE_COLOR_TO_CALENDAR` in `src/lib/calendarColors.ts`    |
| Add a new question status for practice tests | `QuestionStatus` union in `types.ts`, entries in `QUESTION_STATUS_META` and `QUESTION_STATUS_ORDER`, done-derivation in `useTasks.ts#updateQuestionStatus` |
| Add a route                                  | Extend the `Route` union + `parseHash` in `src/hooks/useRoute.ts`, dispatch in `src/App.tsx` |
| Change palette / spacing / radii             | `tailwind.config.js` + `src/index.css`                       |
| Add a new top-level Firestore collection     | Add rules block in `firestore.rules` (else silent 403), then a hook |
| Update PWA name / icons / theme              | `vite.config.ts` (manifest) + `public/*.png` + `index.html`  |
| Change the "New version ready" toast timing  | `UPDATE_POLL_MS` in `src/components/UpdatePrompt.tsx`        |

## Known limitations / roadmap

- No streaks (consecutive weeks/days met) — history has the data; the UI doesn't render it yet.
- No charts in `HistoryView` — just a list. `TimeDashboard` has bars but no time-series graph.
- No dark mode.
- Bundle is ~750 KB (Firebase SDK dominant). Fine for now; can split with dynamic imports if first-paint matters.
- Week start is hardcoded to Sunday (see periods.ts).
- Alarms only fire reliably while the tab is open. Background push via FCM is documented in `docs/future-fcm-alarms.md`.
- Google Calendar sync is one-way write only — the app does not read existing calendar events.

If you're an AI agent picking this up: read this file, then `src/App.tsx` → `src/components/Dashboard.tsx` → whichever component you're touching. The data flow is small enough to hold in your head end-to-end.
