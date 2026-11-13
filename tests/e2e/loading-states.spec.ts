import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { inspectorOption, openPoster } from "./helpers";

/**
 * FP-02 / A07. Every real request family is delayed on the page and the
 * resulting waiting state is asserted through public roles: one meaningful
 * status announcement, an antd waiting component in the region, no blue
 * info Alert used as a waiting block and no self-drawn spinner/skeleton.
 *
 * The case name is shared verbatim by every scenario; the "· <group>" suffix
 * is the mutually-exclusive `-g` handle so a single temp stack never carries
 * more than a few account registrations.
 */
const CASE = "waits render antd loading and keep their own outcomes";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Delay matching requests without replacing their real response. */
function delay(
  page: Page,
  match: (url: URL) => boolean,
  ms: number,
  method?: string,
) {
  return page.route(
    (url) => match(url),
    async (route) => {
      if (method && route.request().method() !== method) {
        await route.continue().catch(() => {});
        return;
      }
      await sleep(ms);
      await route.continue().catch(() => {});
    },
  );
}

async function account(page: Page, prefix: string) {
  const name = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const password = "a secure test password";
  await page.goto("/register");
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
}

/** The one shared assertion for a region-level antd waiting state. */
async function expectAntdWait(page: Page, label: string | RegExp) {
  // The waiting text is reachable by its public role and announced once.
  const announced = page.getByRole("status").filter({ hasText: label });
  await expect(announced).toHaveCount(1);
  // FP-02: a waiting state is never the blue info Alert.
  await expect(announced.first()).not.toHaveClass(/ant-alert-info/);
  // The region owns exactly one status hook and an antd loading component.
  const region = page.locator("[data-fp-loading]").filter({ hasText: label });
  await expect(region).toHaveCount(1);
  await expect(region.locator(".ant-spin")).toHaveCount(1);
  // No self-drawn waiting visuals remain anywhere on the page.
  await expect(page.locator(".spinner")).toHaveCount(0);
  await expect(page.locator(".project-skeleton")).toHaveCount(0);
}

/** The first-paint grid is an antd Skeleton, not a hand-drawn one. */
async function expectAntdGrid(page: Page) {
  const grid = page.getByRole("status", { name: "正在加载作品" });
  await expect(grid).toHaveCount(1);
  await expect(grid).toHaveAttribute("aria-busy", "true");
  await expect(grid.locator(".ant-skeleton").first()).toBeVisible();
  await expect(page.locator(".project-skeleton")).toHaveCount(0);
  // "Nothing here" is a conclusion about data that arrived, never a wait.
  await expect(
    page.getByRole("heading", { name: "从一张图片开始", exact: true }),
  ).toHaveCount(0);
}

test.beforeEach(async () => {
  test.setTimeout(90_000);
});

test(`${CASE} · session`, async ({ page }) => {
  // Delayed session probe: the shell must show a region antd wait, never a
  // blue info Alert, while /auth/me is still in flight.
  await delay(page, (url) => url.pathname === "/api/v1/auth/me", 2200);
  await page.goto("/projects", { waitUntil: "domcontentloaded" });
  await expectAntdWait(page, "正在打开创作空间…");
});

test(`${CASE} · route`, async ({ page }) => {
  await account(page, "a07route");
  // Delayed lazy chunk: the Suspense fallback is the route waiting state.
  let delayed = false;
  await page.route(
    (url) => /ProjectWorkspace/.test(url.href),
    async (route) => {
      if (!delayed) {
        delayed = true;
        await sleep(2600);
      }
      await route.continue().catch(() => {});
    },
  );
  await page.evaluate(() => {
    history.pushState(null, "", "/projects/lazy-probe/edit");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expectAntdWait(page, "正在打开编辑工作台…");
});

test(`${CASE} · works`, async ({ page }) => {
  // Delayed works query: a predictable grid uses an antd Skeleton.
  await delay(page, (url) => url.pathname === "/api/v1/projects", 2400);
  await account(page, "a07works");
  await expectAntdGrid(page);
});

test(`${CASE} · draft`, async ({ page }) => {
  await account(page, "a07draft");
  // Delayed document/draft read while a work is being opened.
  await delay(
    page,
    (url) => /^\/api\/v1\/projects\/[^/]+$/.test(url.pathname),
    2400,
    "GET",
  );
  await page.evaluate(() => {
    history.pushState(null, "", "/projects/draft-probe/edit");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expectAntdWait(page, "正在打开作品…");
});

test(`${CASE} · catalog`, async ({ page }) => {
  // Delayed background / copy / template catalog reads.
  await delay(page, (url) => url.pathname.startsWith("/api/v1/catalog/"), 2400);
  await account(page, "a07catalog");
  await page.getByRole("button", { name: "模板库", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "模板库" })).toBeVisible();
  await expectAntdWait(page, "正在加载模板…");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "模板库" })).toHaveCount(0);
  await page.getByRole("button", { name: "新建海报", exact: true }).click();
  await page
    .getByRole("dialog", { name: "新建海报" })
    .getByRole("button", { name: "从背景库选择", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "背景库" })).toBeVisible();
  await expectAntdWait(page, "正在加载预设背景…");
});

test(`${CASE} · admin`, async ({ page }) => {
  const adminURL = "http://127.0.0.1:15174/admin/";
  // (1) Delayed admin session probe.
  await delay(page, (url) => url.pathname === "/api/v1/auth/me", 2000);
  await page.goto(adminURL, { waitUntil: "domcontentloaded" });
  await expectAntdWait(page, "正在打开管理后台…");
  await page.getByLabel("用户名", { exact: true }).fill("admin-e2e");
  await page
    .getByLabel("密码", { exact: true })
    .fill("fastposter-test-only-password");
  await page.getByRole("button", { name: "登录管理后台", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/overview$/);
  // (2) Delayed admin table query keeps the already-correct antd Table loading.
  // Ruling 95: these three assertions sit on the deliberately-unchanged
  // `Table loading` path (Metadata/ExportJobs/CopyPage). They are true on both
  // baseline and fixed code — regression guards, NOT A07 RED evidence. This
  // step's RED came only from step (1), the session-probe blue wait block.
  await delay(page, (url) => url.pathname === "/api/v1/admin/users", 1800);
  await page
    .getByRole("link", { name: "用户管理", exact: true })
    .first()
    .click();
  await expect(page.locator(".ant-table").first()).toBeVisible();
  await expect(page.locator(".ant-spin").first()).toBeVisible();
  await expect(page.locator(".ant-alert-info")).toHaveCount(0);
  // (3) Delayed admin catalog reads: category tree and copy list waits.
  await delay(
    page,
    (url) => url.pathname.startsWith("/api/v1/admin/resources/"),
    1800,
  );
  await page.getByRole("link", { name: "文案库", exact: true }).first().click();
  await expectAntdWait(page, "正在加载分类…");
  await expectAntdWait(page, "正在加载文案…");
});

test(`${CASE} · upload`, async ({ page }) => {
  // Delayed file upload and the create it feeds.
  await delay(page, (url) => url.pathname === "/api/v1/assets/images", 2600);
  await delay(page, (url) => url.pathname === "/api/v1/projects", 2600, "POST");
  await account(page, "a07upload");
  await page
    .getByLabel("导入背景图文件")
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await expectAntdWait(page, "正在导入并保存原图，请稍候…");
  await expectAntdWait(page, "正在创建作品，请稍候…");
});

test(`${CASE} · export`, async ({ page }) => {
  await openPoster(page, "a07export");
  // Delayed export creation: only the busy wait is asserted, so no PNG render
  // step is reached (the locked-Chrome PNG mismatch is an environment SKIP).
  await delay(page, (url) => url.pathname === "/api/v1/exports", 3000, "POST");
  await page.getByRole("button", { name: "导出 PNG", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "导出海报" })).toBeVisible();
  await expectAntdWait(page, "正在保存最新修改并创建导出…");
});

test(`${CASE} · cleanup`, async ({ page }) => {
  await account(page, "a07cleanup");
  const task = {
    id: "a07-task",
    projectId: "a07-project",
    state: "running",
    title: "待清理作品",
    createdAt: new Date().toISOString(),
  };
  // A delayed cleanup-list read that resolves to an in-progress task.
  await page.route(
    (url) => url.pathname === "/api/v1/project-deletions",
    async (route) => {
      await sleep(900);
      await route
        .fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            requestId: "a07",
            deletions: [task],
            total: 1,
          }),
        })
        .catch(() => {});
    },
  );
  await page.getByRole("button", { name: "回收站", exact: true }).click();
  await expect(page.getByTestId("deletion-task")).toBeVisible();
  await expectAntdWait(page, "正在清理相关文件…");
});

test(`${CASE} · outcomes`, async ({ page }) => {
  let mode: "fail" | "pass" | "late" = "fail";
  await page.route(
    (url) => url.pathname === "/api/v1/projects",
    async (route) => {
      const keyword =
        new URL(route.request().url()).searchParams.get("keyword") ?? "";
      if (mode === "fail") {
        await sleep(1200);
        await route
          .fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ code: "LIST_FAILED", message: "列表失败" }),
          })
          .catch(() => {});
        return;
      }
      if (mode === "late" && keyword === "alpha") await sleep(2500);
      await route.continue().catch(() => {});
    },
  );
  await account(page, "a07outcomes");
  // A failed query keeps its reason and its own retry entry, and while it is
  // in flight the grid is an antd wait, not a blue block or an early empty.
  await expect(page.locator(".ant-skeleton").first()).toBeVisible();
  await expect(page.locator(".project-skeleton")).toHaveCount(0);
  await expect(page.locator(".ant-alert-info")).toHaveCount(0);
  const failed = page.locator(".gallery-error");
  await expect(failed.getByRole("alert")).toContainText("作品列表加载失败");
  await expect(
    failed.getByRole("button", { name: "重新加载", exact: true }),
  ).toBeVisible();
  // A successful empty result concludes with the empty state, not a wait.
  mode = "pass";
  await failed.getByRole("button", { name: "重新加载", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "从一张图片开始", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status", { name: "正在加载作品" })).toHaveCount(
    0,
  );
  // A late reply from another query must not masquerade as the current one.
  mode = "late";
  const search = page.getByRole("textbox", { name: "搜索作品" });
  await search.fill("alpha");
  await expect(page.locator(".ant-skeleton").first()).toBeVisible();
  await search.fill("");
  await expect(
    page.getByRole("heading", { name: "从一张图片开始", exact: true }),
  ).toBeVisible();
  await sleep(2800);
  await expect(page.getByText("没有匹配“alpha”的作品")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "从一张图片开始", exact: true }),
  ).toBeVisible();
});

test(`${CASE} · focus`, async ({ page }) => {
  await account(page, "a07focus");
  const menu = () => page.getByRole("dialog", { name: "新建海报" });
  const top = () => page.getByRole("button", { name: "新建海报", exact: true });
  // (A06 carry-over) source dialog cancelled by 「取消」 returns focus.
  await top().click();
  await expect(menu()).toBeVisible();
  await menu().getByRole("button", { name: "取消", exact: true }).click();
  await expect(menu()).toHaveCount(0);
  await expect(top()).toBeFocused();
  // (A06 carry-over) opening from the empty-state primary action returns focus.
  const empty = page.getByRole("button", { name: "导入背景图", exact: true });
  await empty.click();
  await expect(menu()).toBeVisible();
  await menu().getByRole("button", { name: "取消", exact: true }).click();
  await expect(menu()).toHaveCount(0);
  await expect(empty).toBeFocused();
});

// ---------------------------------------------------------------------------
// Fix round 1: the ten delayed families of A07.1 (font), the five outcome
// classes of A07.4 (offline / task-complete / retryable failure), the admin
// resource grid (finding 3) and Ruling 93's real-browser reduced-motion case.
// ---------------------------------------------------------------------------

test(`${CASE} · font`, async ({ page }) => {
  // A07.1 / FP-13: 「字体」是独立的延迟请求家族，有自己的区域 antd 等待。
  // A07 改造了三处字体等待（web 工作台 / admin 模板编辑器 / 模板选择器），
  // 本例覆盖 web 工作台由 GET /api/v1/fonts 驱动的 `正在载入字体…`。
  // 用 gate 挂住首次字体请求：openPoster 会等「添加文字」可用，而该按钮
  // 恰好要等字体加载完才启用，所以必须停在编辑器外壳、不能走完整流程。
  let releaseFonts!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseFonts = resolve;
  });
  let held = false;
  await page.route(
    (url) => url.pathname === "/api/v1/fonts",
    async (route) => {
      if (!held) {
        held = true;
        await gate;
      }
      await route.continue().catch(() => {});
    },
  );
  const name = `a07font_${Date.now().toString(36)}`;
  await page.goto("/register");
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page
    .getByLabel("导入背景图文件")
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await expect(page).toHaveURL(/\/edit$/);
  await expectAntdWait(page, "正在载入字体…");
  // 区域等待而非全局遮罩：等待期间没有蓝色信息 Alert 等待块。
  await expect(page.locator(".ant-alert-info")).toHaveCount(0);
  releaseFonts();
  // 释放后等待由真实结果收尾，不留悬空请求。
  await expect(page.getByText("正在载入字体…")).toHaveCount(0, {
    timeout: 15_000,
  });
});

test(`${CASE} · gallery`, async ({ page }) => {
  // A07.4 / finding 3: 后台资源网格过去在 pending 时是完全空白的网格，
  // 属于「没有任何等待视觉」的真实首屏等待。FP-02 网格行要求几何一致的
  // antd Skeleton（复用现有 admin-resource-* 卡片类）；空态是数据到达后的
  // 结论，不得提前出现。
  await delay(
    page,
    (url) => url.pathname.startsWith("/api/v1/admin/resources/"),
    2600,
  );
  await page.goto("http://127.0.0.1:15174/admin/login");
  await page.getByLabel("用户名", { exact: true }).fill("admin-e2e");
  await page
    .getByLabel("密码", { exact: true })
    .fill("fastposter-test-only-password");
  await page.getByRole("button", { name: "登录管理后台", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/overview$/);
  await page.getByRole("link", { name: "背景库", exact: true }).click();
  const grid = page.locator(".admin-resource-grid");
  await expect(grid).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("status", { name: "正在加载素材" })).toHaveCount(
    1,
  );
  await expect(grid.locator(".ant-skeleton").first()).toBeVisible();
  await expect(page.locator(".spinner")).toHaveCount(0);
  await expect(page.locator(".project-skeleton")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "还没有共享背景" }),
  ).toHaveCount(0);
  // 延迟的查询到达后，等待被真实结果（空态或卡片）替换。
  await expect(grid.locator(".ant-skeleton")).toHaveCount(0);
  await expect(page.getByRole("status", { name: "正在加载素材" })).toHaveCount(
    0,
  );
  await expect(
    page
      .getByRole("heading", { name: "还没有共享背景" })
      .or(page.getByTestId("resource-card"))
      .first(),
  ).toBeVisible();
});

test(`${CASE} · offline`, async ({ page }) => {
  // A07.4 / FP-13: 离线是与等待不同的真实结果。挂起的保存用 antd
  // Button loading + 静态 `保存中…` 状态文字；断网产生
  // `离线 · 草稿已保留` + 需人工重试的提示；恢复后以 `已保存` 完成任务。
  // 全程不进入 PNG 渲染步骤。
  await openPoster(page, "a07offline");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await expect(page.locator("[data-fp-loading]")).toHaveCount(0);
  let mode: "delay" | "offline" | "online" = "delay";
  await page.route(
    (url) => /^\/api\/v1\/projects\/[^/]+$/.test(url.pathname),
    async (route) => {
      if (route.request().method() !== "PUT") {
        await route.continue().catch(() => {});
        return;
      }
      if (mode === "offline") {
        await route.abort("internetdisconnected").catch(() => {});
        return;
      }
      if (mode === "delay") await sleep(1600);
      await route.continue().catch(() => {});
    },
  );
  const save = page.getByRole("button", { name: "保存作品" });
  // (1) 等待：antd Button loading + 单一静态状态文字，无蓝色等待块。
  await inspectorOption(page, "位置").click();
  await page.getByLabel("文本框宽度", { exact: true }).fill("420");
  await expect(
    page.getByRole("status").filter({ hasText: "保存中…" }),
  ).toHaveCount(1);
  await expect(save).toHaveClass(/ant-btn-loading/);
  await expect(save).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("[data-fp-loading]")).toHaveCount(0);
  await expect(page.locator(".ant-alert-info")).toHaveCount(0);
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  // (2) 离线：真实网络失败产生各自持久状态，忙碌等待消失。
  mode = "offline";
  await page.getByLabel("文本框宽度", { exact: true }).fill("430");
  await expect(
    page.getByText("离线 · 草稿已保留", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("连接恢复后可点击保存重试。")).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "保存中…" }),
  ).toHaveCount(0);
  await expect(page.locator("[data-fp-loading]")).toHaveCount(0);
  await expect(save).not.toHaveClass(/ant-btn-loading/);
  // (3) 任务完成：连接恢复后保存恢复为 `已保存`。
  mode = "online";
  await save.click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await expect(
    page.getByText("离线 · 草稿已保留", { exact: true }),
  ).toHaveCount(0);
});

test(`${CASE} · completion`, async ({ page }) => {
  // A07.4 / FP-13: 真实后台任务用各自语义区分等待 / 可重试失败 / 完成，
  // 状态迁移由轮询的 GET /api/v1/project-deletions 真实状态机驱动。
  await account(page, "a07completion");
  const task = {
    id: "a07-task",
    projectId: "a07-project",
    state: "running",
    title: "待清理作品",
    createdAt: new Date().toISOString(),
  };
  let state = "running";
  await page.route(
    (url) => url.pathname === "/api/v1/project-deletions",
    async (route) => {
      await sleep(300);
      await route
        .fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            requestId: "a07",
            deletions: [{ ...task, state }],
            total: 1,
          }),
        })
        .catch(() => {});
    },
  );
  await page.getByRole("button", { name: "回收站", exact: true }).click();
  await expect(page.getByTestId("deletion-task")).toBeVisible();
  const item = page.getByTestId("deletion-task");
  // (1) 等待：区域 antd Spin + 单一状态，无蓝色等待块。
  await expectAntdWait(page, "正在清理相关文件…");
  // (2) 可重试失败：自己的重试入口，忙碌等待消失，不重复播报。
  state = "retry_wait";
  await expect(
    page.getByRole("button", { name: "重试清理", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("作品已删除，部分文件尚未清理。")).toBeVisible();
  await expect(page.locator("[data-fp-loading]")).toHaveCount(0);
  await expect(item.locator(".ant-alert-info")).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "正在清理相关文件…" }),
  ).toHaveCount(0);
  // (3) 完成：独立完成文字，区域内不再有等待组件。
  state = "completed";
  await expect(
    page.getByText("作品及独占资源已彻底删除，共享资源已保留。"),
  ).toBeVisible();
  await expect(page.locator("[data-fp-loading]")).toHaveCount(0);
  await expect(item.locator(".ant-spin")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "重试清理", exact: true }),
  ).toHaveCount(0);
});

test(`${CASE} · motion`, async ({ browser, page }) => {
  // Ruling 93: 真实浏览器缩减动效断言。context 在页面加载前创建，
  // 绝不在挂载后 emulateMedia（会重包裹 antd MotionWrapper，触发 A01 缺陷）。
  test.setTimeout(150_000);
  const reduceContext = await browser.newContext({
    reducedMotion: "reduce",
    baseURL: test.info().project.use.baseURL,
  });
  const reducePage = await reduceContext.newPage();
  try {
    let sessionDelayed = false;
    await reducePage.route(
      (url) => url.pathname === "/api/v1/auth/me",
      async (route) => {
        if (!sessionDelayed) {
          sessionDelayed = true;
          await sleep(2400);
        }
        await route.continue().catch(() => {});
      },
    );
    await reducePage.goto("/projects", { waitUntil: "domcontentloaded" });
    // 等待文案与忙碌语义在缩减动效下继续工作。
    await expectAntdWait(reducePage, "正在打开创作空间…");
    const region = reducePage
      .locator("[data-fp-loading]")
      .filter({ hasText: "正在打开创作空间…" });
    await expect(region).toHaveAttribute("aria-busy", "true");
    // CSS-only 缩减动效规则让 antd Spin 动画静止，但仍是可识别的等待外观。
    const dot = region.locator(".ant-spin-dot-spin");
    await expect(dot).toHaveCount(1);
    expect(await dot.evaluate((el) => getComputedStyle(el).animationName)).toBe(
      "none",
    );
    // 首屏网格 Skeleton 同样静止，几何保持一致。
    await delay(reducePage, (url) => url.pathname === "/api/v1/projects", 2400);
    await account(reducePage, "a07motion");
    await expectAntdGrid(reducePage);
    const skeletonPart = reducePage.locator(".ant-skeleton-active *").first();
    await expect(skeletonPart).toBeVisible();
    expect(
      await skeletonPart.evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
    // 对照：正常动效下同一个 Spin 是有动画的，证明上面的 "none" 非恒真。
    await delay(page, (url) => url.pathname === "/api/v1/auth/me", 2400);
    await page.goto("/projects", { waitUntil: "domcontentloaded" });
    const normalDot = page
      .locator("[data-fp-loading]")
      .filter({ hasText: "正在打开创作空间…" })
      .locator(".ant-spin-dot-spin");
    await expect(normalDot).toHaveCount(1);
    expect(
      await normalDot.evaluate((el) => getComputedStyle(el).animationName),
    ).not.toBe("none");
  } finally {
    await reduceContext.close();
  }
});
