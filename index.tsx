import {
  Button,
  HStack,
  Navigation,
  ScrollView,
  Script,
  Spacer,
  Storage,
  Text,
  TextField,
  VStack,
  Widget,
  fetch,
  useEffect,
  useState
} from 'scripting'

const VERSION = '1.0.5'
const SETTINGS_KEY = 'calendar-settings'
const HOLIDAY_PREFIX = 'calendar-holidays-'

type WeekStart = 'sunday' | 'monday'
type CalendarSettings = { background: string; weekStart: WeekStart }
type HolidayMarker = 'rest' | 'work' | 'none'
type HolidayYearData = {
  year: number
  rest: string[]
  work: string[]
  updatedAt: number
  source: 'online' | 'manual'
  provider?: string
}

const PRESETS = [
  { color: '#F8F8FA', label: '云白' },
  { color: '#FFFFFF', label: '纯白' },
  { color: '#FAF7F1', label: '米白' },
  { color: '#F1F6F8', label: '雾蓝' }
]

const WEEKDAYS = {
  sunday: ['日', '一', '二', '三', '四', '五', '六'],
  monday: ['一', '二', '三', '四', '五', '六', '日']
}

console.log(`[calendar] index ${VERSION} loaded`)

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`
}

function isWeekend(date: Date) {
  const day = date.getDay()
  return day === 0 || day === 6
}

function readSettings(): CalendarSettings {
  const saved = Storage.get<Partial<CalendarSettings>>(SETTINGS_KEY) ?? {}
  return {
    background:
      typeof saved.background === 'string' && saved.background.trim()
        ? saved.background
        : '#F8F8FA',
    weekStart: saved.weekStart === 'monday' ? 'monday' : 'sunday'
  }
}

function writeSettings(settings: CalendarSettings) {
  Storage.set(SETTINGS_KEY, settings)
}

function holidayKey(year: number) {
  return `${HOLIDAY_PREFIX}${year}`
}

function uniqueSorted(values: string[], year: number) {
  return Array.from(
    new Set(
      values.filter(
        (value) =>
          typeof value === 'string' &&
          value.startsWith(`${year}-`) &&
          /^\d{4}-\d{2}-\d{2}$/.test(value)
      )
    )
  ).sort()
}

function readHolidayYear(year: number): HolidayYearData | null {
  const saved = Storage.get<HolidayYearData>(holidayKey(year))
  if (!saved || saved.year !== year) return null
  return {
    year,
    rest: uniqueSorted(Array.isArray(saved.rest) ? saved.rest : [], year),
    work: uniqueSorted(Array.isArray(saved.work) ? saved.work : [], year),
    updatedAt: Number(saved.updatedAt) || 0,
    source: saved.source === 'online' ? 'online' : 'manual',
    provider: typeof saved.provider === 'string' ? saved.provider : undefined
  }
}

function writeHolidayYear(data: HolidayYearData) {
  Storage.set(holidayKey(data.year), {
    ...data,
    rest: uniqueSorted(data.rest, data.year),
    work: uniqueSorted(data.work, data.year)
  })
}

function makeWeekendYear(
  year: number,
  source: 'online' | 'manual' = 'manual'
): HolidayYearData {
  const rest: string[] = []
  const cursor = new Date(year, 0, 1, 12)
  while (cursor.getFullYear() === year) {
    if (isWeekend(cursor)) rest.push(dateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return { year, rest, work: [], updatedAt: 0, source }
}

function formatUpdatedAt(timestamp: number) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

type OnlineDay = { date: string; off: boolean }

async function requestJson(url: string) {
  const response = await fetch(url, {
    timeout: 18,
    headers: { Accept: 'application/json' },
    debugLabel: 'Calendar holidays'
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

async function fetchFromTimor(year: number) {
  const payload = await requestJson(
    `https://timor.tech/api/holiday/year/${year}`
  )
  if (!payload || payload.code !== 0 || !payload.holiday) {
    throw new Error('接口未返回有效数据')
  }
  const days: OnlineDay[] = []
  for (const value of Object.values<any>(payload.holiday)) {
    const key = typeof value?.date === 'string' ? value.date : ''
    if (!key.startsWith(`${year}-`) || typeof value?.holiday !== 'boolean') {
      continue
    }
    days.push({ date: key, off: value.holiday })
  }
  if (days.length === 0) throw new Error('接口没有节假日记录')
  return { days, provider: 'timor.tech' }
}

async function fetchFromHolidayCn(year: number) {
  const payload = await requestJson(
    `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`
  )
  if (
    !payload ||
    payload.year !== year ||
    !Array.isArray(payload.days) ||
    payload.days.length === 0
  ) {
    throw new Error('接口未返回有效数据')
  }
  const days: OnlineDay[] = []
  for (const value of payload.days) {
    if (
      typeof value?.date !== 'string' ||
      typeof value?.isOffDay !== 'boolean' ||
      !value.date.startsWith(`${year}-`)
    ) {
      continue
    }
    days.push({ date: value.date, off: value.isOffDay })
  }
  if (days.length === 0) throw new Error('接口没有节假日记录')
  return { days, provider: 'holiday-cn' }
}

async function fetchHolidayYear(year: number): Promise<HolidayYearData> {
  const errors: string[] = []
  let result: { days: OnlineDay[]; provider: string } | null = null

  try {
    result = await fetchFromTimor(year)
  } catch (error) {
    errors.push(`timor.tech: ${String(error)}`)
  }
  if (!result) {
    try {
      result = await fetchFromHolidayCn(year)
    } catch (error) {
      errors.push(`holiday-cn: ${String(error)}`)
    }
  }
  if (!result) throw new Error(`在线获取失败。${errors.join('；')}`)

  const base = makeWeekendYear(year, 'online')
  const rest = new Set(base.rest)
  const work = new Set<string>()
  for (const day of result.days) {
    if (day.off) {
      rest.add(day.date)
      work.delete(day.date)
    } else {
      work.add(day.date)
      rest.delete(day.date)
    }
  }
  return {
    year,
    rest: Array.from(rest).sort(),
    work: Array.from(work).sort(),
    updatedAt: Date.now(),
    source: 'online',
    provider: result.provider
  }
}

type GridCell = {
  key: string
  day: number
  inMonth: boolean
  today: boolean
}

function buildGrid(
  year: number,
  month: number,
  weekStart: WeekStart
): GridCell[] {
  const first = new Date(year, month - 1, 1, 12)
  const offset =
    weekStart === 'monday' ? (first.getDay() + 6) % 7 : first.getDay()
  const todayKey = dateKey(new Date())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month - 1, 1 - offset + index, 12)
    const key = dateKey(date)
    return {
      key,
      day: date.getDate(),
      inMonth: date.getFullYear() === year && date.getMonth() === month - 1,
      today: key === todayKey
    }
  })
}

function markerFor(data: HolidayYearData, key: string): HolidayMarker {
  if (data.work.includes(key)) return 'work'
  if (data.rest.includes(key)) return 'rest'
  return 'none'
}

function Block({ title, children }: { title: string; children?: any }) {
  return (
    <VStack alignment="leading" spacing={8} frame={{ maxWidth: 'infinity' }}>
      <Text font={13} fontWeight="semibold" foregroundStyle="secondaryLabel">
        {title}
      </Text>
      {children}
    </VStack>
  )
}

export function SettingsView() {
  const thisYear = new Date().getFullYear()
  const [settings, setSettings] = useState<CalendarSettings>(() =>
    readSettings()
  )
  const [colorDraft, setColorDraft] = useState(settings.background)
  const [holidayYear, setHolidayYear] = useState(thisYear)
  const [saved, setSaved] = useState<HolidayYearData | null>(() =>
    readHolidayYear(thisYear)
  )
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [mode, setMode] = useState<HolidayMarker>('rest')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    writeSettings(settings)
    try {
      Widget.reloadAll()
    } catch (error) {
      console.error(error)
    }
  }, [settings])

  const data = saved ?? makeWeekendYear(holidayYear)

  const applyColor = (value: string) => {
    setColorDraft(value)
    const color = value.trim()
    if (
      /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color) ||
      /^rgba?\(/i.test(color)
    ) {
      setSettings((previous) => ({ ...previous, background: color }))
    }
  }

  const changeYear = (year: number) => {
    setHolidayYear(year)
    setSaved(readHolidayYear(year))
    setStatus('')
  }

  const runFetch = async () => {
    setBusy(true)
    setStatus('正在获取…')
    try {
      const fetched = await fetchHolidayYear(holidayYear)
      writeHolidayYear(fetched)
      setSaved(fetched)
      Widget.reloadAll()
      setStatus(
        `${fetched.year} 年：${fetched.rest.length} 休 / ${fetched.work.length} 班 · ${fetched.provider}`
      )
    } catch (error) {
      console.error(error)
      setStatus(`获取失败：${String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const editDay = (key: string) => {
    const rest = new Set(data.rest)
    const work = new Set(data.work)
    if (mode === 'rest') {
      rest.add(key)
      work.delete(key)
    } else if (mode === 'work') {
      work.add(key)
      rest.delete(key)
    } else {
      rest.delete(key)
      work.delete(key)
    }
    const next: HolidayYearData = {
      ...data,
      rest: Array.from(rest).sort(),
      work: Array.from(work).sort(),
      source: 'manual',
      updatedAt: Date.now()
    }
    writeHolidayYear(next)
    setSaved(next)
    Widget.reloadAll()
  }

  const cells = buildGrid(holidayYear, month, settings.weekStart)

  return (
    <ScrollView>
      <VStack alignment="leading" spacing={20} padding={16}>
        <VStack alignment="leading" spacing={4}>
          <Text font={22} fontWeight="semibold">
            {`日历 ${VERSION}`}
          </Text>
          <Text font={12} foregroundStyle="secondaryLabel">
            如果能看到这段文字，说明脚本已经正常运行。
          </Text>
        </VStack>

        <Block title="组件背景色">
          <Text font={12} foregroundStyle="secondaryLabel">
            {settings.background}
          </Text>
          <HStack spacing={8}>
            {PRESETS.map((preset) => (
              <Button
                key={preset.color}
                title={preset.label}
                action={() => applyColor(preset.color)}
              />
            ))}
          </HStack>
          <TextField
            title="自定义"
            prompt="#F8F8FA"
            value={colorDraft}
            onChanged={applyColor}
          />
        </Block>

        <Block title="每周起始">
          <HStack spacing={8}>
            <Button
              title={settings.weekStart === 'sunday' ? '✓ 周日' : '周日'}
              action={() =>
                setSettings((previous) => ({
                  ...previous,
                  weekStart: 'sunday'
                }))
              }
            />
            <Button
              title={settings.weekStart === 'monday' ? '✓ 周一' : '周一'}
              action={() =>
                setSettings((previous) => ({
                  ...previous,
                  weekStart: 'monday'
                }))
              }
            />
          </HStack>
        </Block>

        <Block title="节假日数据">
          <HStack spacing={8}>
            <Button
              title={holidayYear === thisYear ? `✓ ${thisYear}` : `${thisYear}`}
              action={() => changeYear(thisYear)}
            />
            <Button
              title={
                holidayYear === thisYear + 1
                  ? `✓ ${thisYear + 1}`
                  : `${thisYear + 1}`
              }
              action={() => changeYear(thisYear + 1)}
            />
          </HStack>

          <Button
            title={busy ? '正在获取…' : `在线获取 ${holidayYear} 年`}
            action={runFetch}
            disabled={busy}
          />

          <Text font={12} foregroundStyle="secondaryLabel">
            {`${data.rest.length} 个休息日 · ${data.work.length} 个补班日`}
          </Text>

          <Text font={12} foregroundStyle="tertiaryLabel">
            {status ||
              (saved
                ? `${saved.source === 'online' ? '在线数据' : '已本地编辑'} · ${formatUpdatedAt(saved.updatedAt)}`
                : '尚未在线获取，当前只按普通周末显示')}
          </Text>
        </Block>

        <Block title="逐日标记">
          <HStack spacing={8}>
            <Button
              title={mode === 'rest' ? '✓ 休' : '休'}
              action={() => setMode('rest')}
            />
            <Button
              title={mode === 'work' ? '✓ 班' : '班'}
              action={() => setMode('work')}
            />
            <Button
              title={mode === 'none' ? '✓ 清除' : '清除'}
              action={() => setMode('none')}
            />
          </HStack>

          <Button
            title={editing ? '收起日历' : '展开日历'}
            action={() => setEditing(!editing)}
          />

          {editing ? (
            <VStack
              alignment="leading"
              spacing={6}
              frame={{ maxWidth: 'infinity' }}
            >
              <HStack spacing={8}>
                <Button
                  title="‹ 上个月"
                  action={() => {
                    const next = new Date(holidayYear, month - 2, 1)
                    setMonth(next.getMonth() + 1)
                  }}
                />
                <Text fontWeight="semibold">
                  {`${holidayYear} 年 ${month} 月`}
                </Text>
                <Button
                  title="下个月 ›"
                  action={() => {
                    const next = new Date(holidayYear, month, 1)
                    setMonth(next.getMonth() + 1)
                  }}
                />
              </HStack>

              <HStack spacing={0}>
                {WEEKDAYS[settings.weekStart].map((label) => (
                  <Text
                    key={label}
                    font={11}
                    foregroundStyle="secondaryLabel"
                    frame={{ maxWidth: 'infinity', alignment: 'center' }}
                  >
                    {label}
                  </Text>
                ))}
              </HStack>

              {Array.from({ length: 6 }, (_, row) => (
                <HStack key={String(row)} spacing={0}>
                  {cells.slice(row * 7, row * 7 + 7).map((cell) => {
                    const marker = cell.inMonth
                      ? markerFor(data, cell.key)
                      : 'none'
                    return (
                      <Button key={cell.key} action={() => editDay(cell.key)}>
                        <VStack
                          alignment="center"
                          spacing={0}
                          frame={{ maxWidth: 'infinity' }}
                        >
                          <Text
                            font={15}
                            foregroundStyle={
                              cell.inMonth
                                ? cell.today
                                  ? '#E65356'
                                  : 'label'
                                : 'tertiaryLabel'
                            }
                          >
                            {String(cell.day)}
                          </Text>
                          <Text font={9} foregroundStyle="tertiaryLabel">
                            {marker === 'rest'
                              ? '休'
                              : marker === 'work'
                                ? '班'
                                : ' '}
                          </Text>
                        </VStack>
                      </Button>
                    )
                  })}
                </HStack>
              ))}
            </VStack>
          ) : null}
        </Block>

        <Block title="预览">
          <Button
            title="预览小组件"
            action={async () => {
              try {
                await Widget.preview()
              } catch (error) {
                console.error(error)
                setStatus(`预览失败：${String(error)}`)
              }
            }}
          />
        </Block>

        <HStack>
          <Spacer />
          <Text font={11} foregroundStyle="tertiaryLabel">
            {`v${VERSION}`}
          </Text>
        </HStack>
      </VStack>
    </ScrollView>
  )
}

async function main() {
  console.log('[calendar] presenting settings')
  try {
    await Navigation.present({ element: <SettingsView /> })
  } catch (error) {
    console.error(error)
  } finally {
    Script.exit()
  }
}

main()
