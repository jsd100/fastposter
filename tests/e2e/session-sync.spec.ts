import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { chooseCardAction } from "./helpers";

async function register(request: Page["request"], username: string) {
  const reply = await request.post("/api/v1/auth/register", {
    data: { username, password: "a secure test password" },
  });
  expect(reply.ok()).toBeTruthy();
}

async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("用户名", { exact: true }).fill(username);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
}

test("switching accounts does not resurrect the previous account's error", async ({
  browser,
  request,
}) => {
  test.setTimeout(120_000);
  const first = "scope_first_" + Date.now().toString(36);
  const second = "scope_second_" + Date.now().toString(36);
  await register(request, first);
  await register(request, second);

  const context = await browser.newContext();
  const pageA = await context.newPage();
  await login(pageA, first, "a secure test password");
  await pageA
    .getByLabel("导入背景图文件")
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await expect(pageA).toHaveURL(/\/projects\/[^/]+\/edit$/);
  await pageA.getByRole("link", { name: "返回作品" }).click();
  await expect(pageA).toHaveURL(/\/projects$/);
  const card = pageA.getByTestId("project-card").first();
  await expect(card).toBeVisible();
  await chooseCardAction(pageA, card.getByLabel(/的操作$/), "重命名");
  const dialog = pageA.getByRole("dialog", { name: "重命名作品" });
  await expect(dialog).toBeVisible();
  await pageA.route("**/api/v1/projects/*", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ code: "SAVE_FAILED", message: "重命名失败" }),
    });
  });
  await pageA.getByLabel("作品名称", { exact: true }).fill("不会保存的名字");
  await pageA.getByRole("button", { name: "保存名称" }).click();
  await expect(pageA.getByTestId("notice")).toContainText("重命名失败");
  await dialog.getByRole("button", { name: "取消" }).click();
  await expect(dialog).toHaveCount(0);

  const pageB = await context.newPage();
  await pageB.goto("/projects");
  await expect(pageB).toHaveURL(/\/projects$/);
  await pageB.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(pageB).toHaveURL(/\/login/);
  await expect(pageA).toHaveURL(/\/login/);

  await login(pageB, second, "a secure test password");
  await expect(pageA).toHaveURL(/\/projects$/);
  await expect(pageA.locator(".account-name")).toContainText(second);
  await pageA.waitForTimeout(2500);
  await expect(pageA.getByTestId("notice")).toHaveCount(0);
  await expect(pageA.getByTestId("notice-action")).toHaveCount(0);
  await context.close();
});

test("switching accounts in another tab drops stale data and leaves the old editor", async ({
  browser,
  request,
}) => {
  test.setTimeout(120_000);
  const first = "sync_first_" + Date.now().toString(36);
  const second = "admin-e2e";
  const secondPassword = "fastposter-test-only-password";
  await register(request, first);

  const context = await browser.newContext();
  const pageA = await context.newPage();
  await login(pageA, first, "a secure test password");
  await pageA
    .getByLabel("导入背景图文件")
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await expect(pageA).toHaveURL(/\/projects\/[^/]+\/edit$/);
  const editorUrl = pageA.url();
  await pageA.getByRole("button", { name: "添加文字", exact: true }).click();

  const pageB = await context.newPage();
  await pageB.goto("/projects");
  await expect(pageB).toHaveURL(/\/projects$/);
  await pageB.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(pageB).toHaveURL(/\/login/);
  await expect(pageA).toHaveURL(/\/login/);
  expect(pageA.url()).not.toBe(editorUrl);

  await login(pageB, second, secondPassword);
  await expect(pageA).toHaveURL(/\/projects$/);
  await expect(pageA.locator(".account-name")).toContainText(second);
  await expect(pageA.getByTestId("project-card")).toHaveCount(0);
  await expect(pageA.getByText(first, { exact: false })).toHaveCount(0);
  await context.close();
});
