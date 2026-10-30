import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const password = "a secure test password";

async function registerAndLogin(page: Page, name: string) {
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

async function login(page: Page, name: string) {
  await page.goto("/login");
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
}

async function importLocalBackground(page: Page) {
  await page
    .getByLabel("导入背景图文件")
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await expect(page).toHaveURL(/\/edit$/);
  await expect(
    page.getByRole("button", { name: "添加文字", exact: true }),
  ).toBeEnabled();
}

test("complete native flow keeps mixed typography and geometry across sessions and downloads the native PNG", async ({
  page,
  browser,
}) => {
  const name = "fullflow_" + Date.now().toString(36);
  await registerAndLogin(page, name);
  await importLocalBackground(page);
  await page.getByRole("button", { name: "添加文字", exact: true }).click();
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = page.getByRole("textbox", { name: "海报文字编辑" });
  await input.fill("占位");
  await input.press("ControlOrMeta+A");
  await input.press("Backspace");
  await page
    .getByLabel("文字字体", { exact: true })
    .selectOption({ label: "Inter" });
  await input.focus();
  await page.keyboard.insertText("FastPoster");
  await page
    .getByLabel("文字字体", { exact: true })
    .selectOption({ label: "思源黑体" });
  await input.focus();
  await page.keyboard.insertText(" 海报");
  const mixed = input.locator('span[data-font-id="builtin-inter-400"]');
  await expect(mixed).toHaveText("FastPoster");
  await expect(mixed).toHaveCSS("font-family", /fp_builtin-inter-400/);
  await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();
  const block = page.locator("[data-text-block]").first();
  await expect(block).toHaveCSS("font-family", /fp_builtin-noto-sc-400/);
  const latin = block.locator('span[style*="fp_builtin-inter-400"]');
  await expect(latin).toHaveText("FastPoster");
  await expect(latin).toHaveCSS("font-family", /fp_builtin-inter-400/);
  await expect(block).toContainText("FastPoster 海报");
  await block.click();
  await page.getByLabel("预览缩放").selectOption("0.5");
  const before = (await block.boundingBox())!;
  const handle = page.getByRole("button", { name: "调整右侧宽度" });
  const grip = (await handle.boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    grip.x + grip.width / 2 - 160,
    grip.y + grip.height / 2,
    {
      steps: 6,
    },
  );
  await page.mouse.up();
  const after = (await block.boundingBox())!;
  expect(after.width).toBeLessThan(before.width - 20);
  await page.getByRole("button", { name: "保存作品", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const url = page.url();
  const projectId = url.split("/").at(-2)!;
  const saved = (
    await (await page.request.get("/api/v1/projects/" + projectId)).json()
  ).project;
  const savedBlock = JSON.parse(saved.document).textBlocks[0];
  expect(savedBlock.width).toBeLessThan(700);

  const second = await browser.newContext();
  const other = await second.newPage();
  await login(other, name);
  await other.goto(url);
  await expect(other.locator("[data-text-block]")).toHaveCount(1);
  const restored = other.locator("[data-text-block]").first();
  await expect(restored).toContainText("FastPoster 海报");
  await expect(restored).toHaveCSS("font-family", /fp_builtin-noto-sc-400/);
  await expect(
    restored.locator('span[style*="fp_builtin-inter-400"]'),
  ).toHaveText("FastPoster");
  expect(Number(await restored.getAttribute("data-x"))).toBe(savedBlock.x);
  expect(Number(await restored.getAttribute("data-y"))).toBe(savedBlock.y);

  await other.getByRole("button", { name: "导出 PNG", exact: true }).click();
  await expect(
    other.getByRole("link", { name: "下载原尺寸 PNG", exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  const preview = other.getByRole("img", { name: "最终导出图片" });
  await expect(preview).toBeVisible();
  const href = await other
    .getByRole("link", { name: "下载原尺寸 PNG", exact: true })
    .getAttribute("href");
  const response = await other.request.get(href!);
  expect(response.headers()["content-type"]).toBe("image/png");
  const body = await response.body();
  expect(body.readUInt32BE(16)).toBe(1200);
  expect(body.readUInt32BE(20)).toBe(1600);
  const previewBody = await (
    await other.request.get((await preview.getAttribute("src"))!)
  ).body();
  expect(createHash("sha256").update(previewBody).digest("hex")).toBe(
    createHash("sha256").update(body).digest("hex"),
  );
  const downloadPromise = other.waitForEvent("download");
  await other
    .getByRole("link", { name: "下载原尺寸 PNG", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  expect(
    createHash("sha256")
      .update(await readFile((await download.path())!))
      .digest("hex"),
  ).toBe(createHash("sha256").update(body).digest("hex"));
  await second.close();
});

test("administrator unpublishes a shared background after adoption without breaking export", async ({
  browser,
  page,
}) => {
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await admin.goto("http://127.0.0.1:15174/admin/login");
  await admin.getByLabel("用户名", { exact: true }).fill("admin-e2e");
  await admin
    .getByLabel("密码", { exact: true })
    .fill("fastposter-test-only-password");
  await admin
    .getByRole("button", { name: "登录管理后台", exact: true })
    .click();
  await expect(admin).toHaveURL(/\/admin\/overview$/);
  await admin.getByRole("link", { name: "背景库", exact: true }).click();
  await admin.getByRole("button", { name: "添加背景", exact: true }).click();
  const title = "验收共享背景 " + Date.now().toString(36);
  await admin.getByLabel("素材名称", { exact: true }).fill(title);
  await admin
    .getByLabel("背景图片文件", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await admin.getByLabel("立即发布", { exact: true }).check();
  await admin.getByRole("button", { name: "保存素材", exact: true }).click();
  const card = admin.getByTestId("resource-card").filter({ hasText: title });
  await expect(card).toBeVisible();

  const name = "adopt_" + Date.now().toString(36);
  await registerAndLogin(page, name);
  await importLocalBackground(page);
  await page.getByRole("button", { name: "添加文字", exact: true }).click();
  const posterBackground = page.locator("[data-poster-frame] img").first();
  const localSource = await posterBackground.getAttribute("src");
  await page.getByRole("button", { name: "背景库", exact: true }).click();
  await page
    .getByRole("button", { name: "选用 " + title, exact: true })
    .click();
  await expect
    .poll(() => posterBackground.getAttribute("src"))
    .not.toBe(localSource);
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();

  await card.getByRole("button", { name: "下架", exact: true }).click();
  await expect(
    admin.getByText("已下架", { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-text-block]")).toHaveCount(1);
  const background = page.locator("[data-poster-frame] img").first();
  await expect(background).toBeVisible();
  await expect
    .poll(() =>
      background.evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBe(1200);
  await page.getByRole("button", { name: "导出 PNG", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "下载原尺寸 PNG", exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  expect((await page.request.get("/api/v1/admin/overview")).status()).toBe(403);
  await adminContext.close();
});

test("offline edits are kept as a draft and restored without silent loss", async ({
  page,
}) => {
  const name = "offline_" + Date.now().toString(36);
  await registerAndLogin(page, name);
  await importLocalBackground(page);
  await page.getByRole("button", { name: "添加文字", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await page.route("**/api/v1/projects/**", (route) =>
    route.request().method() === "PUT"
      ? route.abort("internetdisconnected")
      : route.continue(),
  );
  await page.getByLabel("文本框宽度", { exact: true }).fill("430");
  await expect(
    page.getByText("离线 · 草稿已保留", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/v1/projects/**");
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "发现本地草稿" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "恢复本地草稿", exact: true }).click();
  await expect(page.locator("[data-text-block]")).toHaveCSS("width", "430px");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
});
