import { useEffect, useRef } from 'react'

const CHIME_URL = '/chime.mp3'

// We route the chime through the Web Audio API rather than an HTMLAudioElement
// because AudioBufferSourceNode.stop() is definitive — it terminates playback
// synchronously, unlike HTMLAudioElement.pause() which is unreliable on iOS
// Safari and PWA installs (the docs even warn it can silently no-op on a
// detached element). Two previous "just call pause()" fixes did not stick;
// this path is the one that actually stops the sound.
let audioCtx: AudioContext | null = null
let chimeBuffer: AudioBuffer | null = null
let currentSource: AudioBufferSourceNode | null = null
let currentNotification: Notification | null = null
let alarmToken = 0
// The chime re-fires when it ends until this timestamp, so an unacknowledged
// alarm keeps nagging for a minute instead of a single 20 s burst.
let repeatUntil = 0
const REPEAT_WINDOW_MS = 60_000

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      audioCtx = new Ctor()
    } catch {
      audioCtx = null
    }
  }
  return audioCtx
}

async function loadChimeBuffer(): Promise<AudioBuffer | null> {
  if (chimeBuffer) return chimeBuffer
  const ctx = getAudioContext()
  if (!ctx) return null
  try {
    const res = await fetch(CHIME_URL)
    const arr = await res.arrayBuffer()
    chimeBuffer = await ctx.decodeAudioData(arr)
    return chimeBuffer
  } catch {
    return null
  }
}

export function primeAudio(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  // iOS: AudioContext starts 'suspended' and must be resumed inside a user
  // gesture. Callers invoke primeAudio() from the session-start click handler
  // so this unlocks playback for the eventual fireAlarm.
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
  loadChimeBuffer().catch(() => {})
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

function killSource(): void {
  const src = currentSource
  currentSource = null
  if (!src) return
  try {
    src.onended = null
  } catch {
    /* ignore */
  }
  try {
    src.stop()
  } catch {
    /* already stopped or never started */
  }
  try {
    src.disconnect()
  } catch {
    /* ignore */
  }
}

export function stopAlarm(): void {
  alarmToken++
  repeatUntil = 0
  killSource()
  const n = currentNotification
  currentNotification = null
  if (n) {
    try {
      n.close()
    } catch {
      /* ignore */
    }
  }
}

function playChimeOnce(ctx: AudioContext, buffer: AudioBuffer, token: number): void {
  killSource()
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.onended = () => {
    if (currentSource === source) currentSource = null
    // Re-fire on natural end if we're still inside the repeat window and no
    // stopAlarm has bumped the token since we started. killSource() nulls
    // onended before calling stop(), so cancellation doesn't reach here.
    if (token === alarmToken && Date.now() < repeatUntil) {
      playChimeOnce(ctx, buffer, token)
    }
  }
  currentSource = source
  source.start()
}

export async function fireAlarm({ title, body, silent }: AlarmPayload): Promise<void> {
  if (!silent) {
    const token = ++alarmToken
    const ctx = getAudioContext()
    const buffer = await loadChimeBuffer()
    // Bail out if stopAlarm ran while we were awaiting the buffer.
    if (ctx && buffer && token === alarmToken) {
      try {
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {})
        }
        repeatUntil = Date.now() + REPEAT_WINDOW_MS
        playChimeOnce(ctx, buffer, token)
      } catch {
        /* audio failure is non-fatal */
      }
    }
  }
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      // Keep the reference so stopAlarm can close it — some platforms
      // (notably Windows Chrome) keep playing the OS notification sound
      // until the notification itself is dismissed.
      currentNotification = new Notification(title, {
        body,
        tag: 'orcurriculum-alarm',
        renotify: true
      } as NotificationOptions)
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
