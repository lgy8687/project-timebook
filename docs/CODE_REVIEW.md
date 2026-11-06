# 时间永不停止 · 代码审阅

审阅范围是当前 `main` 上的网页、备份/同步和安卓壳。只读代码，没有改功能。下面每条都能单独动手；建议先做 P0-1 或 P0-2。

## 1. 总体评价

这是一个能用的个人时间账本，不是待办，也不是番茄钟。连续主线、手账空档、一条并行、场景容器、计次事件，这几条产品规则在代码里是分开存的，日切和并行归位也有专门函数，并且已经有回归测试。数据全部放在 `localStorage` 的 `v9_*` 键里，刷新后还在，这个选择适合单人、单机。

真正要小心的是边界，不是文件太大。网页 GitHub Pages、安卓离线包、桌面小组件、Supabase 整包快照，是四份数据，只有 JSON 备份能在网页和安卓之间搬。分类改名、并行归位、同步下载这三处会改到多份存储，但写入名单并不完整。先补这几个写入点，比拆 `app.js` 有用。

## 2. 架构与关键模块地图

入口是 `index.html`。底部四个页面：`#page-record` 流水、`#page-calendar` 日历、`#page-report` 报表、设置页。事件首页是 `#page-event-home`。脚本顺序在文件末尾：`report-metrics.js` → `report.js` → `ui-theme.js` → `app.js` → `backup.js` → `sync-config.js` → Supabase CDN → `sync.js` → `dev-appearance.js` → `dev-inspector.js`。HTML 里的 `onclick` 直接调用全局函数，所以这些函数必须留在全局。

| 职责 | 位置 |
| --- | --- |
| 内存状态与几乎全部交互 | `app.js`（约 7900 行） |
| 分类、快捷、流水、进行中主线/并行 | `v9_cats`、`v9_shorts`、`v9_parallel_shorts`、`v9_logs`、`v9_current`、`v9_parallel`、`v9_parallel_history` |
| 手账未指定时长 | `v9_unlocated_logs`；模式开关 `v9_record_mode`（`continuous` / `journal`） |
| 计次事件 | `v9_event_types`、`v9_event_records`。和主线时间无关 |
| 场景 | 分类名固定为「场景」；进行中的场景是 `current.scene === true`。容器 id 在 `getSceneContainerId` / `ensureSceneContainerIds` |
| 计时与日切 | `nowSecondMs`、`commitCurrentSlice`、`ensureDayRolloversBefore`。北京时间用 `BJ_OFFSET`（`app.js` 约 730 行） |
| 并行结束与归位 | `toggleParallel` 把结束的并行放进 `parallelHistory`；主线切片时 `flushParallelHistoryForSlice`、`settleParallelForMainSlice`、`settleCompletedParallelHistory` |
| 切割 | 进行中：`executeLiveSplit`；已结束：`executeSplit` |
| 报表绘图 | `report.js` 的 `initReportBillboard` / `renderReportBillboard`。数字由 `app.js` 的 `buildLiveReportPeriod` → `getReportPeriodData` 提供 |
| 备份 | `backup.js`：`collectTimebookBackup`、`importSelectedBackupDates`、`restoreTimebookBackup` |
| 云同步 | `sync.js` + `sync-config.js` + `supabase/migrations/202610140001_timebook_snapshots.sql`。一个账号一行，整包 JSON |
| 安卓壳 | `android/app/src/main/java/io/github/lgy8687/timebook/MainActivity.java`。资源由 `android/tools/prepare-web-assets.mjs` 打进 APK |
| 小组件 | `MainActivityWidget.java`。快照在 `SharedPreferences`（`main_widget` / `daily`），不是账本本身 |
| 测试 | `tests/*.test.js`，`node --test tests/*.test.js`。多数用 `vm` 截取 `app.js` 里的函数 |

两条记录模式：

- **24 小时**（`continuous`）：主线不停。换活动走 `executeRecord` → `doExecuteRecord` → `commitCurrentSlice`。跨过北京时间 0 点时，`tick` 和 `pageshow` 调用 `ensureDayRolloversBefore`，按天切开并续跑。
- **手账**（`journal`）：`stopCurrentMain` 可以结束主线。空出来的时段由 `getDayUnassignedSegments` 显示成未分配，报表里用 `getUnrecordedSegments` 画成「未记录时间」。已写下的空档不会在切回 24 小时模式时被补造（`setRecordMode` 的确认文案与实现一致）。

并行同时只有一条，必须挂在当前主线上（`toggleParallel` 在没有 `current` 时直接拒绝）。计次事件走 `saveEventRecord`，设置文案写明不占用主线或并行时间。「睡觉」是系统活动，不能当成事件名（`EVENT_RESERVED_NAMES`）。

## 3. 优先修改建议

### P0-1 一级分类改名只改了一半的存储

**现象。** 在设置里把一级分类从「工作」改成「上班」之后，主线流水和当前主线会跟着变。已经结束、还放在 `parallelHistory` 里的并行，正在跑的并行，以及手账里的未指定时长，仍旧写着旧名字。报表按 `l1` 字符串分组（`reportMainGroup`），这些记录会变成一个没有颜色的旧分类。最近使用、输入记忆、报表摘要里选定的分类平均也不会改。

**涉及。** `app.js` 的 `editL1`（约 7729–7750 行）和 `saveAll`（约 7922–7929 行）。对照 `applySubCategoryEdit`（约 7831–7875 行）：子分类改名会改 `logs`、`parallelHistory`、`unlocatedLogs`、`current`、`parallelCurrent`、两边快捷入口、`v9_recent_picks`、`v9_input_aliases`，并调用 `updateReportSummaryCategoryRefs`，然后单独把并行和未指定时长写回 `localStorage`。

**为何要改。** 分类存在记录上的是名字，不是 id。漏掉的那几份会在下次启动时原样读回来。`saveAll` 只写分类、快捷入口、`v9_logs` 和 `v9_current`，就算补了内存修改，不写 `v9_parallel_history` / `v9_parallel` / `v9_unlocated_logs` 也会在刷新后丢。

**建议改法。** 不要重写存储层。把 `applySubCategoryEdit` 里那一段 `updateRecord` 抽成 `renameActivityRef(oldL1, oldL2, newL1, newL2)`，`oldL2` 为空表示整级改名。`editL1` 改完名字后调用它，并显式 `setItem` 这三把钥匙：`v9_parallel_history`、`v9_parallel`（有进行中并行时）、`v9_unlocated_logs`。`saveAll` 先不要扩成「把所有内存变量都写一遍」，它现在被删除分类共用，扩错了会把不该保留的状态写回去。

**验收。**

1. 造一条已结束并行（停掉并行但先不要切主线，它还在 `parallelHistory`）、一条正在跑的并行、一条未指定时长，三者都属「工作」。
2. 把一级分类改名为「上班」并选完图标。
3. 刷新页面。三处记录的 `l1` 都是「上班」，报表里不再出现「工作」。
4. 最近使用和报表摘要里原来选的「工作 / 某二级」也变成新名字。
5. 跑 `node --test tests/sleep-category.test.js tests/report-statistics.test.js`。最好在 `tests/` 加一个只覆盖 `renameActivityRef` 的用例，不必启动浏览器。

### P0-2 下载云端数据时，自动上传可能把写到一半的本地库推上去

**现象。** 同步模型是「一个账号一份整包快照」，表 `timebook_snapshots`，靠 `revision` 乐观锁。这个模型可以留着。问题出在下载过程：`pullCloud` 会逐个 `removeItem` / `setItem` 所有 `v9_*`，而 `sync.js` 末尾把 `Storage.prototype.setItem` 和 `removeItem` 换成了「只要是 `v9_*` 就 `queueUpload`」。`pullCloud` 自己从不把 `busy` 设为 `true`，也不 `clearTimeout(pendingTimer)`。`queueUpload` 只在 1.2 秒后看一眼 `busy`。下载写到一半时，如果之前已经排了一个上传，或者这次删除又排上了新的，上传读到的就是半包，并用旧的 `revision` 去覆盖云端。`location.reload()` 通常来得及取消定时器，所以不是每次都发生；定时器已经到期、或刷新被拦住时就会发生。

**涉及。** `sync.js` 的 `pullCloud`（约 141–169 行）、`queueUpload`（约 183–187 行）、原型补丁（约 215–224 行）。上传函数 `pushLocal` 会设 `busy`，下载没有。

**为何要改。** 云端是整包替换。半包上传成功之后，另一台设备再下载，流水会缺一块。安全副本 `timebook_sync_safety_backup` 只留在本机，而且这个键不以 `v9_` 开头，不会进云端。

**建议改法。** 仍旧整包同步，不要改成字段级合并。在 `pullCloud` 确认对话框之后立刻：

1. `clearTimeout(pendingTimer)`。
2. `busy = true`，包住后面的删除和写入；失败分支里再设回 `false`。成功路径马上 `location.reload()`，不要在刷新前把 `busy` 放开。
3. `queueUpload` 在函数开头就 `if (busy) return`，不要只在定时器里判断。

顺手把「哪些键允许进快照」收成 `sync.js` 里已有的 `allKeys` 一处正则。现在备份和同步各写了一次 `/^v9_[A-Za-z0-9_]+$/`。先别拆文件，只是下载期间不要让钩子再排队。

**验收。**

1. 登录同步，确认状态是「自动同步开启」。
2. 在控制台把 `localStorage.setItem` 包一层日志，或临时把 `queueUpload` 的延迟改成 0。
3. 点「下载云端数据」。日志里不应出现一次 `pushLocal`，刷新后本机 `v9_logs` 与下载前云端一致。
4. 另一台浏览器在下载完成前改一条流水并成功上传后，这台应进入「请选择上传本机或下载云端」，而不是静默覆盖。现有乐观锁（`update ... eq('revision', cloudRevision)`）已经能挡住多数冲突，这项是补下载窗口。

### P1-1 并行切片复用 id，下次启动会按 id 丢掉后一段

**现象。** `flushParallelHistoryForSlice` 把一段并行切进主线时，写入 `logs` 的对象和留在 `parallelHistory` 里的前后残余都展开了原来的 `...p`，id 不变。启动时 `repairOrphanedParallelParents` 用 `seenParallelIds` 去重，同一个 id 的第二条并行直接 `return false` 滤掉。

**涉及。** `flushParallelHistoryForSlice`（约 1107–1144 行）；去重在约 331–342 行。`settleCompletedParallelHistory`（约 1186–1187 行）已经会在 id 被占用时 `genId()`，这条刷新路径没有。

**为何要改。** 主线 id 有 `repairDuplicateMainLogIds`，并行 id 被当成「重复脏数据」删掉。并行只要跨出当前主线切片就会走到这里：改过开始/结束时间、补录进 `parallelHistory`、或者残余落在手账空档里还没挂上父主线。只做连续记录、从不改历史时间的用法不容易碰到。

**建议改法。** 在 `flushParallelHistoryForSlice` 里，写入 `logs` 的那一份若 id 已在 `logs` 或本次已写出的集合里，就 `genId()`。留在 `parallelHistory` 的残余也换新 id。不要放宽启动去重，那一层是在收旧的双份挂载。

**验收。** 在 `tests/split-regression.test.js` 旁加一个纯函数用例：一条 `parallelHistory` 从 8:00 到 12:00，主线切片是 9:00–11:00。切片后 `logs` 里那段与 history 残余的 id 互不相同，残余时间仍是 8:00–9:00 和 11:00–12:00。再跑一遍现有的 `repairOrphanedParallelParents` 启动逻辑（把函数体放进 `vm`，测试文件里已有这种截取方式），两条不同时间段都还在。

### P1-2 切割和补录用 `===` 比较 parentId，其它地方用 `String()`

**现象。** 进行中主线的 id 来自 `genId()`（UUID 字符串）。日切续跑的并行却写成 `id: segEnd + 0.001`（数字，`settleParallelForMainSlice` 约 1235 行）。`executeSplit`、补录和部分修复用 `parentId === splitParentId` 或 `main.id === item.parentId`。`repairOrphanedParallelParents` 查找已结束流水时又用 `String(main.id) === String(item.parentId)`。同一条父子关系，有的路径认，有的路径不认。对不上时，切割不会把旧并行重新挂到新片段上，并行留在旧 id 上，下次启动再按时间重叠去猜父级。

**涉及。** `executeSplit` 约 5690–5725 行；同类比较还有约 5579、5793、5945、323 行。已经用 `String()` 的例子在 `executeLiveSplit`（约 5656 行）和 `repairOrphanedParallelParents`（约 301 行）。

**为何要改。** 这是同一批数据的两种身份。猜父级能补救一部分，但切割当时的冲突检测会漏掉，用户可以把新片段切进仍被并行占用的时间。

**建议改法。** 在 `app.js` 顶部加一个本地函数：

```js
function sameId(a, b) {
    return a != null && b != null && String(a) === String(b);
}
```

只替换上面这些 `parentId` / 主线 `id` 比较。日切续跑的并行 id 改为 `genId()`，不要再写 `segEnd + 0.001`。不要做 id 类型迁移。

**验收。** 主线 id 用数字 `1747651200000.123`，其下并行的 `parentId` 用字符串 `"1747651200000.123"`。打开切割，冲突检测应能看到这条并行；切割完成后并行的 `parentId` 指向新片段。`node --test tests/split-regression.test.js tests/live-split.test.js` 仍通过。

### P1-3 小组件进行中的时间，和页头不是同一段

**现象。** 页头每秒显示 `now - current.startTime`（`tick`，约 7185–7188 行），只含当前这一段。小组件在 `MainActivity.onResume` 里用一段 Java 字符串调用页面上的 `getTodaySegments()`，按 `l1 + l2` 把当天所有主线毫秒加在一起，再把 `current` 标成 `live`。`MainActivityWidget` 把这个合计毫秒交给 `Chronometer` 继续走。今天早些时候已经有 3 小时「办公」，当前这段「办公」只跑了 10 分钟时，页头是 `00:10:00` 左右，小组件会从 3 小时多开始往上走。

**涉及。** `MainActivity.java` 的 `widgetSync`（约 35–52 行）；`MainActivityWidget.java` 约 64–71 行。快照只在 Activity `onResume` 到 `onPause` 之间每 5 秒写一次。进程不在前台时，原生计时器会按上次基数自己走；过了北京时间 0 点，`day` 对不上就显示「点击打开应用更新」。`android/README.md` 已说明没有后台对账。这一点保持现状即可。

**为何要改。** 小组件名字是「主线计时」，和页头放在一起看会以为当前活动已经跑了几个小时。另外，聚合算法写在 Java 字符串里，`getTodaySegments` 一改名，这里 `catch` 后返回 `null`，小组件静默停更。

**建议改法。** 在 `app.js` 增加 `buildWidgetSnapshot()`，返回 `{ day, at, rows }`。进行中的行带 `segmentMs`（当前段被裁进今天后的毫秒），当天累计放在 `totalMs`。Java 只 `evaluateJavascript("buildWidgetSnapshot()")`。`Chronometer` 用 `segmentMs`。行上的静止文字继续用 `totalMs`，没有第二种状态就先只显示当前段，和页头对齐。不要为小组件加原生数据库。

**验收。** 今天先记 3 小时办公并切走，再开始一段新的办公。打开应用看小组件：跳动的数字接近页头，而不是 3 小时加上页头。杀掉应用进程再看，数字仍按上次打开时的当前段继续走；过 0 点后显示「点击打开应用更新」。`node --test tests/android-widget-layout.test.js tests/android-offline.test.js`。

### P1-4 每次打开页面都回写账本，事件上的 parentId 每次都被剥掉

**现象。** `app.js` 加载时无论值有没有变，只要数组非空就 `setItem`：`v9_logs`（约 210–211 行）、事件类型和事件记录（约 243–247 行）、进行中主线和并行（约 248–250 行）。事件记录的映射是 `({ parentId, ...item }) => ...`，每次启动都丢掉 `parentId`。这些写入发生在 `sync.js` 打补丁之前，所以不会在启动瞬间上传；下一次任意 `v9_*` 写入会把整包（含已剥掉的事件）上传。

**涉及。** 上面几行，以及 `sync.js` 的 `allKeys`。场景迁移有标志 `v9_scene_activity_migration_v2`，事件这条没有。

**为何要改。** 两个标签页同时打开时，后打开的页面用自己读到的旧内存回写，可能盖住前一个标签刚写下的流水。窗口很短，但是同一段「读出来再无条件写回去」。事件 `parentId` 若还在旧备份里，第一次打开再做任意一次会触发同步的修改，云端副本里的这个字段就没了。

**建议改法。** 回写前比较字符串，相同就不要 `setItem`。剥离 `parentId` 如果仍要做，加一次标志，例如 `v9_event_record_migration_v1`，做完就不再映射。不要在这次顺手改事件的数据结构。

**验收。** 准备一份 `v9_logs` 的 JSON。刷新页面，这条键的值字节级不变（没有多余空格或键顺序变化；若规范化会改时间戳，只在真的变化时写）。事件记录里没有 `parentId` 时，刷新不调用 `setItem('v9_event_records')`。`node --test tests/event-home.test.js tests/event-center.test.js`。

### P1-5 时长的分钟字段和结束时间不是同一个事实

**现象。** 新记录同时写 `endTime`（毫秒）和 `duration`（分钟，且多处 `Math.max(1, Math.round(...))`）。不足 30 秒的并行会被写成 1 分钟。展示函数 `logDurationMs`（约 1005–1011 行）优先用 `endTime - startTime`，注释也写了要避免分钟丢秒。切割、补录、拖动进度仍有约 8 处手写 `endTime || startTime + duration * 60000`，缺 `endTime` 时还会默认 60 分钟（例如 `openSplitDrawer` 约 5623 行，`executeSplit` 约 5681 行）。

**涉及。** `logEndMs`（约 1062 行）已经是统一读法。写入点包括 `commitCurrentSlice`、`toggleParallel`、`flushParallelHistoryForSlice`、`executeSplit`。

**为何要改。** 报表主路径用裁剪后的起止毫秒，所以日常报表大多是对的。一旦某条旧数据没有 `endTime`，切割范围会按分钟甚至按 60 分钟估算，和时钟上的秒对不齐。

**建议改法。** 读结束时间全部改成 `logEndMs(log)`。新写入继续写 `endTime`；`duration` 可以照旧冗余写着，但不要再 `Math.max(1, ...)` 去抬短记录。缺 `endTime` 时不要默认 60 分钟，直接拒绝切割并提示重新选择。不要做一次全库迁移。

**验收。** 一条只有 `startTime` 和 `duration: 1`、没有 `endTime` 的旧并行，打开切割时应按 1 分钟计算，而不是 60 分钟。一段 20 秒的并行，`duration` 不再变成 1；页头和流水时长仍显示 20 秒。`node --test tests/split-regression.test.js tests/live-split.test.js`。

### P1-6 开发者编号浮层对第一次打开的人是开着的

**现象。** `dev-inspector.js` 第 117 行：`localStorage.getItem('timebook_dev_inspector_enabled') !== 'false'`。键不存在时浮层开启，区块上会出现 Bxx / Zxx 编号。页头 `</>` 和设置里的开关能关掉，但无痕窗口或新设备会先看到编号。安卓打包不会去掉这个脚本（`prepare-web-assets.mjs` 只排除 `sync.js` 和 `sync-config.js`）。

**为何要改。** 这是设计编号工具，挂在正式页面上。你自己调试可以开；给别人看 GitHub Pages 或安装 APK 时，第一眼不是账本。

**建议改法。** 改成只有值为 `'true'` 才开启。默认关。不要删 `dev-inspector.js`，编号测试 `tests/dev-addresses.test.js` 还靠这些地址。

**验收。** 清空站点数据后刷新：没有编号浮层，`</>` 为未按下。在设置里打开一次，刷新后仍然开着。`node --test tests/dev-addresses.test.js tests/typography.test.js`。

### P2-1 把「四份数据」写进设置里的一句说明

**现象。** 网页 origin 是 GitHub Pages，账本在该源的 `localStorage`，并可上传到 Supabase。安卓用 `https://appassets.androidplatform.net/assets/index.html`，`prepare-web-assets.mjs` 去掉同步脚本和 Supabase CDN，`android/tools/offline.css` 隐藏 `.timebook-sync-panel`，`MainActivity` `setBlockNetworkLoads(true)`，清单里没有 `INTERNET`。小组件是 `SharedPreferences` 里的投影。两边互相同步不会发生。JSON 备份是唯一桥梁：按日期导入保留本机进行中的主线（`backup.js` 约 213 行），完整恢复会连 `v9_current` 一起换掉。

**建议改法。** 在 `index.html` 数据管理那句「导入可按日期选择」下面加一句：网页和安卓是两套账本；按日期导入不搬进行中的计时和分类设置，完整恢复会换掉这台设备上的全部 `v9_` 数据。不要做账号打通，也不要给 APK 加网络权限。

**验收。** 飞行模式下安卓冷启动、记账、导出、再导入，与 `android/README.md` 现有验收一致。网页登录同步时，安卓设置里仍看不到云端同步。

### P2-2 设计文档有三处已经不是代码契约

**现象。** `设计文档.md` 仍写着：时间不可改、主线永远有一个按钮按着、并行叫「事件线」。代码里主线和并行都能改起止时间（`confirmEdit`、`applyEditedRange`），手账可以没有进行中的主线，计次事件是另一套 `v9_event_*`。`事件整合对接设计方案.md` 和现在的「事件只计次」也不完全一致。

**建议改法。** 不要重写全文。在 `设计文档.md` 开头加一小节「以代码为准」，用十行写明：24 小时 / 手账、一条并行、场景容器、计次事件、四份数据。正文里和这五句冲突的段落改掉或标成旧稿。产品规则以 `setRecordMode` 的确认文案和设置页 `#config-panel-event` 的说明为准。

**验收。** 一个没读过代码的人，只看这一小节就能说出：手账空档不会自动补成活动，事件次数不占用主线。

### P2-3 按日期导入没有看进行中的并行

**现象。** `importSelectedBackupDates` 把 `v9_current` 延长到 `Date.now()` 后检查主线重叠，不读 `v9_parallel`。进行中的并行时间若和导入的并行历史重叠，两边都会留下。

**建议改法。** 导入前把 `v9_parallel` 放进同一套重叠判断；冲突就整次中止，沿用现在「时间段发生冲突」的提示。不要自动合并。

**验收。** 本机并行从 10:00 跑到现在，备份里有 10:30 开始的并行。按日期导入应被拒绝，本机 `v9_parallel` 不变。`node --test tests/backup.test.js`。

## 4. 已证实与猜测

**已从代码证实**

- 存储是 `localStorage` 的 `v9_*` 整键 JSON，没有 IndexedDB，也没有服务端流水表。云端只有 `timebook_snapshots.payload`。
- `editL1` 不更新 `parallelHistory`、`parallelCurrent`、`unlocatedLogs`、最近使用、输入记忆和报表摘要引用；`applySubCategoryEdit` 会更新。
- `saveAll` 不写并行、未指定时长和事件。
- `pullCloud` 不设置 `busy`，也不清掉已排程的上传；`v9_*` 的读写会调用 `queueUpload`。
- `flushParallelHistoryForSlice` 复制原 id；启动去重会丢掉同 id 的后一条并行。
- `parentId` 比较有的用 `===`，有的用 `String()`。
- 页头计时是当前段；小组件把当天同名主线毫秒累加后交给 `Chronometer`。小组件快照只在 Activity 可见时刷新。
- 安卓包排除 `sync.js`、`sync-config.js` 和 Supabase CDN，WebView 禁止网络加载，清单无 `INTERNET`。网页和安卓不是同一个 origin。
- 开发者浮层在键不存在时开启。
- 启动时会剥掉事件记录的 `parentId` 并无条件回写非空数组。
- `logDurationMs` 优先用起止时间；切割路径仍有手写的分钟回退。

**猜测，没有用真实账本跑过**

- P0-2 的半包上传需要「定时器已经到期」或刷新没有立刻发生。日常快速刷新很可能碰巧没事。代码窗口是真的，出现频率未知。
- P1-1 对「从不修改历史、并行总在一条主线内部结束」的用法很少触发。手账空档加改时间更容易遇到。没有拿到你的 `v9_parallel_history` 样本。
- 小组件用当天累计，可能是有意做成「今天这类活动一共多久」。即便如此，它和页头并排时也会被看成同一块秒表。建议改成当前段；若你要保留累计，行上应写「今日」而不是让它看起来像页头计时。
- 事件 `parentId` 的剥离多半是「事件改成独立计次」那次提交留下的有意迁移，只是缺了一次性标志。
- Supabase 的 `publishableKey` 放在 `sync-config.js` 里是公开配置。安全依赖 `202610140001_timebook_snapshots.sql` 的 RLS（`auth.uid() = user_id`）。我没有登录你的项目核对这张表是否已经在线上执行。迁移文件自己写着要等你点头再应用。

## 5. 不建议现在动的地方

- **不要拆 `app.js`，也不要换框架。** 页面通过全局函数和 `onclick` 连在一起，测试用源码切片加 `vm` 跑。拆文件会先把测试和 HTML 弄断，而不会先修好改名或同步。
- **不要做安卓原生数据库或后台对齐。** `android/README.md` 已把这件事排除在 0.11 之外。小组件保持「前台快照 + 原生秒表」就够用。
- **不要把计次事件并回主线或并行。** 设置页已经把它们定义成互不占用时间。合并会动报表、备份日期选择和日历补录三条路。
- **不要把整包同步改成按字段合并或 CRDT。** 先补上 P0-2 的临界区。两台设备同时改，继续让用户选「上传本机」或「下载云端」。
- **不要重写 `设计文档.md` 全文，也不要为了整齐去改报表绘图。** `report.js` 只负责画 `buildLiveReportPeriod` 给的数。数字没算错就不要动弧线和配色。
- **不要清理看起来没用的旧字段（`duration`、`tag`、`manualSplit`）。** 旧备份还带着它们。读路径统一到 `logEndMs` 即可。
