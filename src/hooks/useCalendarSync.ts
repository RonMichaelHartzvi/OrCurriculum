import { useCallback, useRef, useState } from 'react'
import type { Course, PlannedBlock } from '../types'
import { calendarColorFor } from '../lib/calendarColors'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const TOKEN_TTL_MS = 55 * 60 * 1000 // refresh a bit before Google's 1h expiry

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (resp: { access_token?: string; error?: string }) => void
            error_callback?: (err: { type: string }) => void
          }): TokenClient
        }
      }
    }
  }
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void
}

interface CachedToken {
  token: string
  fetchedAt: number
}

type SyncStatus = 'idle' | 'needs_auth' | 'error'

export function useCalendarSync() {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const tokenClientRef = useRef<TokenClient | null>(null)
  const cachedRef = useRef<CachedToken | null>(null)
  const pendingRef = useRef<Array<(token: string | null) => void>>([])

  const configured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)

  const initClient = useCallback((): TokenClient | null => {
    if (tokenClientRef.current) return tokenClientRef.current
    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) return null
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return null
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CALENDAR_SCOPE,
      callback: (resp) => {
        const waiters = pendingRef.current
        pendingRef.current = []
        if (resp.access_token) {
          cachedRef.current = { token: resp.access_token, fetchedAt: Date.now() }
          setStatus('idle')
          waiters.forEach((w) => w(resp.access_token!))
        } else {
          setStatus(resp.error === 'access_denied' ? 'needs_auth' : 'error')
          waiters.forEach((w) => w(null))
        }
      },
      error_callback: () => {
        const waiters = pendingRef.current
        pendingRef.current = []
        setStatus('needs_auth')
        waiters.forEach((w) => w(null))
      }
    })
    return tokenClientRef.current
  }, [])

  const getAccessToken = useCallback(
    async (interactive = false): Promise<string | null> => {
      if (!configured) return null
      const cached = cachedRef.current
      if (cached && Date.now() - cached.fetchedAt < TOKEN_TTL_MS) return cached.token
      const client = initClient()
      if (!client) {
        setStatus('needs_auth')
        return null
      }
      return new Promise<string | null>((resolve) => {
        pendingRef.current.push(resolve)
        client.requestAccessToken({ prompt: interactive ? 'consent' : '' })
      })
    },
    [configured, initClient]
  )

  const authorize = useCallback(async (): Promise<boolean> => {
    const token = await getAccessToken(true)
    return Boolean(token)
  }, [getAccessToken])

  const call = useCallback(
    async (path: string, init: RequestInit): Promise<Response | null> => {
      let token = await getAccessToken(false)
      if (!token) return null
      const doFetch = (t: string) =>
        fetch(path, {
          ...init,
          headers: {
            ...(init.headers ?? {}),
            Authorization: `Bearer ${t}`,
            'Content-Type': 'application/json'
          }
        })
      let res = await doFetch(token)
      if (res.status === 401) {
        cachedRef.current = null
        token = await getAccessToken(false)
        if (!token) return null
        res = await doFetch(token)
      }
      if (res.status === 403) setStatus('needs_auth')
      return res
    },
    [getAccessToken]
  )

  function eventBody(block: {
    title: string
    startAt: Date
    endAt: Date
    notes?: string
    course?: Course | null
  }) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const colorId = calendarColorFor(block.course?.color)
    return {
      summary: block.course ? `${block.course.emoji} ${block.title}` : block.title,
      description: block.notes ?? '',
      start: { dateTime: block.startAt.toISOString(), timeZone: tz },
      end: { dateTime: block.endAt.toISOString(), timeZone: tz },
      ...(colorId ? { colorId } : {})
    }
  }

  const createEvent = useCallback(
    async (block: {
      title: string
      startAt: Date
      endAt: Date
      notes?: string
      course?: Course | null
    }): Promise<string | null> => {
      const res = await call(CALENDAR_API, {
        method: 'POST',
        body: JSON.stringify(eventBody(block))
      })
      if (!res || !res.ok) return null
      const data = (await res.json()) as { id?: string }
      return data.id ?? null
    },
    [call]
  )

  const updateEvent = useCallback(
    async (
      block: PlannedBlock & { course?: Course | null }
    ): Promise<boolean> => {
      if (!block.calendarEventId) return false
      const res = await call(`${CALENDAR_API}/${encodeURIComponent(block.calendarEventId)}`, {
        method: 'PATCH',
        body: JSON.stringify(
          eventBody({
            title: block.title,
            startAt: block.startAt.toDate(),
            endAt: block.endAt.toDate(),
            notes: block.notes,
            course: block.course ?? null
          })
        )
      })
      return Boolean(res && res.ok)
    },
    [call]
  )

  const deleteEvent = useCallback(
    async (eventId: string): Promise<boolean> => {
      const res = await call(`${CALENDAR_API}/${encodeURIComponent(eventId)}`, {
        method: 'DELETE'
      })
      // 410 Gone = already deleted; treat as success.
      return Boolean(res && (res.ok || res.status === 410))
    },
    [call]
  )

  return {
    configured,
    status,
    authorize,
    createEvent,
    updateEvent,
    deleteEvent
  }
}
