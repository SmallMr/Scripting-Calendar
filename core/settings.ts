import { Storage } from 'scripting'

export type WeekStart = 'sunday' | 'monday'

export type CalendarSettings = {
  background: string
  weekStart: WeekStart
}

export const DEFAULT_SETTINGS: CalendarSettings = {
  background: '#F8F8FA',
  weekStart: 'sunday'
}

const SETTINGS_KEY = 'calendar-settings'

export function readSettings(): CalendarSettings {
  let saved: Partial<CalendarSettings> = {}
  try {
    saved = Storage.get<Partial<CalendarSettings>>(SETTINGS_KEY) ?? {}
  } catch (error) {
    console.error(error)
  }
  return {
    background:
      typeof saved.background === 'string' && saved.background.trim()
        ? saved.background
        : DEFAULT_SETTINGS.background,
    weekStart: saved.weekStart === 'monday' ? 'monday' : 'sunday'
  }
}

export function writeSettings(settings: CalendarSettings) {
  try {
    Storage.set(SETTINGS_KEY, settings)
  } catch (error) {
    console.error(error)
  }
}
