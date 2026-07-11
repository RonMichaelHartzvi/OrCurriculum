# OrCurriculum 🌸

A cute, pink, installable PWA to track your studies. Set weekly or daily goals per course (e.g. "answer 40 questions in Anatomy this week"), tap `+` throughout the day to log what you did, and watch each course's progress ring fill up. Progress auto-resets each week/day and gets archived to history.

Built with **React + Vite + TypeScript**, **Firebase** (Auth + Firestore + Hosting, all on the free Spark plan), and **Tailwind CSS**.

## Features
- 💗 Email + password login (per-user data, private)
- 📚 Add / edit / delete courses (name, emoji, color)
- 🎯 Multiple goals per course, each weekly *or* daily, with a free-form metric ("questions", "tests", "pages", …)
- ✨ Quick-add buttons (+1, +2, +5, +10) or a custom amount
- 🌷 Circular ring progress that animates as you log
- ⏰ Automatic period rollover (weekly → new week, daily → new day) with a history view of past periods
- 📱 Installable PWA — add to home screen on iOS/Android or install as a desktop app

## First-time setup

### 1. Prerequisites
- Node.js 20+
- A Firebase project (Spark / free plan — no credit card required)

### 2. Create a Firebase project
1. Go to <https://console.firebase.google.com> and create a project.
2. In the project, add a **Web app** — copy the config values (they look like `apiKey`, `authDomain`, etc.).
3. In **Authentication → Sign-in method**, enable **Email/Password**.
4. In **Firestore Database → Create database**, start in production mode, pick a region close to you.

### 3. Clone & install
```bash
git clone <your-repo-url>
cd OrCurriculum
npm install
```

### 4. Configure environment
```bash
cp .env.example .env
```
Fill in the six `VITE_FIREBASE_*` values from step 2. `.env` is git-ignored so your keys stay off GitHub.

### 5. Deploy Firestore rules (important!)
The included `firestore.rules` locks all data down so only the signed-in user can read/write their own documents. Deploy them once:
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
Open the printed URL, sign up, and add your first course.

## Deploy to Firebase Hosting (free)

```bash
npm run build
firebase deploy --only hosting
```

Firebase will print the live URL. Open it on your phone, tap **Add to Home Screen**, and OrCurriculum becomes a proper installed app.

## Data model (Firestore)

Everything is scoped under `users/{uid}/…`:

| Collection    | Shape                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| `courses`     | `{ name, emoji, color, createdAt }`                                                                      |
| `goals`       | `{ courseId, metric, target, period: "weekly" \| "daily", active, createdAt }`                           |
| `entries`     | `{ courseId, goalId, metric, amount, at, periodKey }`                                                    |
| `history`     | `{ courseId, goalId, metric, target, achieved, periodStart, periodEnd, period, periodKey }`              |

`periodKey` is `YYYY-MM-DD` (daily) or `YYYY-Wnn` (weekly, week starting Sunday). Progress is the sum of `amount` across entries with the current `periodKey`. On load, stale entries are rolled up into `history` and removed. Idempotent and race-safe.

## Is it safe to make the repo public?

Yes:
- `.env` is git-ignored, so your Firebase web-config never lands in git.
- Firebase web config keys are technically *not secrets* — they identify the project, not authenticate a user. What actually protects your data is the Firestore rules (`firestore.rules`), which restrict everything under `users/{uid}` to that user.
- `.firebaserc` (project ID) is git-ignored too; each contributor runs `firebase use --add` locally.
- No hardcoded emails, personal info, or account IDs anywhere in the code.

## Scripts

| Command             | What it does                       |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Vite dev server                    |
| `npm run typecheck` | TypeScript check, no emit          |
| `npm run build`     | Type-check + production build      |
| `npm run preview`   | Serve the built `dist/` locally    |

## Roadmap ideas
- 🌈 Optional dark-pink mode
- 🔥 Streaks (consecutive weeks/days where you met your goal)
- 📊 Charts of history per course
- 🧭 Sunday-vs-Monday week start toggle

Made with 💗.
