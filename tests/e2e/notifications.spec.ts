import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { openPoster } from "./helpers";

async function register(request: Page["request"], username: string) {
  const reply = await request.post("/api/v1/auth/register", {
    data: { username, password: "a secure test password" },
  });
  expect(reply.ok()).toBeTruthy();
}

async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("用户名", { exact: true }).fill(username);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
}

function failUpload(message: string, delayMs = 0) {
  return async (route: import("@playwright/test").Route) => {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ code: "UPLOAD_FAILED", message }),
    });
  };
}

test("failed upload creates one toast without stealing focus", async ({
  page,
  request,
}) => {
  const username = "notice_upload_" + Date.now().toString(36);
  await register(request, username);
  await login(page, username);
  const search = page.getByRole("textbox", { name: "搜索作品" });
  await search.focus();
  await page.route("**/api/v1/assets/images", failUpload("图片上传失败"));
  await page
    .getByLabel("导入背景图文件")
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await expect(page.getByTestId("notice")).toHaveCount(1);
  await expect(page.getByTestId("notice")).toContainText("图片上传失败");
  await expect(search).toBeFocused();
  await page.unroute("**/api/v1/assets/images");
  await page.getByTestId("notice-action").click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/edit$/);
  await expect(page.getByTestId("notice")).toHaveCount(0);
});

test("toast from a modal is accessible and retryable", async ({ page }) => {
  await openPoster(page, "notice_modal");
  await page.getByRole("link", { name: "返回作品" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  const card = page.getByTestId("project-card").first();
  await expect(card).toBeVisible();
  await card.getByLabel(/的操作$/).click();
  await card.getByRole("button", { name: "重命名" }).click();
  const dialog = page.getByRole("dialog", { name: "重命名作品" });
  await expect(dialog).toBeVisible();
  const name = page.getByLabel("作品名称", { exact: true });
  await name.fill("重命名后的作品");
  await page.route("**/api/v1/projects/*", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ code: "SAVE_FAILED", message: "重命名失败" }),
    });
  });
  await page.getByRole("button", { name: "保存名称" }).click();
  await expect(page.getByTestId("notice")).toHaveCount(1);
  await expect(page.getByTestId("notice")).toContainText("重命名失败");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("notice")).toBeVisible();
  expect(
    await page
      .getByTestId("notice")
      .evaluate((element) => element.closest('[aria-hidden="true"]')),
  ).toBeNull();
  await page.unroute("**/api/v1/projects/*");
  await page.getByTestId("notice-action").click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByTestId("project-card").getByText("重命名后的作品"),
  ).toBeVisible();
  await expect(page.getByTestId("notice")).toHaveCount(0);
});

test("account switch clears old notices", async ({ browser, request }) => {
  test.setTimeout(120_000);
  const first = "notice_first_" + Date.now().toString(36);
  const second = "notice_second_" + Date.now().toString(36);
  await register(request, first);
  await register(request, second);
  const context = await browser.newContext();
  const pageA = await context.newPage();
  await login(pageA, first);
  let uploads = 0;
  await pageA.route("**/api/v1/assets/images", async (route) => {
    uploads += 1;
    await failUpload("图片上传失败", uploads === 1 ? 0 : 1500)(route);
  });
  await pageA
    .getByLabel("导入背景图文件")
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await expect(pageA.getByTestId("notice")).toHaveCount(1);
  await pageA
    .getByLabel("导入背景图文件")
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await expect.poll(() => uploads).toBe(2);
  await expect(pageA.getByTestId("notice")).toHaveCount(1);

  const pageB = await context.newPage();
  await pageB.goto("/projects");
  await expect(pageB).toHaveURL(/\/projects$/);
  await pageB.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(pageB).toHaveURL(/\/login/);
  await expect(pageA).toHaveURL(/\/login/);
  await expect(pageA.getByTestId("notice")).toHaveCount(0);

  await login(pageB, second);
  await expect(pageA).toHaveURL(/\/projects$/);
  await pageA.waitForTimeout(2500);
  await expect(pageA.getByTestId("notice")).toHaveCount(0);
  await context.close();
});

test("rename retry submits the title currently shown", async ({ page }) => {
  await openPoster(page, "notice_rename_latest");
  await page.getByRole("link", { name: "返回作品" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  const card = page.getByTestId("project-card").first();
  await card.getByLabel(/的操作$/).click();
  await card.getByRole("button", { name: "重命名" }).click();
  const dialog = page.getByRole("dialog", { name: "重命名作品" });
  const name = page.getByLabel("作品名称", { exact: true });
  const titles: string[] = [];
  await page.route("**/api/v1/projects/*", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    titles.push(
      (route.request().postDataJSON() as { title: string }).title,
    );
    if (titles.length <= 2)
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: "SAVE_FAILED", message: "重命名失败" }),
      });
    return route.continue();
  });
  await name.fill("title A");
  await page.getByRole("button", { name: "保存名称" }).click();
  await expect(page.getByTestId("notice")).toContainText("重命名失败");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByTestId("notice").filter({ hasText: "重命名失败" }),
  ).toHaveCount(0);

  await card.getByLabel(/的操作$/).click();
  await card.getByRole("button", { name: "重命名" }).click();
  await name.fill("title A");
  await page.getByRole("button", { name: "保存名称" }).click();
  await expect(page.getByTestId("notice")).toContainText("重命名失败");
  await name.fill("title B");
  await page.getByTestId("notice-action").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("title B", { exact: true })).toBeVisible();
  expect(titles).toEqual(["title A", "title A", "title B"]);
});

test("closing a picker dismisses its persistent error notice", async ({
  page,
}) => {
  await openPoster(page, "notice_picker_close");
  await page.route(/\/api\/v1\/catalog\/background(\?|$)/, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        code: "INTERNAL",
        message: "review-background-error",
      }),
    }),
  );
  await page.getByRole("button", { name: "背景库", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "背景库" });
  await expect(
    page
      .getByTestId("notice")
      .filter({ hasText: "review-background-error" }),
  ).toBeVisible();
  await picker.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect(
    page
      .getByTestId("notice")
      .filter({ hasText: "review-background-error" }),
  ).toHaveCount(0);
});
