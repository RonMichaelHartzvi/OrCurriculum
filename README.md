# OrCurriculum 🌸

A cute, pink, installable PWA to track your studies. Add courses, set weekly or daily goals per course (e.g. "answer 40 questions in Anatomy this week" **or** "study 10 hours this week"), tap `+` throughout the day to log what you did, and watch each course's progress ring fill up. Run in-app study sessions with a countdown and chime, log time manually, plan the day with time blocks (optionally pushed to Google Calendar), and see per-course totals over rolling windows. Alongside timed goals, each course also gets an untimed to-do list and a per-course history view. Progress auto-resets each week/day and old periods are archived so you can look back.

Built with **React + Vite + TypeScript**, **Firebase** (Auth + Firestore + Hosting, all on the free Spark plan), and **Tailwind CSS**.

Live: **https://orcurriculum.web.app**

## Features

**Sign in**
- 🔐 One-tap Google sign-in — no passwords to remember
- 👥 Email allowlist gates who can use the app (baked into the build via env var)

**Dashboard**
- 📚 Add / edit / delete courses (name, emoji, color)
- 🎯 Multiple goals per course, each weekly *or* daily, either **Count** (free-form metric — "questions", "tests", "pages", …) or **Time** (hours studied)
- ✨ Quick-add buttons (`+1 / +2 / +5 / +10` for count goals, `+15 / +30 / +60 / +90 min` for time goals) or a custom amount
- 🌷 Circular ring progress that animates as you log
- 🔎 Small open-task counter under each course name
- ☕ Floating **Break** button — start a 5/10/15/20 min break with a chime alarm when it ends

**Time management**
- ⏱️ **Study sessions** — start a 25/45/60/90/120 min session on a course; countdown ring, screen wake lock, browser notification + audio chime when time's up, log the elapsed minutes toward a time-based goal
- ✍️ Manual entry — log hours you already worked without running a timer
- 📅 **Day plan** — build a schedule of time blocks per day; each block has a **"Start session"** button that opens the timer pre-filled with the block's duration
- 🗓️ **Google Calendar sync** — opt in per block to push it to your Google Calendar (one-way write; the app owns the block, Calendar mirrors it). Requires setting `VITE_GOOGLE_CLIENT_ID`
- 📊 **Time dashboard** — total hours per course over 7d / 30d / 90d / all-time, plus a daily average

**Per-course page** (tap any card)
- 🎨 Themed pink-gradient header matching the course color
- 📈 Larger ring progress with inline log/edit
- ✅ **Untimed tasks** — add / check / uncheck / edit / delete, done items stay visible in a "Done" group
- 📝 **Practice tests** — a special task type with a configurable number of questions
  - Each question is markable as ✓ Succeeded / ✗ Failed / ↻ Try again / ○ Not done yet
  - Expandable question grid with a colored chip per question
  - Test-level "done" is auto-derived: done ⇔ every question is ✓ or ✗ (retries keep it Open)
  - Question count defaults to the last practice test's count on that course
- ⏰ Per-course history section — past weeks and days for just that course

**Reliability**
- ⏰ Automatic period rollover (weekly → new week, daily → new day) with a history view of past periods; auto-archive is idempotent
- 🌸 In-app **"New version ready — Reload"** toast when a fresh deploy is available (polls every 60 s)
- 📱 Installable PWA — add to home screen on iOS / Android or install as a desktop app

## Quick tour of the URLs

| URL                          | What it shows                                       |
| ---------------------------- | --------------------------------------------------- |
| `/`                          | Dashboard: grid of courses + goal rings             |
| `#/course/{courseId}`        | Detail page for one course (goals / day plan / tasks / history) |
| `#/plan`                     | Top-level day plan across all courses               |
| `#/time`                     | Time dashboard: hours per course over a range       |

Hash-based routing, so browser back / forward works and the installed PWA can deep-link into a course.

## First-time setup

### 1. Prerequisites
- Node.js 20+
- A Firebase project (Spark / free plan — no credit card required)

### 2. Create a Firebase project
1. Go to <https://console.firebase.google.com> and create a project.
2. In the project, **add a Web app** — copy the config values (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).
3. In **Authentication → Sign-in method**, enable **Google** and pick a support email.
4. In **Firestore Database → Create database**, start in production mode and pick a region close to you.

### 3. Clone & install
```bash
git clone https://github.com/RonMichaelHartzvi/OrCurriculum.git
cd OrCurriculum
npm install
```

### 4. Configure environment
```bash
cp .env.example .env
```
Fill in `.env`:

- Six `VITE_FIREBASE_*` values from step 2 (or run `firebase apps:sdkconfig WEB --project <projectId>` to have the CLI print them).
- `VITE_ALLOWED_EMAILS` — comma-separated Google emails that are allowed to use the app. Leave empty in local dev if you want to try any account; **never deploy with it empty** — the app would open to the world.
- `VITE_GOOGLE_CLIENT_ID` (optional) — an OAuth 2.0 **Web** client ID from [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials). Enable the **Google Calendar API** for the project. Set authorized JavaScript origins to `http://localhost:5173` (dev) and your deployed URL (prod). Leaving this empty disables the "Add to Google Calendar" toggle on planned blocks; everything else still works.

Example:
```
VITE_ALLOWED_EMAILS=you@gmail.com,partner@gmail.com
```

`.env` is git-ignored, so nothing personal ends up in the repo.

### 5. Deploy Firestore rules (once)
The included `firestore.rules` locks all data down so only the signed-in user can read/write their own documents. Deploy them the first time you set up:
```bash
npm install -g firebase-tools    # if you don't already have it
firebase login
firebase use --add               # pick your Firebase project
firebase deploy --only firestore:rules
```

### 6. Run locally
```bash
npm run dev
```
Open the printed URL, sign in with Google, and add your first course.

## Deploy to Firebase Hosting (free)

```bash
npm run build
firebase deploy --only hosting
```

Firebase prints the live URL. Any open browser tab or installed PWA sees a **"New version ready"** pill within ~60 seconds and can reload onto the new build with one tap.

Cache setup that makes this work is in `firebase.json`:
- `index.html`, `sw.js`, `registerSW.js`, `manifest.webmanifest` → `no-cache` (browser always revalidates)
- Content-hashed assets (`assets/*.@(js|css|svg|png|woff2)`, `workbox-*.js`) → `1-year immutable`

Combined with `skipWaiting` + `clientsClaim` in the workbox config, deploys propagate essentially instantly.

## Data model (Firestore)

Everything is scoped under `users/{uid}/…`. Security rules restrict every doc to its owning user.

| Collection      | Shape                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| `courses`       | `{ name, emoji, color, createdAt }`                                                                      |
| `goals`         | `{ courseId, metric, target, period: "weekly" \| "daily", active, createdAt, unit?: "count" \| "minutes" }` |
| `entries`       | `{ courseId, goalId, metric, amount, at, periodKey }`                                                    |
| `tasks`         | `{ courseId, title, done, createdAt, completedAt, type?: "regular" \| "practiceTest", questionCount?, questions?: QuestionStatus[] }` |
| `sessions`      | `{ courseId, goalId, plannedMinutes, startedAt, endedAt, outcome: "running" \| "completed" \| "canceled", loggedMinutes, entryId }` |
| `breaks`        | `{ plannedMinutes, startedAt, endedAt, outcome: "running" \| "completed" \| "canceled" }`                |
| `plannedBlocks` | `{ courseId, title, startAt, endAt, notes?, calendarEventId?, createdAt }`                               |
| `history`       | `{ courseId, goalId, metric, target, achieved, periodStart, periodEnd, period, periodKey }`              |

- `QuestionStatus` = `"unanswered" | "succeeded" | "failed" | "retry"`. A practice test's `done` flag is auto-derived: `done` iff every question is `succeeded` or `failed` (retries keep it Open).
- `periodKey` is `YYYY-MM-DD` (daily) or `YYYY-Wnn` (weekly, week starting Sunday). Progress is the sum of `amount` across entries with the current `periodKey`. On load, stale entries are rolled up into `history` and removed. Idempotent and race-safe.
- Tasks without a `type` field are treated as regular tasks; goals without a `unit` field are treated as `"count"` (backwards compatible).
- For time-based goals, `entry.amount` is stored as integer **minutes** and `entry.metric` is `"minutes"`. The UI converts to `Xh Ym` at display time.
- Only one session can be `"running"` at a time per user; enforced in the hook (not in Firestore rules).
- A `plannedBlock` with a non-empty `calendarEventId` mirrors a Google Calendar event that the app created. Editing/deleting the block updates/removes the calendar event too.

## Is it safe to make the repo public?

Yes:
- `.env` is git-ignored, so your Firebase web-config and allowlist never land in git.
- Firebase web-config keys are technically *not secrets* — they identify the project, not authenticate a user. What actually protects your data is the Firestore rules (`firestore.rules`), which restrict everything under `users/{uid}` to that user.
- `.firebaserc` (project ID alias) is git-ignored too; each contributor runs `firebase use --add` locally.
- No hardcoded emails, personal info, or account IDs anywhere in the code.

The allowlist emails do get baked into the deployed JavaScript bundle (which is public), so treat them as public information. They can't be used to sign in as someone else — Firebase Auth still requires the corresponding Google account.

## Contributing / running with a collaborator

The maintainer workflow (branch protection, PR review, merge rules, force-push policy, deploy vs. merge, commit / PR body conventions) is documented in [`CLAUDE.md`](./CLAUDE.md) under **Git workflow**. Read that section before opening a PR — it will save you and reviewers time.

Short version: branch off `main`, `feature/<short-kebab>`, open a PR, wait for one approving review. Never squash a PR whose branch has other PRs merged into it (we've been burned by that once).

## Scripts

| Command             | What it does                       |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Vite dev server                    |
| `npm run typecheck` | TypeScript check, no emit          |
| `npm run build`     | Type-check + production build      |
| `npm run preview`   | Serve the built `dist/` locally    |

## Roadmap ideas

- 🌈 Optional dark-pink mode
- 🔥 Streaks (consecutive weeks / days where you met your goal)
- 📊 Charts of history per course
- 🧭 Sunday-vs-Monday week-start toggle
- 🔔 True background alarms via Firebase Cloud Messaging — see [`docs/future-fcm-alarms.md`](./docs/future-fcm-alarms.md) for the design
- 🔄 Two-way Google Calendar sync (read existing events and credit them toward time goals)
- 🔁 Server-side allowlist (Firestore config doc) so we don't have to redeploy to change who has access

Made with 💗.
