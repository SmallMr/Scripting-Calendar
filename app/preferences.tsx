import {
  Button,
  HStack,
  List,
  Navigation,
  NavigationStack,
  Picker,
  Section,
  Spacer,
  Text,
  TextField,
  VStack,
  Widget,
  useEffect,
  useState
} from 'scripting'
import { dateKey, getWeekLabels } from '../core/dateUtils'
import {
  applyHolidayMarker,
  clearHolidayYear,
  fetchHolidayYear,
  formatUpdatedAt,
  makeWeekendHolidayYear,
  readHolidayYear,
  writeHolidayYear
} from '../core/holidays'
import type { HolidayMarker, HolidayYearData } from '../core/holidays'
import { readSettings, writeSettings } from '../core/settings'
import type { CalendarSettings, WeekStart } from '../core/settings'

const BUILD_TAG = 'v1.0.4'

console.log('[calendar] preferences module loaded')

const BACKGROUND_PRESETS = [
  { color: '#F8F8FA', label: '云白' },
  { color: '#FFFFFF', label: '纯白' },
  { color: '#FAF7F1', label: '米白' },
  { color: '#F1F6F8', label: '雾蓝' }
]

const EDITOR_MODES: { value: HolidayMarker; label: string }[] = [
  { value: 'rest', label: '休息日（休）' },
  { value: 'work', label: '补班日（班）' },
  { value: 'none', label: '清除标记' }
]

type EditorCell = {
  key: string
  day: number
  isCurrentMonth: boolean
  isToday: boolean
}

function buildEditorGrid(
  year: number,
  month: number,
  weekStart: WeekStart
): EditorCell[] {
  const first = new Date(year, month - 1, 1, 12)
  const startOffset =
    weekStart === 'monday'
      ? (first.getDay() + 6) % 7
      : first.getDay()
  const todayKey = dateKey(new Date())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month - 1, 1 - startOffset + index, 12)
    const key = dateKey(date)
    return {
      key,
      day: date.getDate(),
      isCurrentMonth:
        date.getFullYear() === year && date.getMonth() === month - 1,
      isToday: key === todayKey
    }
  })
}

function isValidBackgroundColor(value: string) {
  const color = value.trim()
  return (
    /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color) ||
    /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)$/i.test(
      color
    )
  )
}

function markerOf(data: HolidayYearData, key: string): HolidayMarker {
  if (data.work.includes(key)) return 'work'
  if (data.rest.includes(key)) return 'rest'
  return 'none'
}

function EditorGrid({
  year,
  month,
  weekStart,
  data,
  onPressed
}: {
  year: number
  month: number
  weekStart: WeekStart
  data: HolidayYearData
  onPressed: (key: string) => void
}) {
  const cells = buildEditorGrid(year, month, weekStart)
  const labels = getWeekLabels(weekStart)
  return (
    <VStack alignment="leading" spacing={0}>
      <HStack spacing={0}>
        {labels.map((label) => (
          <Text
            key={label}
            font={10.5}
            foregroundStyle="secondaryLabel"
            lineLimit={1}
            frame={{ maxWidth: 'infinity', alignment: 'center' }}
          >
            {label}
          </Text>
        ))}
      </HStack>
      {Array.from({ length: 6 }, (_, row) => (
        <HStack key={String(row)} spacing={0}>
          {cells.slice(row * 7, row * 7 + 7).map((cell) => {
            const marker = cell.isCurrentMonth
              ? markerOf(data, cell.key)
              : 'none'
            return (
              <Button
                key={cell.key}
                action={() => onPressed(cell.key)}
                buttonStyle="borderless"
              >
                <VStack
                  alignment="center"
                  spacing={0}
                  frame={{ maxWidth: 'infinity' }}
                >
                  <Text
                    font={15}
                    fontWeight={cell.isToday ? 'semibold' : 'regular'}
                    foregroundStyle={
                      !cell.isCurrentMonth
                        ? 'tertiaryLabel'
                        : cell.isToday
                          ? '#E65356'
                          : 'label'
                    }
                    lineLimit={1}
                  >
                    {String(cell.day)}
                  </Text>
                  <Text
                    font={9}
                    foregroundStyle={
                      marker === 'rest'
                        ? '#E65356'
                        : marker === 'work'
                          ? '#455B6B'
                          : 'tertiaryLabel'
                    }
                    lineLimit={1}
                  >
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
  )
}

export function SettingsScreen() {
  const dismiss = Navigation.useDismiss()
  const thisYear = new Date().getFullYear()
  const [settings, setSettings] = useState<CalendarSettings>(() =>
    readSettings()
  )
  const [colorDraft, setColorDraft] = useState(settings.background)
  const [holidayYear, setHolidayYear] = useState(thisYear)
  const [savedHolidays, setSavedHolidays] =
    useState<HolidayYearData | null>(() => readHolidayYear(thisYear))
  const [editorMonth, setEditorMonth] = useState(
    () => new Date().getMonth() + 1
  )
  const [editorMode, setEditorMode] = useState<HolidayMarker>('rest')
  const [fetching, setFetching] = useState(false)
  const [editorExpanded, setEditorExpanded] = useState(false)

  useEffect(() => {
    writeSettings(settings)
    try {
      Widget.reloadAll()
    } catch (error) {
      console.error(error)
    }
  }, [settings])

  const patch = (changes: Partial<CalendarSettings>) =>
    setSettings((previous) => ({ ...previous, ...changes }))

  const applyBackground = (background: string) => {
    setColorDraft(background)
    if (isValidBackgroundColor(background)) {
      patch({ background: background.trim() })
    }
  }

  const holidayData =
    savedHolidays ?? makeWeekendHolidayYear(holidayYear)

  const handleYearChange = (value: string) => {
    const nextYear = Number(value)
    setHolidayYear(nextYear)
    setSavedHolidays(readHolidayYear(nextYear))
  }

  const handleFetch = async () => {
    setFetching(true)
    try {
      const fetched = await fetchHolidayYear(holidayYear)
      writeHolidayYear(fetched)
      setSavedHolidays(fetched)
      Widget.reloadAll()
      await Dialog.alert({
        title: '节假日已更新',
        message: `${holidayYear} 年：${fetched.rest.length} 个休息日、${fetched.work.length} 个补班日。来源：${fetched.provider ?? '在线数据'}`
      })
    } catch (error) {
      console.error(error)
      await Dialog.alert({
        title: '获取失败',
        message: String(error)
      })
    } finally {
      setFetching(false)
    }
  }

  const handleEditDay = (key: string) => {
    const next = applyHolidayMarker(holidayData, key, editorMode)
    writeHolidayYear(next)
    setSavedHolidays(next)
    Widget.reloadAll()
  }

  const handleClearYear = async () => {
    const confirmed = await Dialog.confirm({
      title: `清除 ${holidayYear} 年配置`,
      message: '清除后该年只按普通周末显示休息日，法定节假日与补班标记会消失。',
      cancelLabel: '取消',
      confirmLabel: '清除'
    })
    if (!confirmed) return
    clearHolidayYear(holidayYear)
    setSavedHolidays(null)
    Widget.reloadAll()
  }

  const previewWidget = async () => {
    try {
      await Widget.preview()
    } catch (error) {
      console.error(error)
    }
  }

  const sourceText = savedHolidays
    ? savedHolidays.source === 'online'
      ? `在线获取 · ${savedHolidays.provider ?? '节假日接口'}`
      : '已本地编辑'
    : '尚未在线获取，当前按普通周末显示'

  return (
    <NavigationStack>
      <List
        navigationTitle="日历"
        toolbar={{
          cancellationAction: <Button title="完成" action={dismiss} />
        }}
      >
        <Section
          header={<Text>{`外观 · ${BUILD_TAG}`}</Text>}
          footer={
            <Text>
              底色只作用于整块小组件，不会给每个日期格单独加背景或边框。
            </Text>
          }
        >
          <HStack>
            <Text>组件背景色</Text>
            <Spacer />
            <Text font={12} foregroundStyle="secondaryLabel">
              {settings.background}
            </Text>
          </HStack>

          <HStack spacing={8}>
            {BACKGROUND_PRESETS.map((preset) => (
              <Button
                key={preset.color}
                title={preset.label}
                buttonStyle="borderless"
                action={() => applyBackground(preset.color)}
              />
            ))}
          </HStack>

          <TextField
            title="自定义背景"
            prompt="#F8F8FA"
            value={colorDraft}
            onChanged={applyBackground}
          />
        </Section>

        <Section
          header={<Text>日历</Text>}
          footer={
            <Text>
              切换每周起始后，表头和日期会立即按新顺序排列。点击组件顶部月份可回到本月。
            </Text>
          }
        >
          <Picker
            title="每周起始"
            value={settings.weekStart}
            onChanged={(value: string) =>
              patch({ weekStart: value as WeekStart })
            }
          >
            <Text tag="sunday">周日</Text>
            <Text tag="monday">周一</Text>
          </Picker>

          <Text font={12} foregroundStyle="secondaryLabel">
            休息日右上角标「休」，补班日右上角标「班」。
          </Text>
        </Section>

        <Section
          header={<Text>节假日数据</Text>}
          footer={
            <Text>
              数据按年在线获取并保存在本机。重新获取会覆盖该年的本地修改；接口失败时保留原配置。
            </Text>
          }
        >
          <Picker
            title="配置年份"
            value={String(holidayYear)}
            onChanged={handleYearChange}
          >
            <Text tag={String(thisYear)}>{thisYear} 年</Text>
            <Text tag={String(thisYear + 1)}>{thisYear + 1} 年</Text>
          </Picker>

          <Button
            title={
              fetching
                ? `正在获取 ${holidayYear} 年…`
                : `在线获取 ${holidayYear} 年`
            }
            action={handleFetch}
            disabled={fetching}
          />

          <HStack>
            <Text>{`${holidayData.rest.length} 个休息日`}</Text>
            <Spacer />
            <Text>{`${holidayData.work.length} 个补班日`}</Text>
          </HStack>

          <Text font={12} foregroundStyle="secondaryLabel">
            {sourceText}
          </Text>

          {savedHolidays?.updatedAt ? (
            <Text font={12} foregroundStyle="tertiaryLabel">
              {`更新于 ${formatUpdatedAt(savedHolidays.updatedAt)}`}
            </Text>
          ) : null}
        </Section>

        <Section
          header={<Text>逐日配置</Text>}
          footer={
            <Text>
              先选好下方动作，再点日期。休息日包含周末；同一天不会同时显示休息与补班。
            </Text>
          }
        >
          {editorExpanded ? (
            <VStack alignment="leading" spacing={8}>
              <Picker
                title="编辑月份"
                value={String(editorMonth)}
                onChanged={(value: string) =>
                  setEditorMonth(Number(value))
                }
              >
                {Array.from({ length: 12 }, (_, index) => (
                  <Text key={String(index + 1)} tag={String(index + 1)}>
                    {`${index + 1} 月`}
                  </Text>
                ))}
              </Picker>

              <Picker
                title="点按日期时"
                value={editorMode}
                onChanged={(value: string) =>
                  setEditorMode(value as HolidayMarker)
                }
              >
                {EDITOR_MODES.map((mode) => (
                  <Text key={mode.value} tag={mode.value}>
                    {mode.label}
                  </Text>
                ))}
              </Picker>

              <EditorGrid
                year={holidayYear}
                month={editorMonth}
                weekStart={settings.weekStart}
                data={holidayData}
                onPressed={handleEditDay}
              />

              <Button
                title="收起逐日配置"
                action={() => setEditorExpanded(false)}
              />
            </VStack>
          ) : (
            <Button
              title="打开逐日配置"
              action={() => setEditorExpanded(true)}
            />
          )}

          <Button
            title={`清除 ${holidayYear} 年配置`}
            role="destructive"
            action={handleClearYear}
          />
        </Section>

        <Section
          header={<Text>预览</Text>}
          footer={
            <Text>
              首次使用请先在线获取本年与下一年的节假日，再到桌面添加大号组件。
            </Text>
          }
        >
          <Button title="预览小组件" action={previewWidget} />
        </Section>
      </List>
    </NavigationStack>
  )
}
