import {
  Button,
  Navigation,
  NavigationStack,
  Script,
  Text,
  VStack
} from 'scripting'
import { SettingsScreen } from './app/preferences'

const VERSION = '1.0.6'

console.log(`[calendar] index ${VERSION} loaded`)

function LaunchPad() {
  const openSettings = async () => {
    try {
      await Navigation.present({ element: <SettingsScreen /> })
    } catch (error) {
      console.error(error)
      try {
        await Dialog.alert({ title: '打开设置失败', message: String(error) })
      } catch {}
    }
  }

  return (
    <NavigationStack>
      <VStack
        alignment="leading"
        spacing={12}
        padding={20}
        navigationTitle="日历"
      >
        <Text font={20} fontWeight="semibold">
          {`日历 ${VERSION}`}
        </Text>
        <Text font={13} foregroundStyle="secondaryLabel">
          这一段能显示，说明脚本本身没问题。点下面的按钮进入设置。
        </Text>
        <Button title="打开设置" action={openSettings} />
      </VStack>
    </NavigationStack>
  )
}

async function main() {
  console.log('[calendar] presenting launch pad')
  await Navigation.present({ element: <LaunchPad /> })
  Script.exit()
}

main()
