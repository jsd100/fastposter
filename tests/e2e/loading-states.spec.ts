import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { openPoster } from "./helpers";

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
