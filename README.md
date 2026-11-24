# Scripting Calendar

Scripting 桌面日历小组件：公历、农历、节气与节日、休息日和补班日。

当前版本：`1.0.8`（打开脚本直接进入设置页，「外观」分组标题显示 `外观 · v1.0.8`）。

## 只有一个脚本

本项目始终以**同一个**「日历 / Calendar」脚本维护。更新时只替换这个脚本里的文件，
不要再导入第二个脚本。

### 更新已安装的脚本

1. 在 Scripting 里打开已安装的「日历」脚本。
2. 进入该脚本的设置，把「远程来源」设为 `https://github.com/SmallMr/Scripting-Calendar`。
3. 点「检查更新」并等待文件替换完成，然后重新打开脚本。
4. 看到「外观 · v1.0.8」即表示已更新到这个版本。

### 首次安装

只有从未安装过时才需要导入：
[一键导入 Scripting Calendar](https://www.scripting.fun/import_scripts/?urls=%5B%22https%3A%2F%2Fraw.githubusercontent.com%2FSmallMr%2FScripting-Calendar%2Fmain%2FScripting-Calendar.scripting%22%5D)

### 启用

1. 打开脚本，先在「节假日数据」里分别选择本年、下一年并点「在线获取」。
2. 到桌面添加大号小组件。

获取失败的年份不会猜测法定节假日；未获取时仅按普通周六、周日显示休息日。获取成功后数据保存在本机，可以继续逐日修改。

## 功能

- 顶部左右箭头切换月份，点击月份标题回到本月。
- 整块组件背景色可调整，提供云白、纯白、米白、雾蓝预设和十六进制颜色输入。
- 每周可从周日或周一开始。
- 非本月日期降为浅色，不显示休息、补班和节日角标。
- 休息日右上角显示「休」，补班日右上角显示「班」。
- 今天用红色胶囊同时圈住公历日期和农历日期。
- 节气、传统节日使用淡雾蓝，不抢主日期层级。
- 大号组件的比例按约 `338 × 354` 的桌面尺寸设计，并随实际组件宽度等比缩放。

## 节假日数据

数据按年保存在本机，存储键为 `calendar-holidays-YYYY`。每年的配置包含：

- 所有休息日（包括普通周末与法定休息日）
- 所有补班日
- 获取时间、来源和是否经过本地编辑

在线获取顺序：

1. `https://timor.tech/api/holiday/year/YYYY`
2. `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/YYYY.json`

两个在线源都失败时只报错，不写入内置节假日兜底表。重新在线获取会覆盖该年的本地修改。

## 配置

「逐日配置」支持休息日、补班日和清除标记三种动作：

- 休息：加入休息日，并从补班日移除。
- 补班：加入补班日，并从休息日移除。
- 清除：从休息日和补班日同时移除。

清除整年配置后，会回到“仅按普通周末显示”的状态。

## 目录

```text
.
├── index.tsx                设置页入口
├── widget.tsx               桌面组件入口
├── app_intents.tsx          上一月、下一月、回到本月
├── app/preferences.tsx      设置页（按国网脚本的 List/Section 结构）
├── core/
│   ├── calendar.ts          月历、农历、节气、节日
│   ├── dateUtils.ts         日期与每周起始工具
│   ├── holidays.ts          在线获取、本地缓存和逐日编辑
│   ├── monthState.ts        当前查看月份
│   └── settings.ts          背景色与每周起始
├── ui/
│   ├── calendarWidget.tsx   桌面组件界面
│   └── theme.ts             明暗底色适配
├── vendor/
│   ├── solarlunar.ts        农历与节气计算
│   └── LICENSE.solarlunar
└── scripts/package.ps1      生成 .scripting 包
```

## 开发

```powershell
npm install
npm run typecheck
npm run package
```

`.scripting` 是 ZIP 文件。打包脚本只收录运行时需要的文件。

## 第三方

农历、干支、生肖和二十四节气使用
[`solarlunar`](https://www.npmjs.com/package/solarlunar)，其许可证见
`vendor/LICENSE.solarlunar`。
