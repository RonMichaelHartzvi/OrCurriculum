import { useEffect, useRef } from 'react'

const CHIME_URL = '/chime.mp3'

let chimeEl: HTMLAudioElement | null = null
// Monotonic token used to detect when stopAlarm() has been called after a
// fireAlarm() that's still awaiting play(). Any resolved play() whose token
// doesn't match the current one immediately re-pauses so we can't be left
// with audio playing after the user acknowledged.
let alarmToken = 0

function getChime(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!chimeEl) {
    try {
      chimeEl = new Audio(CHIME_URL)
      chimeEl.preload = 'auto'
    } catch {
      chimeEl = null
    }
  }
  return chimeEl
}

export function primeAudio(): void {
  const el = getChime()
  if (!el) return
  // Some browsers require a user-gesture-scoped load to unlock playback later.
  try {
    el.load()
  } catch {
    /* ignore */
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission
  }
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

export interface AlarmPayload {
  title: string
  body?: string
  silent?: boolean
}

export function stopAlarm(): void {
  alarmToken++
  const el = chimeEl
  if (!el) return
  try {
    el.pause()
    el.currentTime = 0
  } catch {
    /* ignore */
  }
}

export async function fireAlarm({ title, body, silent }: AlarmPayload): Promise<void> {
  if (!silent) {
    const el = getChime()
    if (el) {
      const token = ++alarmToken
      try {
        el.currentTime = 0
        await el.play().catch(() => {})
        // If stopAlarm was called while play() was in flight, immediately
        // pause the audio that the browser eventually started.
        if (token !== alarmToken) {
          try {
            el.pause()
            el.currentTime = 0
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* audio failure is non-fatal */
      }
    }
  }
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: 'orcurriculum-alarm', renotify: true } as NotificationOptions)
    } catch {
      /* ignore */
    }
  }
  try {
    if (typeof window !== 'undefined' && document.hidden) window.focus()
  } catch {
    /* ignore */
  }
}

// Requests a screen wake lock while `active` is true; re-acquires on visibilitychange.
export function useWakeLock(active: boolean): void {
  const lockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false

    async function acquire() {
      if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
      try {
        const lock = await (navigator as Navigator & { wakeLock: WakeLock }).wakeLock.request('screen')
        if (cancelled) {
          lock.release().catch(() => {})
          return
        }
        lockRef.current = lock
        lock.addEventListener('release', () => {
          if (lockRef.current === lock) lockRef.current = null
        })
      } catch {
        /* permission denied or feature missing — non-fatal */
      }
    }

    function onVisibility() {
      if (!document.hidden && !lockRef.current) acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      const lock = lockRef.current
      lockRef.current = null
      if (lock) lock.release().catch(() => {})
    }
  }, [active])
}

// Minimal ambient types so we don't need to depend on lib.dom Wake Lock types.
declare global {
  interface WakeLockSentinel extends EventTarget {
    release(): Promise<void>
  }
  interface WakeLock {
    request(type: 'screen'): Promise<WakeLockSentinel>
  }
}
