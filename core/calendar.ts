import solarLunar from '../vendor/solarlunar'
import {
  dateKey,
  getWeekLabels,
  isWeekend,
  pad2,
  sameDay
} from './dateUtils'
import type { WeekStart } from './settings'

export {
  dateFromKey,
  dateKey,
  getWeekLabels,
  isWeekend,
  pad2,
  sameDay,
  WEEKDAYS_MONDAY,
  WEEKDAYS_SUNDAY
} from './dateUtils'

export type SolarLunarResult = {
  lYear: number
  lMonth: number
  lDay: number
  animal: string
  yearCn: string
  monthCn: string
  dayCn: string
  cYear: number
  cMonth: number
  cDay: number
  gzYear: string
  gzMonth: string
  gzDay: string
  isToday: boolean
  isLeap: boolean
  nWeek: number
  ncWeek: string
  isTerm: boolean
  term: string
}

type SolarLunarApi = {
  solar2lunar(
    year: number,
    month: number,
    day: number
  ): SolarLunarResult | -1
  getFestivals(year: number, month: number, day: number): string[]
}

const lunarApi = solarLunar as SolarLunarApi

export type CalendarCell = {
  date: Date
  key: string
  day: number
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean
  lunar: SolarLunarResult | null
  eventLabel: string
}

const SOLAR_FESTIVALS: Record<string, string> = {
  '01-01': '元旦',
  '05-01': '劳动节',
  '10-01': '国庆节'
}

const FESTIVAL_NAMES: Record<string, string> = {
  元宵节: '元宵',
  端午节: '端午',
  七夕节: '七夕',
  中秋节: '中秋',
  重阳节: '重阳',
  腊八节: '腊八',
  小年: '小年'
}

const LUNAR_FESTIVALS: Record<string, string> = {
  '1-1': '春节',
  '1-15': '元宵',
  '2-2': '龙抬头',
  '5-5': '端午',
  '7-7': '七夕',
  '7-15': '中元',
  '8-15': '中秋',
  '9-9': '重阳',
  '10-1': '寒衣节',
  '10-15': '下元',
  '12-8': '腊八',
  '12-23': '小年'
}

export function getLunar(date: Date): SolarLunarResult | null {
  const result = lunarApi.solar2lunar(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  )
  return result === -1 ? null : result
}

function normalizeFestival(name: string) {
  if (!name || name === '农历新年') return ''
  return FESTIVAL_NAMES[name] ?? name
}

function getLunarFestival(date: Date, lunar: SolarLunarResult) {
  if (!lunar.isLeap) {
    const fixed = LUNAR_FESTIVALS[`${lunar.lMonth}-${lunar.lDay}`]
    if (fixed) return fixed
  }

  const festivals = lunarApi.getFestivals(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  )
  for (const name of festivals) {
    const normalized = normalizeFestival(name)
    if (normalized) return normalized
  }

  if (lunar.lMonth === 12 && lunar.lDay >= 29) {
    const tomorrow = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + 1,
      12
    )
    const nextLunar = getLunar(tomorrow)
    if (
      nextLunar &&
      nextLunar.lMonth === 1 &&
      nextLunar.lDay === 1 &&
      !nextLunar.isLeap
    ) {
      return '除夕'
    }
  }
  return ''
}

export function getEventLabel(date: Date, lunar: SolarLunarResult | null) {
  if (!lunar) return ''
  if (lunar.isTerm && lunar.term) return lunar.term

  const lunarFestival = getLunarFestival(date, lunar)
  if (lunarFestival) return lunarFestival

  return (
    SOLAR_FESTIVALS[
      `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
    ] ?? ''
  )
}

export function buildMonthGrid(
  year: number,
  month: number,
  weekStart: WeekStart
): CalendarCell[] {
  const first = new Date(year, month - 1, 1, 12)
  const startOffset =
    weekStart === 'monday'
      ? (first.getDay() + 6) % 7
      : first.getDay()
  const gridStart = new Date(year, month - 1, 1 - startOffset, 12)
  const today = new Date()

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
      12
    )
    const lunar = getLunar(date)
    return {
      date,
      key: dateKey(date),
      day: date.getDate(),
      isCurrentMonth:
        date.getFullYear() === year && date.getMonth() === month - 1,
      isToday: sameDay(date, today),
      isWeekend: isWeekend(date),
      lunar,
      eventLabel: getEventLabel(date, lunar)
    }
  })
}

export function getWeekNumber(date: Date) {
  const year = date.getFullYear()
  const dayOfYear =
    Math.floor(
      (Date.UTC(year, date.getMonth(), date.getDate()) -
        Date.UTC(year, 0, 1)) /
        86400000
    ) + 1
  return Math.ceil(dayOfYear / 7)
}

export function getFooterParts(date: Date) {
  const lunar = getLunar(date)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const week = getWeekNumber(date)
  if (!lunar) {
    return {
      dateLabel: `${month}月${day}日`,
      detailLabel: `第${week}周`
    }
  }
  return {
    dateLabel: `${month}月${day}日`,
    detailLabel: `第${week}周 · ${lunar.gzYear}(${lunar.animal})年 ${lunar.monthCn}${lunar.dayCn}`
  }
}

export function getLunarDayLabel(lunar: SolarLunarResult | null) {
  return lunar?.dayCn ?? ''
}
