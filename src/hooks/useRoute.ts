import { useEffect, useState } from 'react'

export type Route =
  | { view: 'dashboard' }
  | { view: 'course'; courseId: string }
  | { view: 'time' }
  | { view: 'plan' }

function parseHash(): Route {
  const hash = window.location.hash.slice(1)
  const course = hash.match(/^\/course\/(.+)$/)
  if (course) return { view: 'course', courseId: decodeURIComponent(course[1]) }
  if (hash === '/time') return { view: 'time' }
  if (hash === '/plan') return { view: 'plan' }
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

export function openTime(): void {
  navigateTo('/time')
}

export function openPlan(): void {
  navigateTo('/plan')
}
