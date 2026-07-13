# Known issue: session chime keeps playing after acknowledging the log dialog

**Status:** Open. Ships in v1 of the time-management feature (PR #9) with the
bug present. Fixes attempted; none held.

## Symptom

When a study session hits zero, the SessionBanner fires `fireAlarm()` which:

1. plays `public/chime.mp3` (20-second clip) via a shared `HTMLAudioElement`
2. shows an OS notification
3. auto-opens the SessionTimer to the log-confirm dialog

When the user clicks **Log X minutes** (or **Discard**) in that confirm
dialog, `stopAlarm()` is called, which pauses the audio element. The audio
should stop instantly.

**It does not.** The chime continues to play for the full 20 seconds
regardless of what the user clicks. Reported repeatedly by the primary user
on macOS Chrome, with a hard reload confirmed each time (bundle hash matched
local build).

Note: an earlier version of the fix that stopped the alarm from a
`useEffect(() => { if (askConfirm) stopAlarm() }, [askConfirm])` caused the
opposite problem — the chime never played at all, because the effect ran on
the same React tick as `fireAlarm()` and `pause()` interrupted the pending
`play()`. That version was reverted; the current version only calls
`stopAlarm()` from explicit user actions (Log button, Discard button, dialog
close). Which is what should work — but doesn't.

## Files involved

- `src/lib/alarm.ts` — owns the singleton `chimeEl: HTMLAudioElement`, plus
  `fireAlarm`, `stopAlarm`, `primeAudio`. Has a monotonic `alarmToken`
  intended to catch a race where `stopAlarm()` runs before `fireAlarm()`'s
  `await el.play()` resolves — after play resolves, if the token has been
  bumped, we re-pause. This was the last attempted fix (commit `18fe69b`).
- `src/components/SessionTimer.tsx` — `handleConfirm` (Log button),
  Discard button `onClick`, and the Dialog's `onClose` all call
  `stopAlarm()` first thing.
- `src/components/SessionBanner.tsx` — always-mounted; owns the
  session-end detection and fires the alarm exactly once per session via a
  ref-guarded `useEffect`.

## What has been tried

1. Silence in a `useEffect(() => { if (askConfirm) stopAlarm() }, [...])`.
   → chime never played at all (killed pending `play()`). Reverted.
2. Silence in the button `onClick` handlers only.
   → chime played, then kept playing. This is the current state.
3. Added a monotonic `alarmToken` in `alarm.ts` so a `stopAlarm()` bumps it,
   and after `await el.play()` resolves the `fireAlarm` code re-pauses if
   the token has moved (commit `18fe69b`).
   → still keeps playing per user report.

## Leading hypotheses for next debug session

Investigate in this order — cheapest first:

1. **The user is not on the freshly deployed bundle.**
   The service worker aggressively caches `assets/index-*.js`. Even after a
   normal reload, a stale SW can serve the old bundle. Every attempted fix
   might have been shadowed by a cached older version. Verify by:
   - Fetching `https://orcurriculum.web.app/` and grepping the emitted
     `index-*.js` hash. Compare to `dist/assets/index-*.js` after a fresh
     local build.
   - Instructing user to unregister the SW: DevTools → Application →
     Service Workers → Unregister, then reload.
   - Adding a version marker on the confirm dialog (like the earlier v4
     debug banner in DayPlan) so it's visually obvious which bundle is
     loaded.

2. **Multiple singletons of `chimeEl` across modules.**
   Vite normally dedupes module state, but hot reload / dynamic import edge
   cases can create parallel copies. If two copies of `alarm.ts` exist at
   runtime, `fireAlarm()` from copy A plays audio on element A, and
   `stopAlarm()` from copy B pauses element B. Diagnose:
   - In DevTools console, run `document.querySelectorAll('audio')` after
     the alarm fires. Count elements. If > 1, that's the bug.
   - `console.log(chimeEl)` from both fireAlarm and stopAlarm and compare
     object identity in DevTools.

3. **Sound heard is not our chime.**
   `new Notification(...)` on macOS Chrome plays the system default
   notification sound, which is separate from our `HTMLAudioElement`.
   `stopAlarm()` cannot affect it. If the user's system notification sound
   is loud/long (custom sound), they may perceive it as "the alarm". Test
   by temporarily commenting out the `new Notification(...)` call in
   `fireAlarm` and re-verifying. If chime disappears entirely, the sound
   was the OS notification, not our audio.

4. **The chime is being triggered more than once, so pause on one instance
   leaves others playing.**
   Shouldn't be possible given the singleton `chimeEl`, but worth
   verifying. Add `console.count('fireAlarm')` and `console.count('play')`
   at the top of `fireAlarm`. If either > 1, one of the guards is failing:
   - The `alarmedForSessionId` ref in `SessionBanner` might be resetting
     unexpectedly (e.g., banner unmount/remount due to a parent re-render
     changing the `user` prop reference).
   - The session id might be changing (if we ever start writing a new
     session doc instead of updating the existing one — check
     `useSession.startSession`).

5. **`pause()` on this specific browser/OS combo doesn't actually stop
   an already-playing `.mp3`.** Extremely unlikely for Chrome + Mac, but
   testable by manually running `document.querySelectorAll('audio')[0].pause()`
   in DevTools console while the chime is playing.

## Suggested next fix approaches (in order of increasing scope)

1. **Nuke the audio element entirely on stop.**
   Instead of pause + reset, set `chimeEl.src = ''`, then `chimeEl = null`.
   Next `getChime()` call creates a fresh element. This bypasses any
   browser state that `pause()` might not fully clear.
   ```ts
   export function stopAlarm(): void {
     alarmToken++
     const el = chimeEl
     chimeEl = null
     if (!el) return
     try {
       el.pause()
       el.removeAttribute('src')
       el.load()
     } catch { /* ignore */ }
   }
   ```

2. **Switch to Web Audio API** for the chime.
   Load `chime.mp3` into an `AudioBuffer`, play via a `BufferSource`. On
   stop, disconnect the source and it's guaranteed silent — Web Audio has
   no equivalent of the "play promise still pending" race.

3. **Shorten the chime to ~3 seconds** so even if it can't be stopped, it
   doesn't feel annoying. This is a UX escape hatch, not a fix.

4. **Bypass browser audio entirely and use only the OS notification.**
   `new Notification(...)` handles the sound at the OS level; drop
   `chime.mp3` playback altogether. Downside: user loses control over the
   sound; upside: no stopping problem.

## How to verify a fix

1. Set a **10-second session** (bump `plannedMinutes: 0.17` in DevTools if
   needed, or add a temporary `DURATION_PRESETS` entry with 0.5 min).
2. Wait for the alarm to fire.
3. Wait a further ~2 seconds so audio has definitely started.
4. Click **Log**.
5. Expected: silence, immediately.
6. Repeat 3 times to be sure it isn't intermittent.
7. Repeat on Ori's device — this bug may be macOS-Chrome-specific.
