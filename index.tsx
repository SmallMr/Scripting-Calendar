import { Navigation, Script } from 'scripting'
import { SettingsScreen } from './app/preferences'

async function main() {
  try {
    await Navigation.present({ element: <SettingsScreen /> })
  } catch (error) {
    console.error(error)
    try {
      await Dialog.alert({
        title: '日历打开失败',
        message: String(error)
      })
    } catch {}
  } finally {
    Script.exit()
  }
}

main().catch(async (error) => {
  console.error(error)
  try {
    await Dialog.alert({
      title: '日历启动失败',
      message: String(error)
    })
  } catch {}
})
