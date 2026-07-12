# Future work: background alarms via FCM

Design note for a later PR — this is **not** implemented today. The current
alarm path is `src/lib/alarm.ts`: browser `Notification` + audio chime + screen
wake lock, all in-tab. It works well while the app tab is open (especially
when installed as a PWA), and fails silently if the tab is fully closed.

This document is the plan for graduating to true background push, so a user
can lock their phone during a 90-minute session and still hear the timer.

## Why this is a follow-up, not v1

The setup surface for Firebase Cloud Messaging is meaningful:

- Web Push (VAPID) key generation in the Firebase console
- A separate service worker (`firebase-messaging-sw.js`) that has to coexist
  with the Workbox-managed one
- iOS PWA quirks around 16.4+ web push (only works for home-screen-installed
  PWAs, and only after the user grants notification permission from within
  the installed app)
- A permission-prompt UX that has to be earned (asking too early gets denied)

None of that helps the >90% of sessions where the tab stays open. The right
sequencing is: ship the simple path, use it, then decide whether missed
alarms are a real problem before taking on FCM.

## Implementation sketch

1. **Firebase console → Cloud Messaging → Web Push certificates → Generate a
   VAPID key pair.** Free tier. Add the public key as
   `VITE_FIREBASE_VAPID_KEY` in `.env` and `.env.example`.

2. **`public/firebase-messaging-sw.js`** — a bespoke service worker registered
   independently at the root (Workbox will still handle app caching; this SW
   only handles push). Handle `push` events by calling
   `self.registration.showNotification(title, options)`.

3. **Token registration.** On session start (or on a "Enable background
   alarms" opt-in in settings), request `Notification.permission`, then call:

   ```ts
   import { getMessaging, getToken } from 'firebase/messaging'
   const messaging = getMessaging(app)
   const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY })
   ```

   Store the token in `users/{uid}/fcmTokens/{tokenId}` alongside the device
   user-agent for debugging. Delete on sign-out.

4. **The scheduling problem.** Because we're on the Spark plan, we don't have
   Cloud Functions. Three options:

   - **(a) Client-scheduled fallback** — inside the SW, when a session
     starts, register a `setTimeout` and call `showNotification` when it
     fires. Cost: SW is not guaranteed to stay alive on iOS or aggressive
     Android battery-savers. Reasonable fallback but not reliable.
   - **(b) Move to Blaze plan (paid)** and write a Cloud Function that reads
     `sessions` on write and schedules a delayed FCM Admin send when
     `startedAt + plannedMinutes <= now`. Reliable, but breaks the free-tier
     constraint the project holds today.
   - **(c) External free scheduler** — point a GitHub Actions cron at a
     public HTTPS endpoint (Cloud Run free tier, or a static endpoint fronted
     by Firebase Hosting rewrites) that reads due sessions and pushes via FCM
     Admin. Awkward, but free.

   Recommendation: start with (a) so nothing else has to change, and only
   escalate to (b) or (c) if reliability turns out to be a real problem.

5. **iOS PWA note.** Since iOS 16.4, web push works only for PWAs added to
   the home screen. The UX must nudge the user to install first before
   enabling background alarms. Don't request permission until they've done
   that — otherwise the OS-level `denied` is remembered and hard to reverse.

6. **Notification content**

   - Session end: `title = "Time's up! 🌸"`,
     `body = "Your {course} session is complete."`,
     `tag = "session-{sessionId}"` (dedupes late deliveries),
     `data.url = "/#/course/{courseId}"` for the click-to-open target.
   - Break end: same shape, different title.

7. **Test plan**

   - Permission denied path: token registration should fail gracefully and
     the UI should show a small "background alarms unavailable" hint.
   - Tab-closed path: session started, tab closed — does the notification
     fire? On which OSes?
   - Phone-locked path: session started, tab open, phone screen off — same
     question.
   - Duplicate-fire edge: session ended in the last minute — does the alarm
     fire once, twice, or zero times? The `tag` should collapse duplicates.

## Migration from the in-tab alarm

When FCM is added, `src/lib/alarm.ts` becomes the **foreground** alarm path
(fires when the tab is visible / installed PWA is focused) and the SW push
handler becomes the **background** path. Both should call the same "session
ended" logic (which currently just opens the confirmation dialog). The
notification `data.url` deep-link handles the "user tapped from lock screen"
case.
