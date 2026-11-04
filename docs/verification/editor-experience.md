# FastPoster 编辑体验、内置字体与上传兼容验证

日期：2026-11-03。分支：`feat/fastposter`。基线：`f702d18`（前轮数字草稿与 Select 整行点击修复单独提交之后）。

环境：本机 Google Chrome（Playwright `workers:1`），隔离 Go/Vite 测试栈（每次运行新建一次性 MySQL schema）；桌面 1440×1000，触屏模拟 390×844（`hasTouch`、`deviceScaleFactor:2`）。移动端是视口/触摸模拟，不是真机验证。

实施提交：`f702d18..dfb2a84`。Task 8 的采集脚本补充、验证结果与本文档在同一工作区完成；截图和原始日志保存在仓库忽略目录 `.superpowers/sdd/2026-11-03-editor-experience-implementation/task8-evidence/`，不进入提交。

## Task 1：共享焦点与 Select 留白

### 变更

- `TextInput`/`Textarea` 的 field、bare 两种变体都获得同一个焦点基础类；该类只设置焦点颜色与阴影，不设置高度、边框宽度或内边距，页面尺寸规则继续生效。焦点使用 `--fp-focus-line`（`#88a471`）与 `--fp-focus-shadow`（`#b4c7a522`），并移除浏览器原生 outline。
- `NumberField` 的输入复用同一焦点类，后台排序等没有页面焦点规则的输入不再露出原生轮廓。
- 项目页搜索框保留容器边框，焦点环画在 `.search-input` 容器上，输入自身不再叠加一圈内环。
- Select 触发器默认持有 `padding: 0 10px`，compact 仍为 `0 8px`；删除 Value 的 `4px` 缩进与 Icon 的 `-6px` 边距。页面 Select 消费者的 9px 内边距收敛到 10px（后台筛选/资源表单、模板编辑器元信息、文案分类）。
- 编辑面板 Select 使用 10px；同面板的数字输入保持 8px 原值，避免顺带移动用户熟悉的数字文本。画布缩放控件是无边框的行内选择器，显式保持 0 内边距，外框尺寸不变。

### 先失败后通过

- `packages/ui/src/styling-hook.test.ts`：bare 变体原先除页面类外没有任何共享类（共享类数量 0，应为 1）；`NumberField` 输入没有共享焦点类。实现后 4/4 通过。
- `tests/e2e/ui-controls.spec.ts › bare picker search uses the green focus treatment`：聚焦背景库搜索时边框实际为 `rgb(221, 231, 209)`（页面 `#dde7d1`），模板库同理；项目页搜索容器为 `rgb(227, 232, 220)`。实现后断言边框 `rgb(136, 164, 113)`、outline 为 `none`、阴影含 `rgba(180, 199, 165, …)`。
- `tests/e2e/ui-controls.spec.ts › the select trigger balances text and caret insets`：修复前文字左内距 15px、箭头右内距 5px，差 10px（旧断言只要求箭头距右边框 ≤4px，正是问题来源）。实现后断言左右视觉内距差 ≤2px，并保留整行点击用例。

### 验证结果

- `pnpm typecheck`：退出 0。
- `pnpm test`：14 个文件、85 个用例通过。
- 针对性 E2E：`--grep 'green focus|insets|right edge'` 3/3；数字草稿与焦点复跑 5/5。
- ui-controls 全量按注册限流拆两组：9/9、6/6。每组使用独立 `pnpm exec playwright test`，测试栈各自新建数据库。
- 截图对比使用 `FP_UI_BASELINE=1`（opt-in 采集用例，不计入功能用例）：修复前 `/tmp/fastposter-task1-before`，修复后 `/tmp/fastposter-task1-after3`，均在仓库外，避免 Playwright 清理 `test-results/`。桌面编辑面板差异仅落在字体、字重两个 Select 的文字与箭头；数字输入、画布与布局无位移。ImageMagick 归一化差异：编辑面板 0.00018、模板库 0.00006、后台表单 0.00005。
- 采集脚本存在既有 `fill` 时序波动：三次运行中有一次在默认文案后追加输入，导致画布内容不同；重跑与基线一致，与本轮样式改动无关，对比采用第三次产物。

### 限制

- 只在 Chrome 验证；触屏为模拟。绿色焦点在模板库、背景库、项目页搜索上由计算样式断言；后台搜索、Textarea 与数字输入组共享同一类和规则，但没有额外的逐控件浏览器断言。
- 下拉菜单、弹窗与快捷键行为沿用前轮验证，本轮未重新采集真实 iOS Safari / 读屏器结果。

## Task 2：作用域通知与错误展现

### 变更

- 新增 `NotificationsProvider`、`useNotify`、`useNotificationScope`、`useErrorNotice`：同一 id 更新而不是重复入队，普通通知 4 秒、操作失败 6 秒、持续阻断常驻，最多同时 3 条；通知作用域绑定身份 generation，切换账号后旧请求的回调不再显示旧通知。
- 通知使用 Base UI Toast，顶部居中并保留移动端安全区；关闭与操作按钮可键盘访问。弹窗打开时 Portal 挂到弹窗容器，通知不会躲在模态层后面。
- 上传、重命名、删除、复制、恢复、导出、后台资源/模板操作等错误迁移到统一通知；可重试操作提供 `重试` 动作，持续保存错误保留原常驻入口。
- 字体样式降级、字段关联、冲突 Dialog 等既有反馈保留，没有减少恢复入口。

### 验证

- `packages/ui/src/notifications.test.ts` 覆盖去重、时长、上限和旧 generation 不生效；属于 105 个单测的一部分。
- `tests/e2e/notifications.spec.ts` 3/3：失败上传只产生一条 toast 且不抢编辑焦点；弹窗内 toast 可访问并可重试；切换账号清空旧通知。
- `session-sync`、`ui-controls`、后台资源等受影响的 E2E 全量通过；失败和重试路径均断言后续请求成功，而不是只检查源码字符串。

## Task 3：按真实内容识别图片格式

### 变更

- `safeName` 继续清洗基名与长度，但在探测到合法 png/jpeg/webp 后把缺失或错误的后缀纠正为 `.png`/`.jpg`/`.webp`；合法 jpeg 的 `.jpeg` 保留。伪造内容、损坏图片、动画和限额检查不变。
- 字体上传仍使用严格的后缀错误提示：本任务只接受被验证的图片内容，不对字体文件做静默改名。

### 验证

- `go test ./server/internal/assets` 通过；HTTP 集成 `TestAssetHTTPUploadAndPrivateRead` 通过，覆盖“PNG 命名 .jpg”成功、Content-Type/下载名为 `.png`、损坏和伪装内容仍失败。
- `tests/e2e/image-upload.spec.ts` 1/1：4×3 PNG 以 `.jpg` 上传后在编辑器、后台目录和导出中保持 4×3 PNG。
- 用户实际附件（PNG 内容、`.jpg` 后缀、1152×2048、3,190,986 字节、SHA-256 `d56e0244…f36450`）实测：上传后画布 `data-width=1152`、`data-height=2048`，素材响应 `image/png`；导出为 1152×2048 PNG（3,237,208 字节，SHA-256 `cbf9ac3f…04d64`）。附件和导出图片都没有复制进仓库；临时验证脚本运行后删除。

## Task 4：六家族内置字体与加载缓存

### 变更

- manifest 从 4 个字面扩展到 6 家族、11 个字面，原有四个字面 ID 不变；内置字体由 manifest 哈希校验后幂等 bootstrap，ListFonts 按 manifest 内置 ID 优先，限制仍为最多 100 个字面。
- 新增完整字库与许可证：Noto Serif SC、LXGW WenKai、ZCOOL KuaiLe、ZCOOL XiaoWei；来源固定到 google/fonts commit 与 LXGW v1.530，没有用 Web 子集冒充完整字库。六个文件的可下载来源均固定到具体 commit 或 release tag（Noto Sans SC、Inter、Noto Serif SC 同为 `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5`，ZCOOL 两族分别为 `6d49995f…` 与 `d4276864…`，LXGW 为 `v1.530`），不使用 `tree/main` 等移动分支。
- `loadFonts` 以源 URL 和字面注册分别去重；失败会移除缓存以便重试；同源检查在读取缓存之前执行。

### 字库体积（SHA-256 与 manifest 全部一致）

| 文件 | 原始字节 | gzip -9 |
| --- | ---: | ---: |
| NotoSansSC-VF.ttf | 17,772,300 | 11,276,581 |
| Inter-VF.ttf | 876,576 | 457,831 |
| NotoSerifSC-VF.ttf | 25,125,512 | 15,454,598 |
| LXGWWenKai-Regular.ttf | 25,928,940 | 12,904,505 |
| ZCOOLKuaiLe-Regular.ttf | 1,514,968 | 1,107,887 |
| ZCOOLXiaoWei-Regular.ttf | 6,313,808 | 3,415,563 |

六个文件合计 77,532,104 字节（约 73.9 MiB），其中本任务新增四个文件合计 58,883,228 字节（约 56.2 MiB）。Noto Serif SC 与 LXGW WenKai 超过用户上传 20 MiB 限额，但走受控 bootstrap 路径，仍满足 30 MiB 解码上限；没有放宽用户上传限制。

### 验证

- `TestBuiltinManifestDeclaresSixFamilies`、`TestBuiltinFontSourcesArePinned`、`TestBuiltinFontsUpgradeIsIdempotent`、`TestBuiltinFontsRemainVisibleAtCatalogLimit`、`TestBuiltinFontsBootstrapIsImmutableAndReadable` 全部通过；`TestBuiltinFontSourcesArePinned` 先因 Noto Sans SC 与 Inter 使用 `tree/main` 失败，改为固定 commit 后通过；每个 manifest 文件都必须有来源，且来源只能是 40 位 commit blob 或 release tag。
- `font-cache` 单测 2/2：同 key 只执行一次 loader，失败后再次调用可成功且不永久缓存拒绝的 Promise。
- 六个中文字体的短句、标点、换行与覆盖测试通过；Inter 的中文缺字仍被识别。
- 装载 11 个字面后 `editor-richtext` 4/4；新家族实际渲染、保存、重载和导出的版本一致性见 Task 6。

## Task 5：范围预检与原子换字体

### 变更

- 新增 `prepareFontChange`（无副作用候选文档与只含目标文本的 probe）、`firstTargetStyle` 和 Editor 内部原子应用入口；引用与选区样式在同一事务提交，一次撤销同时恢复文字样式和字体引用。
- 新家族缺少目标字重时保留可用字重并回退 400；不支持的粗体/斜体只清理目标范围；其他范围已有缺字不阻止当前选区预检。
- 光标只更新插入样式与引用，不覆盖已有文字。

### 验证

- `prepare-change.test.ts`、`store.test.ts`、`selection.test.ts` 全部通过：只给“风景”换字体时外侧 marks/字号不变；整块切换、空光标、混合字重和 unsupported 样式只影响目标范围；probe 通过 `parseDocument`；一次 undo 恢复样式和引用。
- `editor-richtext` 4/4、`editor-mobile` 3/3 保持通过。

## Task 6：可搜索字体预览与竞态安全预检

### 变更

- `Combobox` 提供中文优先分类的可搜索家族列表；高亮只更新独立预览区并加载该家族，不调用 apply、不改变字体引用或 dirty 状态。
- 换字体前加载候选字体并调用既有 `CheckFonts`；只有请求快照（作用域、文档、目标范围与样式）仍匹配才应用。选区、作品或账号变化后旧结果不应用、不弹旧 Toast。
- 预检失败沿用 API 的缺字明细，保留原排版，并提供“改用思源黑体”或“重试”动作；样式降级只通知一次。
- 旧字体 Select 测试改用真正仍为 Select 的字段（字重等），保留可访问名称和键盘操作。

### 验证

- `editor-fonts.spec.ts` 6/6：搜“宋体/文楷”能定位家族；高亮预览不修改文档；中文选区换 Inter 被拒绝且原文档仍可导出；英文选区换 Inter 成功；新中文字体实际渲染、保存、重载和导出同一版本；延迟请求后改选区/作品/账号不应用旧结果也不弹旧通知；字体文件首次失败后重试成功。
- `admin-catalog` 2/2：后台上传的实际 500 字重字体在中文缺字时保持持续错误和可修复/可导出；`editor-richtext`、`editor-mobile`、`full-flow` 全部通过。
- 搜索输入稳定性由 `useMemo` 保持 options/items 身份，避免 Base UI 在每次渲染时把查询重置为已选家族。

## Task 7：步进数字控件与一致事务

### 变更

- `NumberField` 增加 `variant="stepper"`，提供减/输入/加结构、单位、`stepBase` 和交互开始/结束回调；保留原有 raw 草稿、Enter/Escape、IME 和导航保护。
- 字号 1–4096（步长 1，px）、行高 0.5–5（0.1，倍）、字距 -100–1000（1，px）、透明度 0–100%（5，%）及 padding/描边/阴影效果均使用步进控件；透明度只在 StylePanel 边界做 `*100`/`/100`，文档模型仍是 0–1。
- 混合选区以目标起始文字为 `stepBase`；一次按下/长按是一个 Editor 事务，指针释放、取消、失焦或卸载时收尾，避免阻塞 autosave 的 inTransaction。
- 桌面面板窄时数字行单列，360px 底部面板保持可用；触屏步进按钮有效目标 44px。

### 验证

- `editor-settings.spec.ts` 4/4：字号 64→65→64、行高 1.5→1.6、负数/正数字距、透明度 50→55（文档 0.55）、边界禁用、动态 padding 上限、混合字号 64/80 从 64 步进到 65、长按一次撤销、触屏保持选区且不横向溢出。
- `ui-controls` 15/15、`editor-richtext` 4/4、`editor-mobile` 3/3 均通过；控制台无新增错误。

## Task 8：全流程验收

### 截图与视觉

- 采集命令：`FP_UI_BASELINE=1 FP_UI_BASELINE_OUT=<evidence>/screenshots pnpm test:e2e tests/e2e/ui-baseline.spec.ts`，2/2 通过（19.6s）。数据与视口沿用 Task 1：桌面 1440×1000，手机模拟 390×844、`hasTouch`、`deviceScaleFactor=2`；每次运行新建一次性数据库。
- 本轮新增真实截图：`d-09-template-search-focus`、`d-10-font-menu-preview`、`d-11-font-rejection-toast`、`m-09-template-search-focus`、`m-10-font-menu-preview`、`m-11-font-rejection-toast`；原有 `d-04-editor-panel`、`m-05-editor-sheet` 覆盖步进组。
- 与 Task 1 修复后基线 `/tmp/fastposter-task1-after3` 对比：编辑页顶部导航与画布区域 ImageMagick 归一化 RMSE 均为 0；项目页整页 0.00247，差异只落在两张卡片的时间戳文字；手机编辑页顶部 0.0000391；手机底部面板顶部为 0。画布、导航和布局没有无关位移。
- 绿色焦点在模板库搜索框上可见并由 `ui-controls` 计算样式断言（`#88a471`、无蓝色 outline）；Select 普通/compact 的 10/8px 内距由 `the select trigger balances text and caret insets` 持续断言。字体预览在桌面与手机都显示高亮家族样张；拒绝 Toast 顶部居中、带“改用思源黑体”和关闭按钮，原文档保持不变。

### 静态检查与构建

- `pnpm contracts:check`：退出 0，本计划未修改生成契约。
- `pnpm typecheck`：退出 0。
- `pnpm test`：18 个文件、105 个用例全部通过。
- `pnpm build --force`：8/8 任务成功，0 缓存。基线 `f702d18` 在临时 worktree 中用同一命令构建后对比：

| 应用/产物 | 基线原始 | 最终原始 | 变化 | 基线 gzip | 最终 gzip | 变化 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| web JS | 1,013.60 kB | 1,086.32 kB | +72.72 kB | 320.49 kB | 344.13 kB | +23.64 kB |
| web CSS | 33.08 kB | 38.37 kB | +5.29 kB | 7.91 kB | 8.73 kB | +0.82 kB |
| admin JS | 1,014.09 kB | 1,086.61 kB | +72.52 kB | 318.29 kB | 341.50 kB | +23.21 kB |
| admin CSS | 44.98 kB | 50.27 kB | +5.29 kB | 10.05 kB | 10.86 kB | +0.81 kB |
| renderer JS | 311.44 kB | 311.79 kB | +0.35 kB | 95.03 kB | 95.20 kB | +0.17 kB |

- 原有“超过 500 kB”警告仍在，没有新增构建失败或 chunk 拆分。增量来自通知、可搜索 Combobox、字体目录与步进控件；字体文件由 Go 资源路径提供，不进入前端 bundle。

### 字体按需加载

临时网络探针（1/1 通过，脚本运行后删除，JSON 保存在证据目录）：

- 初始化只请求 `builtin-noto-sc-400/700/900` 三个字面 URL（同一 Noto Sans SC 变量字体家族，属于既有默认文档行为），没有请求 Noto Serif SC、LXGW WenKai、ZCOOL KuaiLe、ZCOOL XiaoWei 或 Inter。
- 高亮霞鹜文楷新增且只新增 `builtin-lxgw-wenkai-400`；高亮思源宋体新增且只新增 `builtin-noto-serif-sc-400`。
- 再次高亮霞鹜文楷、实际选中应用霞鹜文楷都没有新增请求；保留字体失败重试路径。
- 重载后的累计请求集合没有新增 ZCOOL 或 Inter；探针快照是累计集合，无法单独区分重载阶段，因此本文不据此声称“重载只加载引用家族”。
- 限制说明：初始化会为 Noto Sans SC 三个字面各发一个 face URL（它们指向同一变量字体文件），这是本计划之前已有的初始化行为；本轮未增加其他家族，也未在预览/换字体时重复下载。

### Go 与集成

- `go test -count=1 ./server/... ./tools/...`：退出 0，15 个包全部 `ok`。
- `python3 tools/test-integration.py -run 'TestAssetHTTPUploadAndPrivateRead|TestBuiltin' -count=1 -v`：实际命中 4 个测试并全部 PASS：`TestAssetHTTPUploadAndPrivateRead`、`TestBuiltinFontsUpgradeIsIdempotent`、`TestBuiltinFontsRemainVisibleAtCatalogLimit`、`TestBuiltinFontsBootstrapIsImmutableAndReadable`。
- 没有用未命中的测试或跳过项补充通过数量。

### 功能 E2E

按注册次数拆组、顺序启动独立测试栈，每组独立日志；实际运行范围：

| 组 | 文件 | 用例 | 注册数 | 结果 |
| --- | --- | ---: | ---: | --- |
| A | notifications、image-upload、session-sync、templates、copy | 8 | 8 | 8 passed (36.5s) |
| B | editor-fonts、editor-mobile | 9 | 9 | 9 passed (31.6s) |
| C | editor-settings、editor-richtext | 8 | 8 | 8 passed (23.3s) |
| D | ui-controls（前 9 个用例） | 9 | 9 | 9 passed (23.2s) |
| E | ui-controls（后 6 个用例） | 6 | 6 | 6 passed (13.2s) |
| F | admin-catalog、autosave | 6 | 6 | 6 passed (42.8s) |
| G | editor-geometry、export、full-flow、projects | 8 | 9 | 8 passed (38.2s) |

合计 54 个功能用例通过。`ui-baseline` 是 opt-in 采集，2/2 通过，单独列出，不计入 54；网络探针与附件探针也是单独运行、脚本临时创建后删除，不计入功能用例。

### 独立审阅与修复

独立审阅覆盖 `f702d18..e8fe87b` 的 8 个实现提交，结论为“修复后可合并”，无 Critical。

- 重要问题（已修复）：Noto Sans SC 与 Inter 的来源仍指向 `tree/main`，与“来源固定”的约束不符。两者实际字节与固定 commit `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5` 下 `ofl/notosanssc/NotoSansSC[wght].ttf`、`ofl/inter/Inter[opsz,wght].ttf` 的 SHA-256 完全一致，已改为该 commit 的 blob 地址；新增 `TestBuiltinFontSourcesArePinned`，先失败后通过。
- 重要问题（经复现验证不成立）：审阅担心切换账号后，旧账号的本地错误会被重新发布到新账号。实际页面均以 `user.id` 为 key，且跨标签页切换账号必经退出并跳转 `/login`，旧错误随页面卸载清空；新增 `session-sync` 回归用例“switching accounts does not resurrect the previous account's error”，在未改动生产代码的情况下通过。`useErrorNotice` 在作用域代数变化时重跑仍属潜在脆弱点，已记为延后 Minor。
- 其余延后 Minor：字体预览失败状态粘滞、`useErrorNotice` 卸载清理、持久通知关闭后无恢复入口、后台模板字体作用域缺少身份、manifest 校验未覆盖 sources/licenses/未引用文件。均不影响本轮验收。

### 既有引用可重现

- `editor-fonts` 用例 4 证明新家族保存、重载和导出使用同一 `assetId@version`；`admin-catalog` 用例 2 证明上传字体在资源下架后仍可加载/修复/导出；`templates` 与 `full-flow` 证明模板应用和重新导入模板包保持独立作品与既有字体引用。
- 内置字体 bootstrap 的幂等、不可变和资源可读性由集成测试持续覆盖。
- 本次没有首次安装、升级或字库获取失败的阻塞项。

### 限制

- Chrome only，手机为 390×844/360×800 触摸模拟，不是真机、iOS Safari 或读屏器实测。
- 截图与日志位于 `.superpowers/` 忽略目录，不随提交分发；个人附件及导出图片只保存在本机临时目录。
- 初始化仍会请求默认 Noto Sans SC 的三个字面 URL（同一文件），属于既有行为；如果后续要求进一步减少首屏字体流量，需要单独调整默认文档引用或内置字体 URL 复用策略。

## 审阅回归修复（10 个 P2）

来源：`.superpowers/reviews/2026-11-03-editor-experience-review.md`，包含 9 个行为缺陷和 1 个未满足的按需加载要求。本轮先补失败测试再改实现，涉及工作区 14 个文件（尚未提交）。

### 修复明细

| # | 问题 | 修复 | 回归测试 |
| --- | --- | --- | --- |
| 1 | 触摸取消后数字步进继续连发 | `NumberField` 根节点处理 `pointercancel`；递增/递减按钮以 `pressEpoch` 为 key 重挂载，借卸载清理停止 Base UI 定时器 | `ui-controls › cancelling a touch hold stops the number repeat`（CDP 触摸按住 650ms 后取消） |
| 2 | 光标换字体继承粗体，霞鹜文楷无 700 导致 `CheckFonts` 422 | 光标样式进入换字体快照；`prepareFontChange` 对无 700 的家族生成 `removeBold`，应用时先 `unsetBold()` 再设置插入样式 | `editor-fonts › a cursor font change drops inherited bold the new family cannot render`（保存文档无 bold mark、服务端检查 200） |
| 3 | 粗体按钮已禁用但 Ctrl/⌘+B 仍可加粗 | `RichTextEditor` 拦截 Mod-b：按选区或光标解析当前家族，仅当已是粗体或该家族存在正常 700 字面时切换，快捷键始终被消费 | `editor-fonts › a family without a bold face ignores the bold shortcut` |
| 4 | 光标换家族后再选 700 被静默回退 400 | `FontChoiceSnapshot` 增加 `cursorStyle`，权重选择携带 `intent: "weight"`；预检按家族切换后的光标样式解析目标字重 | `prepare-change.test.ts › resolves an explicit cursor weight after a family change`；`editor-fonts › a cursor keeps an explicitly chosen weight after a family change` |
| 5 | 混合字体选区丢失可用字重层级 | 预检逐段保留新字体支持的 700/900 字重，只降级不支持的部分，并汇总一次调整提示 | `prepare-change.test.ts › preserves supported weights from mixed families in one selection` |
| 6 | 隐式斜体引用未进入 probe，服务端误判 | probe 引用集合包含探测到的斜体字面，文档仍只保留目标文本 | `prepare-change.test.ts › includes implicit italic faces in the probe document` |
| 7 | 小数边界导致步进卡住（如 100.09899999999999） | 输入、步进、Home/End 统一使用 `toPrecision(12)` 归一化后的上下界，边界处按钮正确禁用 | `ui-controls › fractional bounds stay reachable from the step button and End` |
| 8 | 重命名 Toast 重试提交旧标题 | 重试动作每次调用最新的确认函数（`confirmRef`），不再捕获旧输入；打开/关闭对话框时清空错误与重试 | `notifications › rename retry submits the title currently shown`（请求体断言 `["title A","title A","title B"]`） |
| 9 | 关闭弹窗/页面后持续错误通知残留 | `NoticeHost` 卸载时按最新 id 关闭自身通知，旧重试动作不再可用 | `notifications › closing a picker dismisses its persistent error notice` |
| 10 | 后台新建空白模板加载全部 11 个字面（约 156.6 MiB） | `TemplateEditor` 只把字体目录作为可选来源展示，实际文件仅按草稿已有引用加载；空白模板不发字体文件请求 | `templates › blank template editor loads only the fonts it needs` |

### 失败到通过

- 8 个新 E2E 先全部按预期失败：触摸取消后字号仍从 67 涨到 77；小数上界处加号仍可点；继承粗体保存出 700；WenKai 下快捷键仍加粗；显式 700 回退 400；斜体 probe 被拒；重试提交旧标题；关闭背景库后通知仍在；空白模板请求 `builtin-*-700/900`。
- 5 个新 `prepare-change.test.ts` 用例先失败（缺 `removeBold`、缺斜体引用、混合字重被整体降级、权重意图未生效），实现后全部通过。

### 复跑证据

- `pnpm contracts:check`：退出 0。
- `pnpm typecheck`：退出 0。
- `pnpm test`：18 个文件、110 个用例通过（新增 5 个）。
- 8 个新增 E2E 定向运行：8/8 通过（30.1s），使用独立测试栈。
- `pnpm test:server`：Go 全部包 `ok`。
- `pnpm build`：8/8 任务成功，仅保留既有 >500 kB chunk 警告。

### 全量 E2E 与注册限流

- 直接运行完整 Playwright 套件时，第 21 个用例起注册全部失败。根因是浏览器测试栈使用 `auth.NewService(db, nil)`（无 Redis），注册限流为每 IP 每 10 分钟 20 次；全套件从 `127.0.0.1` 注册超过 20 个账号，属于测试环境限制，不是本轮代码回归。
- 因此按注册次数拆成 5 组，每组独立启动一次性数据库的测试栈并单独记录日志：

| 组 | 文件 | 用例 | 注册数 | 结果 |
| --- | --- | ---: | ---: | --- |
| A | editor-fonts、editor-richtext、editor-settings | 17 | 17 | 17 passed |
| B | ui-controls | 17 | 17 | 17 passed |
| C | notifications、projects、templates | 9 | 9 | 9 passed |
| D | admin-catalog、autosave、editor-mobile、export、full-flow | 14 | 14 | 14 passed |
| E | copy、editor-geometry、image-upload、session-sync | 5 | 5 | 5 passed |

- 合计 62 个功能用例通过；另有 `ui-baseline` 的 2 个 opt-in 采集用例被跳过，不计入功能用例。
- `templates` 的空白模板用例最初受模板列表卡片预览影响：列表会为已有模板加载全部字体引用。用例已移到模板创建用例之前，让列表为空时采集，随后该组 9/9 通过。

### 本轮限制

- 新增的字体与通知回归只在本机 Chrome 验证，触屏为 390×844 模拟，不是真机。
- 触摸取消依赖 Base UI 未处理的 `pointercancel`；实现用重挂载按钮停止连发，若后续升级 Base UI 原生支持取消，可移除该兼容逻辑。
- 后台模板仍提供完整字体目录供选择；本轮只收窄启动时的字体文件加载范围，没有改变选择新字体后的加载路径。
