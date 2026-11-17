# 编辑器与画廊功能实施计划

> 执行技能使用 superpowers:subagent-driven-development 或 superpowers:executing-plans。每项任务按复现、实现、验证和独立提交推进。

**目标**　交付九宫格开关、文字效果预设、连续字重、选区渐变、卡片高亮、背景放大和回收站布局。

**架构**　编辑器与渲染器继续复用现有工作区包。前端交互、效果和字重可以先分别验收。渐变在可行性验证通过后再联动文档校验、编辑与导出。

**技术栈**　React、TypeScript、Tiptap、Ant Design 6.7.0、Go、Vitest、Playwright、Chrome、ImageMagick。

**设计**　[编辑器与画廊功能设计](../specs/2026-11-16-editor-gallery-features-design.md)

## 全局约束

- 沿用 Ant Design 6.7.0 默认主题、现有 UIProvider 和共享 Editor。维护 renderer 的 antd 隔离。
- 现有项目、模板、持久化草稿和导出快照均在回归范围。保留创建背景与替换背景的不同确认流程。
- 背景大图仅在用户站「用背景创建」和「替换背景」的 BackgroundPicker 两种模式交付。后台背景资源及合成海报模板放大留待后续。
- 画布和列表验证 1440×1000、1024×768、768×1024、390×844 和 320×700，移动端主操作命中区 ≥44×44px。回收站另保留 360px 回归。
- 执行 E2E 前运行 `pnpm --filter @fastposter/renderer build`。按 spec 独立启动临时服务栈，用 `GOPROXY=off GOSUMDB=off` 和独立结果目录。MySQL 使用 `fastposter_test_*` 库。
- 每项产品任务完成 RED/GREEN、定向格式化和验证后独立提交。只 stage 该项文件。最终统一运行 `pnpm verify`、`pnpm test:server` 和相关真实集成、浏览器测试。记录实际执行、跳过和对应证据。

## 文件分工

| 范围 | 现有入口及职责 |
| --- | --- |
| 九宫格 | `packages/poster-editor/src/{Editor,Stage,SelectionHandles}.tsx` 负责视图、舞台坐标和手势，两站工作台分别提供偏好读取作用域 |
| 卡片与回收站 | `apps/web/src/features/projects/ProjectList.tsx` 负责作品及回收站卡片。两站列表入口继续各自负责操作，默认主题交互样式放在 `packages/ui/src/styles.css` |
| 背景放大 | `apps/web/src/features/catalog/BackgroundPicker.tsx` 负责当前资源版本与模式，`packages/ui` 现有弹层注册机制处理 Escape 层级 |
| 效果 | `packages/poster-editor/src/panels/StylePanel.tsx` 管理预设与表单，`packages/poster-renderer/src/PosterFrame.tsx` 沿用现有效果渲染 |
| 字重 | `packages/poster-editor/src/fonts` 和 `TextPanel.tsx` 管理选择，`FontRegistry.ts` 管理注册。Go 的 `fontfile`、`catalog`、`exports` 管理可用性与导出 |
| 渐变 | `poster-schema/src/{types,schema}.ts` 与 `server/internal/document` 管理文档形态，Tiptap 扩展和 `RichText` 管理编辑与渲染 |

## Review Focus

- 预览打开期间 Catalog 核验发现原选择过期。关闭预览后原有确认验证仍执行，取消不产生写入（任务 4）。
- 同一账号在同站刷新时恢复九宫格，账号切换或本地存储被禁用时仍能操作且不会读到别人的配置（任务 1）。
- 一个资产的旧字体版本和新字体版本具有不同轴范围，同一个页面仍按各自版本渲染（任务 6）。
- 渐变覆盖中间一段后留下不相邻的原色片段，且剪贴板内容再次应用。同组连续，粘贴目标独立（任务 9）。
- 旧页面或旧导出任务与启用渐变的版本交错，已有渐变不会静默丢失，已排队旧任务仍可完成（任务 10）。

---

### 任务 1　共享九宫格开关

**文件**　修改 `packages/poster-editor/src/{Editor,Stage}.tsx`、`styles.css`、`apps/web/src/features/projects/ProjectWorkspace.tsx`、`apps/admin/src/features/templates/TemplateEditor.tsx`。测试 `tests/e2e/editor-geometry.spec.ts`。

**接口**　`Editor` 接收可选的账号作用域 `viewPreferenceScope?: string`。两站传入各自站点和账号。 `Stage` 接收 `showGrid: boolean` 和 `onShowGridChange: (visible: boolean) => void`。

- [ ] 写 `nine-grid follows the canvas without writing`。断言辅助线初始化不可见，开关后两横两竖在画布的 ⅓、⅔，缩放与平移后误差 ≤1 CSS px，拖动仍成功。切换时文档修订与撤销状态保持。
- [ ] 写 `nine-grid preference is account scoped`。断言刷新同账号恢复，换账号默认关闭，拦截存储读写后仍能切换。补用户和管理员视口访问。
- [ ] 运行 `pnpm test:e2e tests/e2e/editor-geometry.spec.ts -g 'nine-grid'`，新增开关断言应失败。
- [ ] 实现 `Editor` 偏好读写和 `Stage` 开关及辅助线。复用手柄坐标，辅助线为装饰层，无指针事件。两站同一接口，偏好切换独立于海报历史。
- [ ] 重跑定向测试。导出同一修订的开关两种状态，`magick compare -metric AE` 差异为 0。提交 `feat(editor): add a configurable thirds grid`。

### 任务 2　回收站卡片操作区

**文件**　`apps/web/src/features/projects/ProjectList.tsx`、`apps/web/src/styles.css`、`tests/e2e/project-permanent-deletion.spec.ts`。

- [ ] 写 `trash actions fit each project card`。用长标题建立回收站项目，在 320、360、390px 和桌面窄列分别断言「恢复」「彻底删除」按钮边界都包含在所属卡片内，页面无横向溢出，危险按钮触发原对话框。
- [ ] 运行该 spec 的 `-g 'trash actions fit'`，至少一个窄列场景暴露旧布局。页面宽度断言作为独立守卫。
- [ ] 只对回收站作品卡设布局修饰类，操作区单独占下一行，以实际可用宽度换行，保留文案、颜色、触控区和原回调。
- [ ] 重跑该用例和 `-g 'deletion dialog defaults to cancel'`。提交 `fix(web): keep trash actions inside cards`。

### 任务 3　列表卡片高亮

**文件**　用户站 `ProjectList`、`TemplatePicker`、`BackgroundPicker`、`CopyPicker`，管理站 `TemplateList`、`Resources`、`CopyList` 与 `packages/ui/src/styles.css`。测试 `tests/e2e/ui-baseline.spec.ts`。

- [ ] 写 `actionable cards expose hover and keyboard focus`。断言作品、回收站、背景卡、两站模板和管理端素材或文案在悬停及内部按钮键盘聚焦时有可见反馈，选中背景移开鼠标后仍为选中。覆盖减少动态效果与静态骨架。
- [ ] 运行该用例，验证当前缺少统一悬停或焦点反馈。
- [ ] 整卡入口使用 `Card hoverable` 或匹配样式。多操作卡以共享类提供 hover 和 focus-within，复用 antd 默认阴影，指针只落在真正可点的控件。保留焦点环和选中标识。
- [ ] 重跑用例，附正常和键盘焦点截图，核对窄卡片操作区。提交 `feat(ui): unify actionable card feedback`。

### 任务 4　用户站背景大图

**文件**　`apps/web/src/features/catalog/BackgroundPicker.tsx`、`apps/web/src/styles.css`、`tests/e2e/projects.spec.ts`、`tests/e2e/full-flow.spec.ts`。

**接口**　BackgroundPicker 内部的预览目标按资源 ID 和版本识别，受控 `Image.preview` 的 `src` 指向 `asset.url`。`mode`、`onChoose` 和既有按钮名称保持当前调用契约。

- [ ] 写 `background preview does not select or create` 和 `background preview does not replace`。打开前只有缩略图，点击独立的「放大预览」后请求版本原图。断言缩放可用，Esc 第一次关闭大图并聚焦原入口，第二次才关闭背景库。打开预览无创建、替换或选中写入。
- [ ] 在创建用例中覆盖已选项、筛选、滚动、资源版本更新和原图失败。关大图后保留可用选择，版本过期仍由现有确认校验处理。替换用例保留 `选用 ${title}` 单击动作。
- [ ] 分别运行两个 spec 的 `-g 'background preview'`。旧界面因独立预览入口缺失而失败。
- [ ] 将放大与原选择按钮作为同级可聚焦入口，按需挂载受控预览，关闭或资源退出可见列表时释放弹层注册。用现有 Dialog 弹层并核对焦点恢复和原图错误提示。
- [ ] 每个 spec 单独复跑。补 390px 触控预览证据。提交 `feat(web): zoom backgrounds in the create and replace pickers`。

### 任务 5　阴影和描边预设

**文件**　`packages/poster-editor/src/panels/StylePanel.tsx`、同目录新表 `effect-presets.ts`、`tests/e2e/editor-fonts.spec.ts`。

**接口**　`effect-presets.ts` 导出阴影/描边预设列表，每项包含 `label: string` 与对应 `TextBlock["effects"]` 字段的 `patch`。描边关闭预设只写宽度。按设计 §2 的数值初始化。

- [ ] 写 `effect presets apply visibly and undo in one step`。断言柔和阴影 computed style 含 `2px 3px 6px` 和非零 alpha，暗色细描边宽为 1px，从关闭态启用自定义立即可见，应用后一次撤销。改色为全透明后不会自动复活阴影，背景色和另一种效果保留。
- [ ] 运行 `pnpm test:e2e tests/e2e/editor-fonts.spec.ts -g 'effect presets'`，应因缺入口失败。
- [ ] 在面板加入带示例字的快捷选择，通过一次 `update` 应用 patch，按有效参数显示预设或自定义。保留现有颜色和数值交互。
- [ ] 复跑新用例和现有 effect color 用例，采样亮底、暗底和透明导出。提交 `feat(editor): add shadow and outline presets`。

### 任务 6　连续字重闭合字体和导出链

**文件**　`packages/poster-editor/src/panels/TextPanel.tsx`、`fonts/{prepare-change,useFontChoice}.ts`、`packages/poster-renderer/src/FontRegistry.ts` 及其两站和 renderer 调用点。Go 的 `server/internal/fontfile/{font,coverage}.go`、`catalog/coverage.go`、`exports/{fonts,service,worker,renderer}.go`。测试 `fonts/prepare-change.test.ts`、`fontfile/coverage_test.go`、`exports/fonts_test.go`、`tests/e2e/editor-fonts.spec.ts`。

**接口**　由字体能力解析输出 `minWeight`、`maxWeight` 和真实样式，解析输入为授权的精确资产版本。 `FontSource` 需要提供真实范围或允许注册时读取。请求的 `fontWeight` 与来源 `FontSource.weight` 分离。复用现有持久文档和 `FontRef`。

- [ ] Go 写 `TestVariableWeightUsesReferencedVersion`。默认和选区分别测试只有标称 400 引用可正确选择支持 250 的字节，成对测试换成静态文件或不覆盖该值的文件时拒绝。加入缺失斜体、损坏文件，以及同资产不同版本的覆盖用例。
- [ ] 前端写 `keeps a supported continuous weight on family change`，断言 `250 → 250` 或目标字体下限回退走现有提示且保留字形样式。E2E 写 `thin variable text saves and exports`，从 400 引用设置 250，断言保存后只有对应资源引用，重开仍为 250，实际导出成功。验证 100、700、历史 900、静态字体和一次撤销；独立生成不同字重的像素或字形样本。
- [ ] 运行 `go test ./server/internal/{fontfile,exports,catalog}`、`pnpm exec vitest run packages/poster-editor/src/fonts/prepare-change.test.ts` 和新 E2E。确认 250 的离散查找或 UI 断言为失败原因。
- [ ] 从已有 Go `fvar` 解析提取轴能力，并统一覆盖与导出选择顺序。入队先做可访问引用的廉价检查，精确的版本字节和覆盖验证移出 SQL 写事务长时间 I/O，保证入队和 worker 对同一版本给出一致结果。实现时按当前存储 API 选择可信版本元数据，或在验证过的不可变快照上复用解析。禁止相信客户端自行声明的字重范围。
- [ ] 通过 `FontRegistry` 将可变资源按真实范围注册。CSS alias 与缓存按文档引用的资产版本选择。浏览器与 Go 都优先选同家族同样式的精确资源，随后才选覆盖请求字重的可变资源。面板维持现有 100–900 文档契约，滑杆取可用范围与 100–700 的交集。保留样式命令和一次手势历史。
- [ ] 复跑全部定向测试、`editor-fonts.spec.ts` 相关导出过滤用例和已有静态字体拒绝校验。提交 `feat(editor): support continuous font weights through export`。

### 任务 7　渐变渲染可行性验证

**文件**　一次性对照页面和采样输出放临时目录。验证结论写入 `docs/verification/2026-11-16-text-gradient-rendering.md`。

- [ ] 制作设计 §4.3 的对照样例，至少包含实际两行、同范围不同字号、两种渐变与纯色并排、阴影和描边、透明背景。
- [ ] 对比按片段使用 CSS `slice` 和按同一范围共享绘制坐标。取每行可靠的字形内部、描边、阴影和外部 alpha 样本。验证特定角度、径向圆心、Tiptap 选区及输入命中、换行稳定、透明 PNG。仅把能同时满足这些条件的方案交给后续任务。
- [ ] 记录原型的布局来源、范围分组和遮罩/字形效果方案、采样脚本及结果。若未通过，报告具体视觉偏差，渐变写入保持关闭，其余任务独立交付。

### 任务 8　渐变协议和双端读取

**文件**　`packages/poster-schema/src/{types,schema,schema.test}.ts`、`server/internal/document/{document,validate,validate_test}.go`、`tests/fixtures/documents/`。以任务 7 验证的渲染输入为依赖。

**接口**　`TextColor = string | LinearGradient | RadialGradient`。每个渐变有块内 `rangeId: string`。线性含 `angle`，径向含 `centerX`、`centerY`，都包含 `stops: { color: string; offset: number }[]`。阴影、描边等字段维持 hex。`schemaVersion: 1` 继续接受原纯色结构。`schemaVersion: 2` 接受渐变结构及纯色。首次写入渐变时从 v1 升为 v2，既有 v2 编辑后保留 v2。线性角度归一到 [0,360)，百分比允许闭区间 [0,100]。

- [ ] 添加 TS、Go 共用的往返与拒绝 fixture。断言 v1 拒绝渐变，v2 接受默认样式与 inline 渐变，同一 ID 重复使用时配置一致，2–8 色标、百分比边界、重复 offset 硬边、未知键和不合法数值、独立纯色文档重序列化。
- [ ] 运行双端测试，旧校验器拒绝新示例。实现 JSON 解析和校验，同步 default 与 inline mark，保持写入能力由任务 10 单独启用。继续使用已有不透明 JSON 传输。
- [ ] 运行 `pnpm exec vitest run packages/poster-schema/src/schema.test.ts`、`go test ./server/internal/document` 和 `pnpm contracts:check`。提交兼容读取改动，写入关闭时须通过 `pnpm typecheck`。

### 任务 9　渐变选区、颜色面板与共享渲染

**文件**　`packages/poster-editor/src/text/{extensions,selection,RichTextEditor}.ts[x]`、`Editor.tsx`、`panels/{TextPanel,ColorField}.tsx`、`packages/poster-renderer/src/{RichText,PosterFrame}.tsx`。依赖任务 7 的实测路径与任务 8 的颜色类型。

- [ ] 写 `applies gradients to selection groups` 的单测与 E2E。断言选择态、部分选区、光标后续输入作用一致，按值判断混合。局部覆色保留剩余范围标识，粘贴时重映射，同时验证跨段、同预设分两次应用、撤销、编辑态与非编辑态视觉一致。
- [ ] 用 `tests/e2e/editor-richtext.spec.ts` 定向复现红灯。实现结构化颜色校验、生成和选区更新，复用色标交互并添加角度、圆心和渐变预设，按任务 7 定稿共享坐标与效果分层。拖动色标合并为一次撤销，纯色输入和粘贴语义保留。
- [ ] 复跑定向用例和实际导出采样。写入门槛继续由任务 10 控制。提交 `feat(editor): render linear and radial gradients on text ranges`。

### 任务 10　渐变启用与发布验证

**文件**　更新 `apps/web/src/features/editor/useProjectAutosave.ts` 及其现有草稿恢复路径、`apps/admin/src/features/templates/TemplateEditor.tsx`、`server/internal/projects` 及 `catalog` 的文档写入入口、`server/internal/exports` 的版本兼容测试。证据可合并至任务 7 的验收文档。

- [ ] 构造「旧纯色文档、已有待导出快照、新渐变文档、旧页面保存」矩阵。验证写入开关关闭时 v1 纯色工作流照常，读取和导出支持 v2。已有 v2 的项目和模板拒绝 v1 更新，即使旧请求带当前修订号。拒绝时保持现有内容和客户端草稿。验证兼容版本可回退、已排队纯色导出可完成。
- [ ] 在服务端项目和模板写入边界加统一的渐变写入配置，默认关闭。现有修订校验继续生效，另在更新边界阻止 v2 降回 v1。用户站和管理站仅在同一兼容部署已启用写入时开放渐变编辑，读取和导出始终兼容已存在的 v2。更新导出快照与 renderer 的版本测试，确认旧快照可消费。启用过程和回退目标随实际验证记录。
- [ ] 重跑项目、模板、字体、渐变、导出和 UI 约束。按设计 §8 保存截图或像素样本，记录新旧版本兼容证据。提交 `feat: enable gradient document writes after compatibility checks`。
