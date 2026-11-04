# FastPoster

FastPoster 是一个在本机原生运行的海报编辑器：导入自己的图片，排版富文本，自动保存，再按原图像素尺寸导出 PNG。

前端包含 React/TypeScript 用户站和管理站；后端由 Go Hertz 网关、Kitex 核心服务和独立导出 worker 组成。MySQL 保存账号、作品和任务，本地文件系统保存背景、字体与导出文件。按单机 Mac/Linux 环境设计，无需 Docker 或云对象存储。

## 目录导航

- [功能](#功能)
- [首次运行：完整初始化](#首次运行完整初始化)
- [配置项说明](#配置项说明)
- [日常启动、停止与更新](#日常启动停止与更新)
- [分别启动各个服务](#分别启动各个服务)
- [第一次制作海报](#第一次制作海报)
- [测试与构建](#测试与构建)
- [常见问题](#常见问题)
- [数据与运维](#数据与运维)
- [项目目录](#项目目录)
- [当前限制](#当前限制)

## 功能

- 导入 JPG/PNG/WebP 背景，保留原像素尺寸，校验动画、CMYK、16 位和损坏图片。
- 混合字体富文本，支持字号、颜色、字重、强调、段落、选区样式和撤销重做。
- 内置 10 个字体家族、15 个字面，支持搜索、预览与字形校验；提供 24 种预设文字颜色及自定义颜色。
- 拖动文字移动位置，两侧把手调整文本框宽度；桌面属性面板与手机底部面板共用编辑器。
- 自动保存、离线草稿恢复与版本冲突另存。
- MySQL 持久导出队列，支持租约、重试和幂等请求；Chrome 渲染原尺寸 PNG。
- 模板包导入导出、文案库，以及背景、字体和模板后台管理。
- 回收站恢复、磁盘健康检查、文件 GC、一致性备份和独立实例恢复。

## 首次运行：完整初始化

以下步骤按顺序执行。除 SQL 和明确指定工作目录的命令外，所有命令都在**仓库根目录**执行，即包含 `package.json`、`go.mod`、`apps` 和 `server` 的目录。

### 1. 准备本机依赖

| 依赖              | 要求                                   | 用途                               |
| ----------------- | -------------------------------------- | ---------------------------------- |
| Node.js           | 24                                     | 前端开发与构建                     |
| pnpm              | 11，仓库锁定 `11.25.0`                 | 安装工作区依赖、运行开发命令       |
| Go                | 1.27，以 `go.mod` 为准                 | 服务、迁移和运维工具               |
| MySQL             | 8.0+ 兼容服务                          | 账号、作品、资源及任务持久化       |
| Chrome / Chromium | 可由本机进程启动                       | PNG 导出与浏览器测试               |
| ImageMagick       | 7，提供 `magick` 命令                  | 图片检查与标准化                   |
| Python            | 3                                      | 受保护的数据库集成测试启动器       |
| Redis             | 可选                                   | 登录限流；不配置时使用有界内存实现 |
| MySQL 命令行工具  | 初始化需 `mysql`；备份还需 `mysqldump` | 创建库、验证连接、备份恢复         |

完整的已记录工具链与前端版本见 [deploy/toolchain.lock.json](deploy/toolchain.lock.json)。安装软件后先启动 MySQL 服务；如选择使用 Redis，也要先启动 Redis。

检查当前终端能否找到工具：

```sh
node --version
corepack --version
go version
mysql --version
magick -version
python3 --version
```

Chrome 不一定在 `PATH` 中，后续通过 `CHROME_PATH` 指定完整路径即可。Linux 用户须自行安装 Chrome/Chromium，并填写实际可执行文件路径。

### 2. 获取代码并启用 pnpm

已克隆仓库的用户直接进入现有项目目录。新环境可执行：

```sh
git clone git@github.com:jsd100/fastposter.git
cd fastposter
```

该 SSH 地址要求本机已配置有仓库访问权限的 GitHub 密钥。遇到连接卡住时，参见[GitHub SSH 连接卡住](#github-ssh-连接卡住)。

在仓库根目录启用 Corepack 的包管理器入口：

```sh
corepack enable
corepack install
pnpm --version
```

`package.json` 的 `packageManager` 指定了 pnpm 版本。若当前 Node 安装未提供 Corepack，需先为该 Node 环境安装 Corepack；若已经可以直接运行正确版本的 pnpm，可跳过启用步骤。后续 `pnpm dev` 内部也会调用 `pnpm`，因此请确保它在 `PATH` 中可执行。

安装依赖：

```sh
pnpm install --frozen-lockfile
go mod download
```

首次启动使用仓库已经提交的生成代码，**不需要先安装 Thrift 生成器**。仅在修改契约或运行 `pnpm verify` 时，才需要[安装契约生成工具](#契约生成与漂移检查)。

### 3. 创建业务数据库和数据库账号

本节只在首次初始化时执行，使用有建库和授权权限的 MySQL 管理账号登录。例如：

```sh
mysql -h 127.0.0.1 -P 3306 -u root -p
```

在 MySQL 终端中执行以下 SQL。`CHANGE_ME_TO_A_UNIQUE_PASSWORD` 是占位符，必须替换为自己的本机密码，后续 DSN 使用同一密码：

```sql
CREATE DATABASE IF NOT EXISTS fastposter
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'fastposter'@'127.0.0.1'
  IDENTIFIED BY 'CHANGE_ME_TO_A_UNIQUE_PASSWORD';

GRANT ALL PRIVILEGES ON fastposter.*
  TO 'fastposter'@'127.0.0.1';
```

已有可用业务账号时，可以复用其对业务库的权限，不必重复创建账号。账号的 Host 需与实际连接方式匹配；示例统一使用 TCP 地址 `127.0.0.1:3306`。不要把 `CREATE USER` 当作重置已有账号密码的命令。

退出 MySQL 终端后，用业务账号验证：

```sh
mysql -h 127.0.0.1 -P 3306 -u fastposter -p fastposter \
  -e 'SELECT DATABASE(), VERSION();'
```

如果出现 `Access denied`，先修正用户名、密码、Host 或授权，再继续执行迁移。

### 4. 创建根目录本地配置

首次创建配置：

```sh
cp deploy/local.env.example .env.local
```

已有 `.env.local` 时请直接编辑，避免复制示例覆盖自己的配置。至少检查以下内容：

```dotenv
MYSQL_DSN=fastposter:CHANGE_ME_TO_A_UNIQUE_PASSWORD@tcp(127.0.0.1:3306)/fastposter?parseTime=true&charset=utf8mb4&loc=UTC
APP_DATA_DIR=./var/data
GATEWAY_ADDR=127.0.0.1:8080
CORE_ADDR=127.0.0.1:8888
CHROME_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
MAGICK_PATH=magick
COOKIE_SECURE=false
APP_ORIGINS=http://127.0.0.1:5173,http://127.0.0.1:5174,http://localhost:5173,http://localhost:5174,http://127.0.0.1:8080,http://localhost:8080
REDIS_ADDR=
```

上面演示的是**不使用 Redis**的配置。原始环境示例中 `REDIS_ADDR=127.0.0.1:6379`；如果没有安装或启动 Redis，应将其清空。确实使用 Redis 时保留该地址或改为实际地址。

注意：

- `MYSQL_DSN` 使用 Go MySQL 驱动格式，不是 `mysql://` URL；把占位密码替换为上一步设置的密码。
- macOS 示例使用 Google Chrome 默认安装路径。Linux 可设置为实际的 `/usr/bin/chromium`、`/usr/bin/chromium-browser` 或 `google-chrome` 路径，以本机安装为准。
- `.env.local` 按 `KEY=value` 读取，不写 `export`，注释单独占一行；文件由服务自动读取，无需执行 `source .env.local`。
- 本机 HTTP 开发使用 `COOKIE_SECURE=false`。经 HTTPS 对外提供服务时再改为 `true`，并设置实际的 `APP_ORIGINS`。
- 根目录 `.env.local` 存放服务端配置，禁止提交账号密码或复制到公开文档。

### 5. 执行数据库迁移

```sh
go run ./server/cmd/migrate -direction up
```

成功时会输出 `migration completed`。迁移连接的是上一步已经创建的业务库，并在其中初始化表结构；**应用启动不会自动迁移**。

后续更新可再次执行 `-direction up`，已应用的迁移由迁移器管理。不要为了解决启动问题执行 `down`：回滚需要额外的破坏性确认参数，并会移除应用表结构。

### 6. 创建管理员

```sh
go run ./server/cmd/admin-cli -username admin
```

在 `Administrator password:` 提示中输入密码，至少 8 个字符。交互输入不会显示密码；命令成功后会报告已创建管理员。

- 项目没有公开的默认管理员密码，密码由初始化时自行设置。
- 网页注册只能创建普通用户；要访问管理站，须使用管理员账号。
- 同名账号已存在时会返回“该用户名已被使用”，不会覆盖账号或重置密码。
- 自动化可使用 `-password-stdin` 从标准输入读取密码，不要把密码写进命令行参数或提交到脚本中。

### 7. 运行环境检查

```sh
go run ./tools/doctor -check all
```

输出为 JSON 数组，各组件的 `ok` 应为 `true`，命令退出码应为 0。检查内容包括：

- 配置解析是否有效。
- MySQL 能否连接并查询版本。
- 配置了 Redis 时，Redis 能否连接。
- Chrome 与 ImageMagick 能否执行。

也可以分别检查：

```sh
go run ./tools/doctor -check config
go run ./tools/doctor -check services
go run ./tools/doctor -check render
```

`doctor` 不负责创建数据库、执行迁移或创建管理员；即使通过检查，这三个初始化步骤仍须完成。服务在启动时还会检查数据目录是否可写。

### 8. 启动完整开发环境

```sh
pnpm dev
```

启动器会依次：

1. 构建 `apps/renderer/dist`，供 Chrome worker 加载。
2. 将 `core`、`gateway`、`export-worker`、`cleanup-worker` 构建到 `.tools/bin`。
3. 启动核心服务、网关、导出 worker、清理 worker，以及两个 Vite 前端。

首次启动核心服务会按字体清单向数据库和本地存储补齐内置字体，可能比后续启动稍慢。保留这个终端运行服务，并在浏览器打开：

| 入口           | 默认地址                                                                   | 用途                        |
| -------------- | -------------------------------------------------------------------------- | --------------------------- |
| 用户站         | [http://127.0.0.1:5173](http://127.0.0.1:5173)                             | 注册、登录、编辑作品        |
| 管理站         | [http://127.0.0.1:5174/admin/login](http://127.0.0.1:5174/admin/login)     | 管理员登录与资源管理        |
| 网关健康检查   | [http://127.0.0.1:8080/api/v1/health](http://127.0.0.1:8080/api/v1/health) | 检查网关与核心 RPC 连通性   |
| Kitex 核心 RPC | `127.0.0.1:8888`                                                           | 内部 RPC 地址，不是网页入口 |

导出 worker 与清理 worker 都不单独监听网页端口。`pnpm dev` 也不需要启动 renderer 的 Vite 开发服务，worker 使用已构建的文件。

### 9. 确认启动成功

另开终端，在仓库根目录执行：

```sh
curl --fail --max-time 10 http://127.0.0.1:8080/api/v1/health
```

预期 HTTP 200，JSON 中包含 `message` 和 `requestId`。然后完成以下检查：

1. 用户站能显示登录页，注册或登录后能进入作品列表。
2. 用第 6 步创建的管理员登录管理站。
3. 导入一张测试图片，添加文字并等待“已保存”。
4. 点击“导出 PNG”，等待任务完成并下载成品。

健康接口会检查网关到核心服务的调用，但不会验证 Chrome worker 的完整导出链路，因此建议实际导出一次。

## 配置项说明

### 服务端：仓库根 `.env.local`

Go 服务、迁移、管理员及运维命令自动读取该文件；同名进程环境变量优先于文件值。

| 配置项                      | 默认值／示例                                           | 说明                                               |
| --------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| `MYSQL_DSN`                 | 无默认值，必填                                         | 业务库连接；建议保留示例中的时间与字符集参数       |
| `APP_DATA_DIR`              | `var/data`                                             | 相对仓库根目录解析，三个 Go 服务须共享同一绝对目录 |
| `GATEWAY_ADDR`              | `127.0.0.1:8080`                                       | HTTP API 监听地址                                  |
| `CORE_ADDR`                 | `127.0.0.1:8888`                                       | 核心 RPC 监听与客户端连接地址                      |
| `CHROME_PATH`               | macOS Google Chrome 路径                               | Chrome/Chromium 可执行文件                         |
| `MAGICK_PATH`               | `magick`                                               | ImageMagick 7 可执行文件                           |
| `REDIS_ADDR`                | 未设置时为空                                           | 可选限流服务；示例文件默认填了本机 6379            |
| `COOKIE_SECURE`             | `false`                                                | HTTPS 对外服务应设为 `true`                        |
| `APP_ORIGINS`               | 本机 5173、5174、8080 的 localhost 与 127.0.0.1 origin | 允许的前端来源，多个值用逗号分隔，不包含路径       |
| `FASTPOSTER_TEST_MYSQL_DSN` | 可选，库名必须以 `fastposter_test_` 开头               | 测试启动器使用，不是业务库连接                     |

`APP_DATA_DIR` 会在启动时按需创建，运行账号须能写入。不要将它设为文件系统根目录，也不要直接把该目录作为公开静态资源目录。配置修改后需要重启相应服务。

### 前端：应用自己的 `.env.local`

用户站读取 `apps/web/.env.local`，管理站读取 `apps/admin/.env.local`。以下配置不应仅写到仓库根 `.env.local` 后就期待 Vite 自动读取：

| 配置项                      | 配置位置                                            | 说明                                                 |
| --------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| `API_PROXY`                 | 两个前端各自的 `.env.local`，或启动前的进程环境变量 | 开发时 `/api` 转发目标，默认 `http://127.0.0.1:8080` |
| `VITE_WEB_ORIGIN`           | `apps/admin/.env.local`                             | 管理站开发环境中“前往用户站”的地址                   |
| `VITE_QUICK_LOGIN_USERNAME` | `apps/web/.env.local`                               | 可选本地快捷填充用户名                               |
| `VITE_QUICK_LOGIN_PASSWORD` | `apps/web/.env.local`                               | 可选本地快捷填充密码，仅用于本地开发                 |

启用本地登录页的“填入快捷账号”按钮：

```sh
cp apps/web/.env.example apps/web/.env.local
```

随后编辑 `apps/web/.env.local`，填写已存在账号的用户名和密码。已有文件时直接编辑，保留自己的其他配置。按钮只负责填充，不会创建账号或自动登录；注册页与生产构建均不显示。凭据会用于本地开发页面，只应填写本机测试账号。`VITE_` 前缀的一般含义是可供浏览器代码读取，不适合存放服务端密钥。

### 调整端口的完整示例

若把网关改为 8081，在根目录 `.env.local` 设置：

```dotenv
GATEWAY_ADDR=127.0.0.1:8081
```

在 `apps/web/.env.local` 和 `apps/admin/.env.local` 均设置：

```dotenv
API_PROXY=http://127.0.0.1:8081
```

或者只对本次启动指定转发目标：

```sh
API_PROXY=http://127.0.0.1:8081 pnpm dev
```

该环境变量不会替代根配置中的 `GATEWAY_ADDR`，两者要指向同一个网关。`APP_ORIGINS` 应覆盖实际从浏览器访问的 origin；直接从新网关 origin 发起浏览器请求时也需更新来源列表。

前端端口目前在各应用的 `package.json` 开发脚本中固定为 5173/5174，不由 `GATEWAY_ADDR` 控制。需要改动时调整对应脚本，并同步 `APP_ORIGINS`、管理站用户站链接地址。若 Vite 因占用自动选择其他端口，仍需按新的实际 origin 更新配置。

## 日常启动、停止与更新

初始化完成后，每次开发通常只需要：

```sh
# 先启动本机 MySQL；配置了 Redis 时也启动 Redis。
pnpm dev
```

在启动终端按 **Ctrl-C**，启动器会停止本次创建的进程组；不会删除账号、作品、数据库或 `APP_DATA_DIR` 中的数据。不要重复执行管理员创建命令，也不要重新复制配置示例覆盖已有配置。

代码更新后：

```sh
git pull
pnpm install --frozen-lockfile
go mod download
go run ./server/cmd/migrate -direction up
go run ./tools/doctor -check all
pnpm dev
```

先停止旧的开发进程，再更新和重新启动。更新前备份重要数据；迁移与备份说明见 [deploy/backup.md](deploy/backup.md)。前端源码由 Vite 热更新；Go 服务、配置和 renderer 构建不由启动器自动热重载，修改后需要重新启动。`pnpm build` 仅生成构建产物，不会自动启动服务。

## 分别启动各个服务

需要独立查看日志或只重启某一个进程时，可以手动启动。**所有终端均从仓库根目录执行**，共用根 `.env.local`，并确保数据库迁移已经完成。

先准备 renderer：

```sh
pnpm --filter @fastposter/renderer build
```

然后分别在六个终端执行：

```sh
# 终端 1：业务核心服务
go run ./server/cmd/core
```

```sh
# 终端 2：HTTP 网关
go run ./server/cmd/gateway
```

```sh
# 终端 3：导出 worker
go run ./server/cmd/export-worker
```

```sh
# 终端 4：清理 worker
go run ./server/cmd/cleanup-worker
```

```sh
# 终端 5：用户站
pnpm --filter @fastposter/web dev
```

```sh
# 终端 6：管理站
pnpm --filter @fastposter/admin dev
```

此时每个终端中的 Ctrl-C 只停止对应进程。不要同时在相同端口运行这组进程和 `pnpm dev`。

## 第一次制作海报

1. 打开用户站，用已有账号登录或注册普通用户。
2. 在作品列表导入本机背景图，进入编辑器；也可以从模板创建作品。
3. 添加文字。选中文字时只修改选区，光标状态影响后续输入，未进入文字编辑时可调整整块样式。
4. 搜索并选择字体；Inter 用于西文，含中文的目标会禁用西文选项。内置字体与授权说明见 [assets/fonts/README.md](assets/fonts/README.md)。
5. 使用预设颜色下拉或自定义颜色；拖动文字块移动位置，拖动两侧把手调整自动换行宽度。
6. 等待显示“已保存”，再导出 PNG。下载按钮保存原尺寸成品；预览缩放不影响导出像素尺寸。
7. 可用“模板包”导出 ZIP，在工作台导入后创建独立作品。

导出结果保留 7 天，回收站中的作品保留 30 天。需要长期留存的成品请及时下载。管理员可在管理站发布背景、字体、模板及文案，资源下架不会使已有作品中的明确版本引用失效。

## 测试与构建

### 常用命令

| 命令                                             | 内容                                   | 前置条件                                      |
| ------------------------------------------------ | -------------------------------------- | --------------------------------------------- |
| `pnpm typecheck`                                 | TypeScript 类型检查                    | 已安装前端依赖                                |
| `pnpm test`                                      | Vitest 单元测试                        | 已安装前端依赖                                |
| `pnpm build`                                     | 构建所有工作区包与应用                 | Node / pnpm                                   |
| `pnpm verify`                                    | 契约漂移、类型检查、单元测试、构建     | 额外安装契约生成工具                          |
| `pnpm test:server`                               | `server/...` 和 `tools/...` 的 Go 测试 | Go；未设测试 DSN 时部分数据库测试跳过         |
| `go test ./internal/...`                         | 根目录共享配置测试                     | Go                                            |
| `python3 tools/test-integration.py --all-server` | 带受保护测试 DSN 的服务端测试          | MySQL 测试账号及权限                          |
| `pnpm test:e2e`                                  | Playwright 浏览器验收                  | MySQL、Chrome、ImageMagick、Python 与前端依赖 |

`pnpm verify` 不包含 Go 与浏览器测试。定向执行示例：

```sh
pnpm exec vitest run packages/poster-editor/src/fonts/catalog.test.ts
python3 tools/test-integration.py -run TestBuiltinFonts -count=1 -v
pnpm test:e2e tests/e2e/editor-fonts.spec.ts
```

### 测试数据库配置

数据库测试只允许 `fastposter_test_*` 名称。建议使用独立测试账号，在仓库根 `.env.local` 中添加：

```dotenv
FASTPOSTER_TEST_MYSQL_DSN=fastposter_test:CHANGE_ME_TO_A_TEST_PASSWORD@tcp(127.0.0.1:3306)/fastposter_test_integration?parseTime=true&charset=utf8mb4&loc=UTC
```

该账号必须能够创建、操作及删除 `fastposter_test_*` 范围内随机后缀的临时数据库，授权需由本机 MySQL 管理员配置；仅授权一个固定的 `fastposter_test_integration` 库不足以运行测试。数据库授权模式因 MySQL 版本和设置而异，见 [MySQL GRANT 文档](https://dev.mysql.com/doc/refman/8.0/en/grant.html)。

如果未显式配置测试 DSN，Python 启动器只会尝试把业务 DSN 中名为 `fastposter` 的库替换为 `fastposter_test_integration`，沿用原账号；因此仅有业务库权限的账号仍会测试失败。业务库使用其他名称时必须显式设置测试 DSN。

测试实际创建随机命名的 `fastposter_test_*` 数据库，自动迁移后使用，结束时清理；不要手动把测试连接指向业务库。直接执行 `go test` 不会自动读取 `.env.local` 中的测试 DSN，建议通过 Python 启动器运行。记录测试结果时区分“通过”和“未配置 DSN 而跳过”。

### 浏览器与实际渲染测试

`pnpm test:e2e` 会启动临时数据库、数据目录、核心服务、网关、worker 和两个 Vite 前端，结束后清理，不需要先启动 `pnpm dev`，也不需要使用真实业务作品。

测试前确保 `15173`、`15174`、`18080` 端口未占用，且 `magick` 位于 `PATH`。测试网关与正式开发端口不同。若 Chrome 不在 macOS 默认路径，应将路径显式传给 Playwright 进程，例如：

```sh
CHROME_PATH=/usr/bin/chromium pnpm test:e2e
```

该环境变量控制 Playwright 启动的浏览器。当前测试栈及部分 Go 渲染用例仍使用 macOS 默认 Chrome 路径，并且图片处理测试直接调用 `magick`；非 macOS 环境运行整套浏览器／渲染测试前需检查相应测试入口，不能仅凭配置了服务端 `CHROME_PATH` 就认定整套测试可跨平台运行。

需要单独执行实际 Chrome 渲染与大尺寸容量用例时，先构建 renderer，再通过测试启动器传递开关：

```sh
pnpm --filter @fastposter/renderer build
FASTPOSTER_RENDER_TEST=1 FASTPOSTER_CAPACITY_TEST=1 \
  python3 tools/test-integration.py -run TestRender -count=1 -v
```

未开启相应开关时，部分渲染／容量用例会跳过。浏览器测试失败后的截图与 trace 位于 `test-results/`，测试命令会给出具体路径。

### 契约生成与漂移检查

修改契约从 `idl` 开始。使用仓库锁定版本安装生成器到被 Git 忽略的 `.tools/bin`：

```sh
mkdir -p .tools/bin
GOBIN="$PWD/.tools/bin" go install github.com/cloudwego/kitex/tool/cmd/kitex@v0.16.4
GOBIN="$PWD/.tools/bin" go install github.com/cloudwego/hertz/cmd/hz@v0.9.8
GOBIN="$PWD/.tools/bin" go install github.com/cloudwego/thriftgo@v0.4.5
```

然后执行：

```sh
pnpm contracts:generate
pnpm contracts:check
```

生成结果包括 `server/gen`、TypeScript DTO 和生成路由，应与契约一起提交，不要手改。`pnpm verify` 已包含漂移检查。若提示缺少生成器，先完成上述安装，再运行验证，无需因此重新初始化数据库。

## 常见问题

### 启动提示 `MYSQL_DSN is required`

确认仓库根存在 `.env.local`，命令在项目内执行，配置键名正确。Go 服务读取根配置，前端应用目录中的 `.env.local` 不能替代它。另需检查当前终端是否设置了覆盖文件配置的同名环境变量。

### 数据库连接失败或 `database schema is not ready`

- 用前文的 `mysql -h 127.0.0.1 ... -p` 命令验证账号和库名。
- `Unknown database` 表示需要先创建业务库；迁移不会代替建库。
- `Access denied` 检查账号密码、Host 与库权限。
- 核心服务提示 schema 未就绪时执行 `go run ./server/cmd/migrate -direction up`，成功后重启。

### 没装 Redis，`doctor` 却报 Redis 连接失败

环境示例默认填写了 Redis 地址。没有使用 Redis 时，在根 `.env.local` 将 `REDIS_ADDR` 清空后重试。实际业务限流会在 Redis 不可用时降级，但 `doctor` 会把显式配置的连接失败报告出来。

### 页面能打开，但 API 失败或登录后仍返回登录页

先检查 `/api/v1/health` 是否成功，再核对前端 `API_PROXY` 是否与 `GATEWAY_ADDR` 一致。浏览器来源须位于 `APP_ORIGINS`；本机 HTTP 下应使用 `COOKIE_SECURE=false`。在同一套操作中保持使用一致的 `localhost` 或 `127.0.0.1`，两者的浏览器会话不共享。

### 端口占用或前端自动跳到其他端口

检查旧的 `pnpm dev`、手动启动的服务或其他应用是否仍占用 5173、5174、8080、8888。优先停止自己之前启动的进程，不要直接结束不认识的进程。若主动调整地址，按[端口配置示例](#调整端口的完整示例)同步修改代理和来源列表。

### 图片导入失败或 PNG 导出一直不能完成

运行 `go run ./tools/doctor -check render`，确认 ImageMagick 与 Chrome 可执行。查看启动终端中的 worker 日志，确认 worker 正在运行，且 `apps/renderer/dist` 已构建。手动启动 worker 前要先构建 renderer；修改 renderer 后需要重新构建。

同时检查 `APP_DATA_DIR` 是否可写、磁盘空间是否充足。图片输入本身也须符合格式要求；浏览器能显示某张图片不代表它一定符合标准化限制。健康接口通过不代表导出 worker 已完成真实渲染验证。

### GitHub SSH 连接卡住

系统代理不一定接管 Git 的 SSH 流量。若 `github.com:22` 出现 DNS 或连接问题，可按 [GitHub 官方 SSH 443 文档](https://docs.github.com/en/authentication/troubleshooting-ssh/using-ssh-over-the-https-port)先测试：

```sh
ssh -T -p 443 git@ssh.github.com
```

首次连接须核对官方主机指纹并确认。出现认证成功提示即可；GitHub 不提供交互式 shell，成功认证时该测试命令仍可能返回退出码 1。

对当前仓库切换 remote 地址：

```sh
git remote set-url origin ssh://git@ssh.github.com:443/jsd100/fastposter.git
git remote -v
git ls-remote origin
```

`set-url` 只修改本地当前仓库的 `origin`，不影响全局 Git 配置或其他项目，也不会立即推送代码。新建的空远端可能没有任何引用输出；先发布自己的分支并设置上游，之后再执行相应的 pull。若仍使用系统代理模式，应区分 HTTPS 代理、SSH 的代理配置及 DNS 问题，单独把规则模式切到全局不等于终端 SSH 自动走代理。

## 数据与运维

### 资源的 Git 管理范围

| 内容                                               | 保存方式           | 恢复方式                                                   |
| -------------------------------------------------- | ------------------ | ---------------------------------------------------------- |
| 内置字体、清单与授权（`assets/fonts`）             | 提交 Git           | 从仓库恢复源文件；核心服务启动时校验并补齐缺失的运行时副本 |
| 品牌图标、色彩配置及其他内置静态资源               | 提交 Git           | 从仓库恢复                                                 |
| 私有背景、上传字体、作品相关文件（`APP_DATA_DIR`） | Git 忽略，单独备份 | 恢复与数据库匹配的文件备份                                 |
| 本机凭据（`.env.local`）                           | Git 忽略，本机保管 | 从自己的配置记录恢复；示例文件只提供格式                   |

内置字体的源文件已经纳入版本控制。`var/data/fonts` 是运行时生成的副本；即使数据库记录存在，启动时仍会检查文件。缺失文件仅在能匹配数据库原有 SHA-256 和大小时自动补回，保留原版本、路径及上下架状态。已有文件损坏或仓库不包含所需历史版本时会报错，需要还原备份。

不要为了解决内置字体副本缺失而把整个 `var/` 纳入 Git，其中还包含私有图片、导出文件及其他本地数据。执行会删除被忽略文件的清理操作前，先备份 `.env.local` 和数据目录；重新拉取代码无法恢复私有文件。

### 数据检查与备份

需要同时保护 MySQL 和 `APP_DATA_DIR`：前者保存作品文档与版本引用，后者保存私有文件。只保留其中一部分不足以完整恢复作品。

日常命令均在仓库根运行：

```sh
# 只读：磁盘、文件哈希、GC 试运行及行数
go run ./server/cmd/maintenance check

# 只预览将清理的内容
go run ./server/cmd/maintenance gc

# 明确执行到期且无引用文件清理
go run ./server/cmd/maintenance gc -apply

# 暂停写入并一致性备份 MySQL 与文件目录
go run ./server/cmd/maintenance backup
```

备份依赖本机 MySQL 命令行工具；备份输出目录应位于 `APP_DATA_DIR` 之外。备份含账号密码散列和私有作品，应限制访问。恢复使用独立数据库与数据目录，具体参数、保留期限及恢复演练见 [deploy/backup.md](deploy/backup.md)。不要为了释放空间手动删除数据目录内的文件。

进一步阅读：

- [本机运行与配置](deploy/local.md)
- [备份与恢复](deploy/backup.md)
- [完整验收记录](docs/verification/acceptance.md)
- [编辑器体验验收](docs/verification/editor-experience.md)
- [字体、颜色和快捷填充验收](docs/verification/editor-font-color.md)
- [品牌图标验收](docs/verification/brand-icon.md)

## 项目目录

| 路径                                 | 职责                                           |
| ------------------------------------ | ---------------------------------------------- |
| `apps/web`、`apps/admin`             | 用户站、管理站                                 |
| `apps/renderer`                      | Chrome 导出渲染入口                            |
| `packages/poster-schema`             | 海报文档 schema 与校验                         |
| `packages/poster-renderer`           | 字体加载、DOM 排版和渲染                       |
| `packages/poster-editor`             | 编辑器交互、属性面板与选区样式                 |
| `packages/ui`、`packages/api-client` | 共享控件与 API 客户端                          |
| `server/cmd`                         | 网关、核心服务、worker、迁移、管理员及维护命令 |
| `server/internal`、`internal/config` | 领域逻辑与共享配置                             |
| `server/gen`、`idl`                  | Thrift 契约和生成代码                          |
| `server/migrations`                  | 显式数据库迁移                                 |
| `assets/fonts`、`assets/branding`    | 字体、授权和品牌资源                           |
| `tests/e2e`、`tests/fixtures`        | 浏览器测试及固定样例                           |
| `deploy`、`docs/verification`        | 本机部署说明、工具链及验收记录                 |

## 当前限制

- 当前按单机原生运行设计，不提供多实例共享文件存储或完整公网部署脚本。
- HTTPS 对外服务需要额外部署 TLS 终止或反向代理，并设置真实 `APP_ORIGINS` 和安全 Cookie。
- 备份是 MySQL 逻辑导出和文件复制，不是二进制日志时间点恢复。
- 移动交互有 Chrome 触摸模拟测试，真实 iOS/Android 输入法和保存流程仍需人工验收，见 [docs/verification/mobile.md](docs/verification/mobile.md)。
- 开发服务器、配置文件和 renderer 构建各有自己的启动／重载方式，不能把 Vite 的前端热更新理解为后端和导出入口也会自动重启。
