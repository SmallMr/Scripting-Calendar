import { Text, VStack, Widget } from 'scripting'
import { getEffectiveHolidayYear } from './core/holidays'
import { readMonthCursor } from './core/monthState'
import { readSettings } from './core/settings'
import { CalendarWidget } from './ui/calendarWidget'

function nextMidnight() {
  const now = new Date()
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    3,
    0
  )
}

const reloadPolicy = {
  policy: 'after',
  date: nextMidnight()
} as const

try {
  const settings = readSettings()
  const cursor = readMonthCursor()
  const now = new Date()
  const year = cursor?.year ?? now.getFullYear()
  const holidays = getEffectiveHolidayYear(year)

  Widget.present(
    <CalendarWidget
      settings={settings}
      cursor={cursor}
      holidays={holidays}
    />,
    reloadPolicy
  )
} catch (error) {
  console.error(error)
  Widget.present(
    <VStack
      alignment="leading"
      spacing={6}
      padding={14}
      frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
      widgetBackground="#F8F8FA"
    >
      <Text font={14} fontWeight="semibold" foregroundStyle="#1C1C1E">
        日历加载失败
      </Text>
      <Text font={10} foregroundStyle="#707075" lineLimit={3}>
        {String(error)}
      </Text>
    </VStack>,
    reloadPolicy
  )
}
