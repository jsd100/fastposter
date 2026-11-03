# FastPoster Editor Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有清新风格下统一焦点/通知，提供六家族内置字体及安全换字体、左右步进设置，并接受合法但后缀错误的图片。

**Architecture:** 共享控件继续封装 Base UI；应用层提供鉴权请求和通知作用域，编辑器负责选区与事务。字体沿用版本化资产、既有 CheckFonts 与最终导出校验，资源通过 manifest/bootstrap 幂等部署。每项包含独立验证与提交，最后统一进行浏览器、Go、导出与视觉回归。

**Tech Stack:** React 19、TypeScript、Base UI 1.9.0、CSS Modules、TanStack Query、Tiptap、Go/MySQL、ImageMagick；现有 Vitest node 与 Playwright 隔离测试栈。

**Spec:** `docs/superpowers/specs/2026-11-03-editor-experience-design.md`（已批准）；调查依据：`docs/analysis/2026-11-03-ui-font-image-analysis.md`。

## Global Constraints

- 保留当前清新风格、整体页面布局与既有数据/导出能力；不另引入整套组件库。
- Select 普通逻辑 padding 为 10px、compact 为 8px；去除 Value 的 4px 缩进和 Icon 的 -6px 边距。
- Toast 普通 4 秒、操作失败 6 秒，至多同时显示 3 条；持续阻断可常驻，不能丢失恢复入口。
- 六家族及字重：Noto Sans SC 400/700/900；Noto Serif SC 400/700/900；LXGW WenKai、ZCOOL KuaiLe、ZCOOL XiaoWei 各 400；Inter 400/700。不合成未提供的粗体/斜体。
- 不增加本机字体枚举、私有字体自动上传、任意系统字体 fallback、复杂排版预设、主题切换。
- 保留历史字体 assetId/version，ListFonts 保持最多 100 个字面且内置优先；不新增字体市场或分页 API。
- 用户上传 20MiB、可信解码 30MiB 的字体限制不放宽；官方完整字库固定来源、SHA-256 和许可证，不删字缩减覆盖。
- 图片仍只支持现有静态 PNG/JPEG/WebP；保留文件名清洗、限额、结构/解码与动画检查。
- 触屏按钮有效目标至少 44px；步进范围、单位与透明度换算遵循设计表。
- 前轮修复有未提交修改；先保存其准确补丁/文件清单，后续精确暂存，不能覆盖、回滚或混入不相关工作。
- 节点、API 类型和测试沿用仓库既有约定；不新增 jsdom/Testing Library，也不直接编辑生成契约文件。

## Review Focus

1. 换字体的异步请求返回时文字、选区或账户已变化：不得应用旧结果，也不得把旧账号错误显示给新账号；Tasks 2、6。
2. 有损坏/缺字内容的旧作品中修复一个选区：预检只检查目标范围，不被其他范围阻止；操作失败不改引用或排版；Tasks 5、6。
3. 长按/触屏步进及混合字号：一步撤销恢复一次操作，选区不丢、透明度不误写成 50、动态上限不越界；Task 7。
4. 已有安装升级、字体加载失败后重试与菜单预览：不清库，不重复下载/注册，不留下拒绝的永久缓存；Task 4。
5. 弹窗内 Toast 与错后缀图片：通知可见且可访问，合法内容成功，伪造/损坏内容仍拒绝，响应 MIME 与后缀正确；Tasks 2、3。

## File Structure and Interfaces

- `packages/ui/src/Input.tsx`、`Input.module.css`、`Select.module.css`：焦点基础类和留白；`Notifications.tsx`、`Notifications.module.css`、`notifications.ts`：通知视图与去重/作用域管理。
- `packages/ui/src/Combobox.tsx`、`Combobox.module.css`：可搜索家族选择；`NumberField.tsx`、`NumberField.module.css`：原输入与 stepper 变体。
- `server/internal/assets/service.go`：按真实格式纠正名称；`builtin_fonts.go`、新 `builtin_manifest.go`：读取/验证字体定义、bootstrap 与内置优先列表。
- `assets/fonts/manifest.json`：文件哈希、来源、许可、字面定义；新增四个完整字库与对应许可文件。
- `packages/poster-renderer/src/FontRegistry.ts`：加载去重与失败重试；`packages/poster-editor/src/fonts/{catalog,prepare-change}.ts`：显示元数据与纯候选文档变换；`FontPicker.tsx`、`useFontChoice.ts`：按需预览和异步选择。
- `packages/poster-editor/src/Editor.tsx`、`text/selection.ts`、`store.ts`、panels：选择快照、原子应用与数字事务；`ProjectWorkspace.tsx`、`TemplateEditor.tsx`：注入鉴权 CheckFonts。
- 新测试放同模块 `.test.ts`、`tests/e2e/editor-fonts.spec.ts`、`editor-settings.spec.ts`、`notifications.spec.ts`；修订旧 ui-controls/admin-catalog/upload 测试。
- `docs/verification/editor-experience.md`：基线、字库大小/来源、测试与视觉结果；截图和临时统计放独立忽略目录，不以历史原型替代真实截图。

所有新公共组件从 `packages/ui/src/index.ts` 导出。后续任务只消费下述明确接口；可以拆私有文件，不更改接口含义。

---

### Task 1: Capture baseline and fix shared focus/insets

**Files:** Modify `packages/ui/src/{Input.tsx,Input.module.css,Select.module.css}`、`apps/web/src/styles.css`、`apps/admin/src/styles.css`、`packages/poster-editor/src/styles.css`、`tests/e2e/ui-controls.spec.ts`；Create `docs/verification/editor-experience.md`。

**Interfaces:** TextInput/Textarea 的既有 props 不变；bare 也包含基础焦点类，尺寸规则独立。Select 的普通/compact 密度沿用既有接口。

- [ ] **Step 1:** 按 using-git-worktrees 检查当前隔离状态；保留前轮未提交修复，在最终目录运行基线 `pnpm typecheck`、`pnpm test`、`pnpm build --force`。记录真实结果与当前 HEAD/补丁；缺失依赖或旧失败先归因。
- [ ] **Step 2:** 按 `tests/e2e/ui-baseline.spec.ts` 现有隔离栈/固定数据，采集桌面 1440×1000、触屏模拟 390×844 的库搜索聚焦、Select、右侧设置和后台表单基线；用独立输出目录避免 Playwright 清理产物。
- [ ] **Step 3:** ui-controls 新增 `bare picker search uses the green focus treatment`，断言模板/背景搜索聚焦的 border/shadow 使用 `#88a471` 和现有绿色阴影，outline 不为蓝色默认轮廓。将旧 caret 测试改为左右文字/图标视觉内距差 ≤2px，保留长文本与整行点击断言。
- [ ] **Step 4:** `pnpm exec playwright test tests/e2e/ui-controls.spec.ts --grep 'green focus|insets|right edge'`，确认失败来自现有蓝色 outline/偏移规则；随后添加最小共享焦点类，去掉两处偏移，将消费者 padding 收敛到 10/8px，保留外框度量。
- [ ] **Step 5:** 重跑上述 E2E、`pnpm typecheck` 和 `pnpm test`，对照截图并记录。精确提交本任务文件，提交说明 `fix(ui): unify themed focus and balanced select insets`。

### Task 2: Add scoped notifications and migrate error presentation

**Files:** Create `packages/ui/src/{Notifications.tsx,Notifications.module.css,notifications.ts,notifications.test.ts}`；Modify `index.ts`、`apps/web/src/main.tsx`、`apps/web/src/features/auth/Session.tsx`、`apps/admin/src/main.tsx`。迁移 `apps/web/src/features/{auth/AuthPage,auth/PasswordPage,catalog/BackgroundPicker,catalog/CopyPicker,editor/ConflictDialog,export/ExportDialog,projects/ProjectWorkspace,projects/ProjectsPage,templates/TemplatePicker}.tsx`、`apps/admin/src/features/{Metadata,Resources,copy/CopyForm,copy/CopyList,copy/CopyPage,templates/TemplateEditor,templates/TemplateList}.tsx`、`packages/poster-editor/src/Editor.tsx`；Create `tests/e2e/notifications.spec.ts`；Update 所有受错误展现影响的现有 E2E。

**Interfaces:**
- `Notice = {id?:string;tone:'info'|'success'|'error';title:string;description?:string;persistent?:boolean;action?:{label:string;onClick:()=>void}}`。
- `NotificationsProvider({children}: {children:ReactNode}):ReactElement`；`useNotify(): {show:(notice:Notice)=>string;close:(id:string)=>void}`。
- `useNotificationScope(scopeKey:string):void`：身份切换时清空通知并递增 generation；show 回调绑定其获取时的 generation，旧异步回调在新作用域不发通知。web 在 SessionProvider 内的桥接组件使用 user.id/anonymous；admin 在其用户状态 effect 使用相同机制。
- 状态型错误适配 `useErrorNotice(id:string,error:string|null,options?:{persistent?:boolean;action?:Notice['action']}):void`：使用应用侧 errorMessage 后提供可显示文案，不让 UI 包依赖 API client；清除状态时关闭对应 id。

- [ ] **Step 1:** 写管理逻辑测试：同 id 更新而非重复入队、普通/错误时长为 4000/6000、reset 后旧 generation 的 show 不生效。浏览器写 `failed upload creates one toast without stealing focus`、`toast from a modal is accessible and retryable`、`account switch clears old notices`，断言实际 toast/action 和后续请求成功，不能只检查源码字符串。
- [ ] **Step 2:** 运行 `pnpm exec vitest run packages/ui/src/notifications.test.ts` 和 notifications E2E，确认因接口/行为缺失失败。
- [ ] **Step 3:** 实现 Base Toast 的去重、最多 3 个可见项、顶部居中与手机安全区；普通 4s、失败 6s、持续错误常驻，悬停/聚焦暂停，关闭/重试不抢编辑焦点。模态打开时选择可访问且不被遮挡的 Portal 容器；不能仅提高 z-index 便认为辅助技术可见。
- [ ] **Step 4:** 挂载 Provider/作用域，逐消费场景迁移；操作错误在 catch/操作结果通知，查询错误用稳定资源 id；不要直接在 render 通知。字段关联、持久保存状态、现有冲突 Dialog 与重试动作保留；调整原 getByRole('alert') 断言时继续验证具体错误及恢复结果。
- [ ] **Step 5:** 对同一持续失败反复编辑/重绘的测试断言只有一条；切账号时故意延迟旧请求，确认无旧通知残留。执行 typecheck、单测及 notifications/ui-controls/session-sync E2E，通过后提交 `feat(ui): add scoped themed notifications`。

### Task 3: Accept supported image content with incorrect extensions

**Files:** Modify `server/internal/assets/service.go`、`server/internal/assets/normalize_test.go`、`server/tests/integration/assets_http_test.go`；Create `server/internal/assets/names_test.go`、`tests/e2e/image-upload.spec.ts`。

**Interfaces:** `safeName(name, format string) (string,error)` 保持签名；基名清洗与长度校验保留，依据已探测的 png/jpeg/webp 将缺失或不符后缀纠正为 `.png`/`.jpg`/`.webp`，合法 jpeg 的 `.jpeg` 可以保留。Upload/Read DTO 与路由不变。

- [ ] **Step 1:** 写 `TestSafeNameUsesDetectedFormat` 表驱动测试：`a.jpg + png → a.png`、`a.PNG + png → a.png`、`a + jpeg → a.jpg`、路径/控制字符仍清洗、过长名仍错误。把 HTTP 测试中“PNG 命名 jpg 应 422”改为成功，断言 Content-Type、规范化下载名及 1152×2048 同类 fixture 的实际尺寸；保留损坏和伪装内容失败断言。
- [ ] **Step 2:** `go test ./server/internal/assets -run 'Name|Corrupt|Mislabeled' -count=1`，再用 `python3 tools/test-integration.py -run TestAssetHTTPUploadAndPrivateRead -count=1 -v` 确认目标失败，不能将环境启动错误当 RED。
- [ ] **Step 3:** 仅改变合法探测结果后的命名策略；沿用 Probe、Normalizer 和 MIME/原图/预览读取逻辑，不放宽白名单/尺寸/字节/动画限制。必要时在既有 metadata 记录原名称，不改表结构。
- [ ] **Step 4:** E2E 以现有小 PNG fixture 的 bytes 加 `.jpg` 上传名，验证可建作品/后台背景、预览尺寸与导出；人工使用用户附件核验，不将个人附件强制入库。运行本包 Go、HTTP 集成和 image-upload E2E；通过后提交 `fix(assets): trust validated image format over filename extension`。

### Task 4: Ship six builtin families and cache font loading

**Files:** Modify `assets/fonts/manifest.json`；Create 字库 `assets/fonts/{NotoSerifSC-VF.ttf,LXGWWenKai-Regular.ttf,ZCOOLKuaiLe-Regular.ttf,ZCOOLXiaoWei-Regular.ttf}` 及 `assets/fonts/{NotoSerifSC,LXGWWenKai,ZCOOLKuaiLe,ZCOOLXiaoWei}-OFL.txt`；Create `server/internal/assets/{builtin_manifest.go,builtin_manifest_test.go}`；Modify `server/internal/assets/builtin_fonts.go`；Create `server/tests/integration/builtin_fonts_test.go`；Modify `packages/poster-renderer/src/FontRegistry.ts`；Create `packages/poster-renderer/src/{font-cache.ts,font-cache.test.ts}`。

**Interfaces:**
- manifest 保留现有 files/sources/licenses，新增 `faces` 数组：`{id,family,file,weight,style:'normal'}`；共 11 个字面，原有四个 ID 不改。新增 ID 为 `builtin-noto-sc-900`、`builtin-noto-serif-sc-{400,700,900}`、`builtin-lxgw-wenkai-400`、`builtin-zcool-kuaile-400`、`builtin-zcool-xiaowei-400`。
- Go `loadBuiltinManifest(root string) (builtinManifest,error)` 验证文件/hash/字面定义，BootstrapFonts 幂等添加；ListFonts 优先识别 manifest 内置 ID，不信任用户可填写的 family 字符串来认定内置身份。
- `loadFonts(fonts:FontSource[]):Promise<void>` 保持公开签名及同源限制。内部 `loadOnce<T>(key:string,loader:()=>Promise<T>):Promise<T>` 分别合并 source URL/version 的文件读取与 weight/style/alias 的字面注册，失败移除缓存以便重试；同源检查必须在使用缓存前执行。不能用 alias 级缓存让同一源文件仍重复下载。

- [ ] **Step 1:** 写 `TestBuiltinManifestDeclaresSixFamilies`，断言六家族/11 字面、旧 ID、实际字重可解析和哈希正确。集成 `TestBuiltinFontsUpgradeIsIdempotent` 先创建只有原四字面的旧状态，升级两次后新字面只出现一次；`TestBuiltinFontsRemainVisibleAtCatalogLimit` 发布超过 100 个自定义字面后断言返回 ≤100 且全部内置仍可发现。
- [ ] **Step 2:** 写缓存测试：同 key 两个调用只执行一次真实 loader、失败后再次调用能成功，不把已拒绝 Promise 永久缓存。运行 Go/Vitest 对应测试，确认未实现行为失败。
- [ ] **Step 3:** 从设计列出的官方来源取得完整资源，固定 release/commit、哈希和许可证；记录每个文件及解析后大小，实际通过 `ParseNormalized` 与字形测试。不要先下载不完整 Web 子集冒充完整字库；若可信限制仍不满足，按设计报告资源阻塞，不偷偷换家族或取消限额。
- [ ] **Step 4:** 实现 manifest/bootstrap/排序与浏览器加载缓存；保留跨 alias 的同家族字面注册能力、版本化引用和失败重试。UI 候选仅加载正在预览/实际使用的家族，不在初始化时下载六家族。
- [ ] **Step 5:** 对每个中文家族运行短句、标点、换行与真实覆盖测试；Inter 保留中文缺字断言。执行本包 Go、bootstrap 集成、renderer 单测、typecheck/build；通过后提交 `feat(fonts): bundle six families with versioned loading`。

### Task 5: Prepare atomic font changes and scoped validation documents

**Files:** Create `packages/poster-editor/src/fonts/{catalog.ts,prepare-change.ts,prepare-change.test.ts}`；Modify `text/selection.ts`、`text/selection.test.ts`、`Editor.tsx`、`store.ts`、`store.test.ts`。

**Interfaces:**
- `FontTarget = {blockId:string;target:TextTarget}`，复用 selection.ts 的 range/cursor/block。
- `PreparedFontChange = {nextDocument:PosterDocument;probeDocument:PosterDocument;target:FontTarget;insertionStyle:InlineStylePatch;removeItalic:boolean;adjustments:string[]}`。
- `prepareFontChange(doc:PosterDocument,target:FontTarget,chosen:FontSource,fonts:FontSource[]):PreparedFontChange` 是无副作用变换；probe 只含目标文本与必要引用，但必须通过既有 parseDocument。
- `firstTargetStyle(doc:PosterDocument,target:FontTarget):InlineStyle` 返回目标起始文字的有效样式，供混合字号步进与光标基准使用。
- `applyPreparedFontChange(change:PreparedFontChange):void` 为 Editor 内部原子应用入口：相关引用+选区样式同一事务；光标仅更新引用/插入样式，不改已有文字。不能沿用原 apply() 先 transact 引用再单独改字样式的两次历史。

- [ ] **Step 1:** 测试“你好风景世界”只给“风景”换字体，外侧 marks/字号不变；整块切换、空光标、混合字重、无 700/斜体的新家族清理仅目标样式；probe 不含其他范围且 parseDocument 通过。测试一次 undo 同时恢复样式和字体引用。
- [ ] **Step 2:** `pnpm exec vitest run packages/poster-editor/src/fonts/prepare-change.test.ts packages/poster-editor/src/store.test.ts`，确认缺失变换/历史语义失败。
- [ ] **Step 3:** 实现候选文档：保留可用字重，否则 400；新家族不支持的 bold/italic 在目标范围清理；生成只含目标内容的规范 probe。字体引用限制仍为 100，未通过预检不写入真实 store。catalog 显示映射仅六家族，未知后台字体显示其真实 family，不假装有固定类别/中文覆盖。
- [ ] **Step 4:** 将原子应用与 Tiptap 事务/序列化接通，正确恢复 selection 和 stored marks，防止 onUpdate 导致重复历史；修改时只处理字体路径，普通字号/颜色 apply 行为保留。
- [ ] **Step 5:** 重跑上述单测和现有 selection/store 单测，检查所有比较值来自固定夹具；通过后提交 `feat(editor): prepare scoped atomic font changes`。

### Task 6: Add searchable preview and race-safe font preflight

**Files:** Create `packages/ui/src/{Combobox.tsx,Combobox.module.css}`；Modify `packages/ui/src/index.ts`；Create `packages/poster-editor/src/fonts/{FontPicker.tsx,FontPicker.module.css,useFontChoice.ts}`；Modify `packages/poster-editor/src/panels/TextPanel.tsx`、`packages/poster-editor/src/Editor.tsx`、`apps/web/src/features/projects/ProjectWorkspace.tsx`、`apps/admin/src/features/templates/TemplateEditor.tsx`；Create `tests/e2e/editor-fonts.spec.ts`；Update `tests/e2e/helpers.ts`、`tests/e2e/{admin-catalog,editor-richtext,editor-mobile,full-flow}.spec.ts`。

**Interfaces:**
- `ComboboxOption = {value:string;label:string;group?:string;disabled?:boolean}`；`Combobox({value,options,onValueChange,onHighlightChange,'aria-label',preview}: {value:string;options:readonly ComboboxOption[];onValueChange:(value:string)=>void;onHighlightChange?:(value:string|null)=>void;'aria-label':string;preview?:ReactNode}):ReactElement`。
- `EditorProps` 新增必需 `checkFonts:(candidate:PosterDocument)=>Promise<void>`、`fontCheckScope:string`；用户/后台两个实际调用方分别注入现有 `routes.CheckFonts` 请求及身份+作品/模板 scope，不让 editor 直接引用应用 API 模块。IDL/DTO 不变。
- `useFontChoice` 消费 Task 5 prepare/apply、Task 4 loadFonts、当前 scope/文档/目标快照；产生 `choose(font:FontSource):Promise<void>`、`pending:boolean`、候选错误和预览状态。请求签名包含文档内容、目标范围、实际样式、字体版本与作用域。

- [ ] **Step 1:** 写 E2E：搜“宋体/文楷”可定位家族；高亮预览不改字体引用/dirty 状态；选区中文换 Inter 被拒绝且文档不变，选中英文则成功；新中文字体实际渲染且保存/重载/导出使用相同版本。
- [ ] **Step 2:** 补失败/竞态场景：延迟 CheckFonts 后改选区或换作品/账号，旧结果不应用也不弹旧 Toast；其他文字块已有缺字时仍能修复当前目标；字体文件首次失败后重试成功。运行 editor-fonts E2E，确认新交互缺失时失败。
- [ ] **Step 3:** 组装 Base Combobox，中文优先分类、静态 UI 标签，独立预览区只加载高亮家族。共享弹层/Toast 不破坏模态可访问性，保留可访问名字和移动端键盘操作。
- [ ] **Step 4:** 预检加载字体+调用已有 CheckFonts，成功且快照仍匹配才 apply；错误沿用 API 的缺字明细，保留原排版并可选择中文替代；光标无待输入内容时跳过空内容覆盖检查，保留后续全局/导出检查。成功换字样一次撤销，样式降级仅通知一次。
- [ ] **Step 5:** 更新旧字体选择器测试辅助逻辑以区分真正 Select 与可搜索 Combobox，保留字重/缩放测试。旧“切中文到 Inter 后错误且禁导出”改为“预检拒绝且原文档可导出”，另保留加载既有缺字文档的持续错误/修复测试，不能删除覆盖。
- [ ] **Step 6:** 运行 typecheck、单测、editor-fonts/admin-catalog/richtext/mobile/full-flow E2E，测试新家族真实字体和导出，不只检查名称。通过后提交 `feat(editor): preview and validate fonts before applying`。

### Task 7: Add stepper controls and coherent numeric interactions

**Files:** Modify `packages/ui/src/{NumberField.tsx,NumberField.module.css}`；Modify `packages/poster-editor/src/panels/{TextPanel,ParagraphPanel,StylePanel}.tsx`、`Editor.tsx`、`store.ts`、`styles.css`；Create `tests/e2e/editor-settings.spec.ts`；Update `tests/e2e/{ui-controls,editor-mobile,editor-richtext}.spec.ts`。

**Interfaces:** 在 `NumberFieldProps` 新增 `variant?:'input'|'stepper'`（默认 input）、`unit?:string`、`stepBase?:number`、`onInteractionStart?:()=>void`、`onInteractionEnd?:()=>void`。value/onValueChange 继续为展示数值单位；百分比在 StylePanel 边界做 `/100` 与 `*100` 转换。

- [ ] **Step 1:** E2E 使用带名称的减/加按钮实际点击，字号 64→65→64；行高 1.5→1.6；字距允许负数；透明度 50→55 显示为 % 且文档 effects.opacity=0.55。边界按钮禁用，动态 padding 不越界。
- [ ] **Step 2:** 测混合选区字号：目标起始文字 64、其他 80，混合字段按 + 以 64 为基准得到 65，仅选区变化；undo 恢复原混合样式。长按增加多次后一次 undo 恢复按住前值；触屏点击不丢 Tiptap 选区、不提交表单、不超出屏幕。
- [ ] **Step 3:** 运行 editor-settings E2E，确认因缺少按钮/事务失败。然后实现 Base Group/Decrement/Input/Increment，使用 stepBase 处理 null，保留所有 raw 草稿/Enter/Escape/IME/导航保护，不重新交给解析后数值判断 pending。
- [ ] **Step 4:** 用 Editor/store 事务包住一次点击或按住：start begin，过程中 update，end commit；不要每次 repeat 都 transact。字号范围用 Task 5 firstTargetStyle，段落/效果沿现有 update；选择离开、指针取消或失焦收尾，避免阻塞 autosave 的 inTransaction。
- [ ] **Step 5:** 按设计表启用字号/行高/字距/效果，统一单位、精度、边界与可访问名称；颜色不变。输入组最小可用宽度不足时单列，触屏目标 44px。执行 editor-settings/ui-controls/mobile/richtext E2E 与 typecheck/test/build，通过后提交 `feat(editor): add bounded numeric steppers with grouped undo`。

### Task 8: Verify all workflows and document the result

**Files:** Update `docs/verification/editor-experience.md`；按实际缺陷修改其所属任务文件；截图/统计保存独立忽略目录。

**Interfaces:** 消费已完成的控件、11 个字体字面与既有上传/导出链路；产出可复核的验收证据。

- [ ] **Step 1:** 按 Task 1 固定数据/视口采集 after，补开着的字体菜单、预览、Toast、步进组；检查绿色焦点、10/8px 留白、文字层级、画布/导航不受无关改变。手机模拟与桌面各有实测记录。
- [ ] **Step 2:** `pnpm typecheck`、`pnpm test`、`pnpm build --force`；执行 `pnpm contracts:check`（本计划不应改 IDL）；记录各应用原始/gzip 变化和字库体积。检查客户端初始化请求不加载六家族完整字库，重复预览/换字体不重复加载。
- [ ] **Step 3:** `go test -count=1 ./server/... ./tools/...`；使用 `python3 tools/test-integration.py -run 'TestAssetHTTPUploadAndPrivateRead|TestBuiltin' -count=1 -v` 运行实际新增集成测试。若实际命名不同，同步本计划/记录，不把没有命中测试的 PASS 当证据。
- [ ] **Step 4:** 完整功能 E2E 含新增 notifications/image-upload/editor-fonts/editor-settings；按每组注册次数 ≤10 拆分并顺序启动测试栈，使用独立输出避免端口和 trace 冲突。原 ui-baseline 采集为 opt-in，单列实际运行范围；不以跳过项补通过数量。
- [ ] **Step 5:** 人工核验用户错后缀附件能上传并导出；已有文档/模板包字体引用保持可重现。若首次安装/升级/字库获取失败，记录具体阻塞和未验收项，不宣称完成。
- [ ] **Step 6:** 按 verification-before-completion 核对输出并请求一次独立代码审阅，修复实质问题后重跑受影响用例。最后使用 finishing-a-development-branch 汇报本地改动、验证与限制，不自动推送、合并或发布。

## Self-review and execution order

覆盖检查：焦点/留白→1；通知/身份隔离→2；图片内容识别→3；六家族/升级/缓存→4；范围/样式/历史→5；预览/预检/竞态→6；数值控件/事务→7；整体视觉和导出→8。Review Focus 五项均有明确所属测试。

接口检查：TextInput 原 onChange 保留；NumberField 原数值契约保留，透明度在消费方换算；Font preflight 使用已有 CheckFonts，编辑器通过必需回调注入；字体预览不调用 apply；通知旧 generation 不进入新作用域。

执行依赖：1→2；3 可独立验收；4→5→6；7 复用 2/5；8 汇总全部。本计划按同一会话 1–8 顺序执行即可；建议由一个实施者保持选区/事务接口一致，最后独立审阅，而非按文件并发修改共享状态。
