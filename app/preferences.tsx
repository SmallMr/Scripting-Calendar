import {
  Button,
  HStack,
  List,
  Navigation,
  NavigationStack,
  Picker,
  ProgressView,
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

const VERSION = '1.0.7'

const PRESETS = [
  { color: '#F8F8FA', label: '云白' },
  { color: '#FFFFFF', label: '纯白' },
  { color: '#FAF7F1', label: '米白' },
  { color: '#F1F6F8', label: '雾蓝' }
]

const CUSTOM_TAG = 'custom'

const EDITOR_MODES: { value: HolidayMarker; label: string }[] = [
  { value: 'rest', label: '休息日（休）' },
  { value: 'work', label: '补班日（班）' },
  { value: 'none', label: '清除标记' }
]

type EditorCell = {
  key: string
  day: number
  inMonth: boolean
  today: boolean
}

function isValidColor(value: string) {
  const color = value.trim()
  return (
    /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color) ||
    /^rgba?\(/i.test(color)
  )
}

function buildGrid(
  year: number,
  month: number,
  weekStart: WeekStart
): EditorCell[] {
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
  const cells = buildGrid(year, month, weekStart)
  const labels = getWeekLabels(weekStart)
  return (
    <VStack alignment="leading" spacing={0}>
      <HStack spacing={0}>
        {labels.map((label) => (
          <Text
            key={label}
            font={10.5}
            foregroundStyle="secondaryLabel"
            frame={{ maxWidth: 'infinity', alignment: 'center' }}
          >
            {label}
          </Text>
        ))}
      </HStack>
      {Array.from({ length: 6 }, (_, row) => (
        <HStack key={String(row)} spacing={0}>
          {cells.slice(row * 7, row * 7 + 7).map((cell) => (
            <Button key={cell.key} action={() => onPressed(cell.key)}>
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
                  {markerFor(data, cell.key) === 'rest'
                    ? '休'
                    : markerFor(data, cell.key) === 'work'
                      ? '班'
                      : ' '}
                </Text>
              </VStack>
            </Button>
          ))}
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
  const [saved, setSaved] = useState<HolidayYearData | null>(() =>
    readHolidayYear(thisYear)
  )
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

  const presetValue =
    PRESETS.find(
      (preset) =>
        preset.color.toLowerCase() === settings.background.toLowerCase()
    )?.color ?? CUSTOM_TAG

  const changeColor = (value: string) => {
    setColorDraft(value)
    if (isValidColor(value)) {
      patch({ background: value.trim() })
    }
  }

  const data = saved ?? makeWeekendHolidayYear(holidayYear)

  const handleYearChange = (value: string) => {
    const nextYear = Number(value)
    setHolidayYear(nextYear)
    setSaved(readHolidayYear(nextYear))
  }

  const handleFetch = async () => {
    setFetching(true)
    try {
      const fetched = await fetchHolidayYear(holidayYear)
      writeHolidayYear(fetched)
      setSaved(fetched)
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
    const next = applyHolidayMarker(data, key, editorMode)
    writeHolidayYear(next)
    setSaved(next)
    Widget.reloadAll()
  }

  const handleClearYear = async () => {
    const confirmed = await Dialog.confirm({
      title: `清除 ${holidayYear} 年配置`,
      message: '清除后该年只按普通周末显示休息日。',
      cancelLabel: '取消',
      confirmLabel: '清除'
    })
    if (!confirmed) return
    clearHolidayYear(holidayYear)
    setSaved(null)
    Widget.reloadAll()
  }

  const openWidgetPreview = async () => {
    try {
      await Widget.preview()
    } catch (error) {
      console.error(error)
    }
  }

  const sourceText = saved
    ? saved.source === 'online'
      ? `在线获取 · ${saved.provider ?? '节假日接口'}`
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
          header={<Text>{`外观 · v${VERSION}`}</Text>}
          footer={
            <Text>
              底色作用于整块小组件，不会给每个日期格单独加背景或边框。
            </Text>
          }
        >
          <Picker
            title="组件背景色"
            value={presetValue}
            onChanged={(value: string) => {
              if (value !== CUSTOM_TAG) changeColor(value)
            }}
          >
            {PRESETS.map((preset) => (
              <Text key={preset.color} tag={preset.color}>
                {preset.label}
              </Text>
            ))}
            <Text tag={CUSTOM_TAG}>自定义</Text>
          </Picker>

          <TextField
            title="自定义背景"
            prompt="#F8F8FA"
            value={colorDraft}
            onChanged={changeColor}
          />
        </Section>

        <Section
          header={<Text>日历</Text>}
          footer={
            <Text>
              切换每周起始后，表头和日期立即按新顺序排列。休息日右上角标「休」，补班日右上角标「班」。
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
        </Section>

        <Section
          header={<Text>节假日数据</Text>}
          footer={
            <Text>
              数据按年在线获取并保存在本机，失败时保留原配置。重新获取会覆盖该年的本地修改。
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

          <Button action={handleFetch} disabled={fetching}>
            <HStack>
              <Text>在线获取</Text>
              <Spacer />
              {fetching ? <ProgressView /> : null}
            </HStack>
          </Button>

          <HStack>
            <Text>{`${data.rest.length} 个休息日`}</Text>
            <Spacer />
            <Text>{`${data.work.length} 个补班日`}</Text>
          </HStack>

          <Text font={12} foregroundStyle="secondaryLabel">
            {sourceText}
          </Text>

          {saved?.updatedAt ? (
            <Text font={12} foregroundStyle="tertiaryLabel">
              {`更新于 ${formatUpdatedAt(saved.updatedAt)}`}
            </Text>
          ) : null}
        </Section>

        <Section
          header={<Text>逐日配置</Text>}
          footer={
            <Text>
              先选好下方动作，再点日期。同一天不会同时显示休息与补班。
            </Text>
          }
        >
          <Picker
            title="编辑月份"
            value={String(editorMonth)}
            onChanged={(value: string) => setEditorMonth(Number(value))}
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

          {editorExpanded ? (
            <EditorGrid
              year={holidayYear}
              month={editorMonth}
              weekStart={settings.weekStart}
              data={data}
              onPressed={handleEditDay}
            />
          ) : (
            <Button
              title="打开逐日配置"
              action={() => setEditorExpanded(true)}
            />
          )}

          {editorExpanded ? (
            <Button
              title="收起逐日配置"
              action={() => setEditorExpanded(false)}
            />
          ) : null}

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
          <Button title="预览小组件" action={openWidgetPreview} />
        </Section>
      </List>
    </NavigationStack>
  )
}
