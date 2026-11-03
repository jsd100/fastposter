import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFile } from "node:fs/promises";

test("a genuine PNG uploaded as .jpg keeps its real format in the editor, admin catalog and export", async ({
  browser,
  page,
}) => {
  test.setTimeout(90_000);
  const spoofed = {
    name: "portrait.jpg",
    mimeType: "image/jpeg",
    buffer: await readFile(path.resolve("tests/fixtures/images/rgba.png")),
  };

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
  await admin.getByLabel("素材名称", { exact: true }).fill("错名风景");
  await admin
    .getByLabel("背景图片文件", { exact: true })
    .setInputFiles(spoofed);
  await admin.getByLabel("立即发布", { exact: true }).check();
  await admin.getByRole("button", { name: "保存素材", exact: true }).click();
  const card = admin
    .getByTestId("resource-card")
    .filter({ hasText: "错名风景" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("4 × 3 px");
  await adminContext.close();

  const name = "spoof_" + Date.now().toString(36);
  await page.goto("/register");
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByLabel("导入背景图文件").setInputFiles(spoofed);
  await expect(page).toHaveURL(/\/projects\/[^/]+\/edit$/);
  const frame = page.locator("[data-poster-frame]");
  await expect(frame).toHaveAttribute("data-width", "4");
  await expect(frame).toHaveAttribute("data-height", "3");
  const background = page.locator(".poster-background");
  const source = await background.getAttribute("src");
  const asset = await page.request.get(source!);
  expect(asset.headers()["content-type"]).toBe("image/png");
  const assetBody = await asset.body();
  expect(assetBody.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");

  await page.getByRole("button", { name: "导出 PNG", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "下载原尺寸 PNG", exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  const href = await page
    .getByRole("link", { name: "下载原尺寸 PNG", exact: true })
    .getAttribute("href");
  const exported = await page.request.get(href!);
  expect(exported.headers()["content-type"]).toBe("image/png");
  const body = await exported.body();
  expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(body.readUInt32BE(16)).toBe(4);
  expect(body.readUInt32BE(20)).toBe(3);
});
