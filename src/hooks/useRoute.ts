import { useEffect, useState } from 'react'

export type Route =
  | { view: 'dashboard' }
  | { view: 'course'; courseId: string }

function parseHash(): Route {
  const hash = window.location.hash.slice(1)
  const match = hash.match(/^\/course\/(.+)$/)
  if (match) return { view: 'course', courseId: decodeURIComponent(match[1]) }
  return { view: 'dashboard' }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash())
  useEffect(() => {
    const handler = () => setRoute(parseHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
  return route
}

export function navigateTo(hash: string): void {
  window.location.hash = hash
}

export function openCourse(courseId: string): void {
  navigateTo(`/course/${encodeURIComponent(courseId)}`)
}

export function openDashboard(): void {
  navigateTo('/')
}
