// Google Calendar has 11 fixed event color IDs. We map each COURSE_COLORS
// swatch to the visually-closest calendar color. Anything not in the map
// falls back to the calendar's default color (undefined colorId).
export const COURSE_COLOR_TO_CALENDAR: Record<string, string> = {
  '#F9A8D4': '4', // Flamingo
  '#F472B6': '4', // Flamingo
  '#F0ABFC': '3', // Grape
  '#C4B5FD': '1', // Lavender
  '#FCA5A5': '4', // Flamingo
  '#FDBA74': '6', // Tangerine
  '#FCD34D': '5', // Banana
  '#86EFAC': '2', // Sage
  '#67E8F9': '7', // Peacock
  '#A5B4FC': '9'  // Blueberry
}

export function calendarColorFor(courseColor: string | undefined): string | undefined {
  if (!courseColor) return undefined
  return COURSE_COLOR_TO_CALENDAR[courseColor.toUpperCase()] ?? COURSE_COLOR_TO_CALENDAR[courseColor]
}
