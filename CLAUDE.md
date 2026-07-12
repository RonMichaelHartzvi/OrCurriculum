# OrCurriculum — Contributor & Agent Context

Short, focused context for anyone (human or AI) picking up this project. Read this first, then dive into the code.

## What this is

A cute pastel-pink **PWA** for tracking weekly and daily study goals per course. You add courses (e.g. "Anatomy"), attach goals to them (e.g. "40 questions per week", "2 tests per day"), and log progress in small increments through the day. Each goal shows an animated ring of progress; period rollovers auto-archive to a history collection.

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
  App.tsx                    # auth gate: allow-listed user → Dashboard, else AuthScreen
  main.tsx
  firebase.ts                # initializeApp, GoogleAuthProvider, ALLOWED_EMAILS, isAllowed()
  types.ts                   # Course, Goal, Entry, HistoryRecord, PeriodKind
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
  components/
    AuthScreen.tsx           # Google sign-in + "not on allowlist" message
    Dashboard.tsx            # header, grid of CourseCards, floating "+ Course", history dialog
    CourseCard.tsx           # per-course card: ring progress per goal + Log/Edit buttons
    CourseFormDialog.tsx     # create / edit / delete a course
    GoalFormDialog.tsx       # create / edit / delete a goal (metric + target + weekly|daily)
    QuickAddSheet.tsx        # +1 / +2 / +5 / +10 quick-add or custom amount
    HistoryView.tsx          # dialog listing past periods grouped by course
    RingProgress.tsx         # SVG ring with gradient + spring animation
    ui/Dialog.tsx            # base modal with animated backdrop, ESC-to-close

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
| `users/{uid}/history/{id}`       | `courseId`, `goalId`, `metric`, `target`, `achieved`, `periodStart`, `periodEnd`, `period`, `periodKey` | Written by `archivePastPeriods()`. |

### Period keys

- **Daily**: `YYYY-MM-DD` (from local time, start-of-day).
- **Weekly**: `YYYY-Wnn` where `nn` is the index of the week starting **Sunday** (see `startOfWeek` in `lib/periods.ts`). If you ever want configurable week-start, that's the single place to change.

### Progress calculation

Live "progress toward this goal" = **sum of `amount` on entries where `goalId === g.id` and `periodKey === periodKey(g.period)`**. Done in `CourseCard.tsx#progressFor`. No counters, no race conditions, idempotent.

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

## PWA gotchas

- Service worker is `autoUpdate`. The **first** load after a deploy still serves the old cached shell; the SW downloads the new one in the background and it applies on the **next** load. If you deploy and immediately test on your phone, close and reopen the installed app once, then again — or in DevTools → Application → Service Workers → Update / Unregister.
- Cache headers in `firebase.json`: hashed assets get `max-age=31536000, immutable`; `sw.js` gets `no-cache`. Don't loosen those.
- Icons live in `public/` and are 192/512/apple. If you replace the pink motif, update all three or the manifest fails audit.

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
| Add a new field on a course/goal/entry      | `src/types.ts` → the relevant hook in `src/hooks/` → the form dialog |
| Change how progress is calculated            | `CourseCard.tsx#progressFor` (single source)                 |
| Change week start (Sun → Mon)                | `startOfWeek` in `src/lib/periods.ts`                        |
| Add a new period kind (e.g. monthly)         | `PeriodKind` in `types.ts`, then `lib/periods.ts` functions, then goal-form UI |
| Change palette / spacing / radii             | `tailwind.config.js` + `src/index.css`                       |
| Add a new top-level Firestore collection     | Add rules block in `firestore.rules` (else silent 403), then a hook |
| Update PWA name / icons / theme              | `vite.config.ts` (manifest) + `public/*.png` + `index.html`  |

## Known limitations / roadmap

- No streaks (consecutive weeks/days met) — history has the data; the UI doesn't render it yet.
- No charts in `HistoryView` — just a list.
- No dark mode.
- Bundle is ~750 KB (Firebase SDK dominant). Fine for now; can split with dynamic imports if first-paint matters.
- Week start is hardcoded to Sunday (see periods.ts).

If you're an AI agent picking this up: read this file, then `src/App.tsx` → `src/components/Dashboard.tsx` → whichever component you're touching. The data flow is small enough to hold in your head end-to-end.
