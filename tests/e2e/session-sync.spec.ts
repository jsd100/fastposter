import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

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
