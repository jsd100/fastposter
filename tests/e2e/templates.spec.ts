import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { chooseOption, selectValue } from "./helpers";

async function loginAdmin(page: Page) {
  await page.goto("http://127.0.0.1:15174/admin/login");
  await page.getByLabel("用户名", { exact: true }).fill("admin-e2e");
  await page
    .getByLabel("密码", { exact: true })
    .fill("fastposter-test-only-password");
  await page.getByRole("button", { name: "登录管理后台", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/overview$/);
}

async function registerUser(page: Page, prefix: string) {
  const name = prefix + "_" + Date.now().toString(36);
  await page.goto("/register");
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
}

async function expectZipMagic(downloadPath: string | null) {
  expect(downloadPath).not.toBeNull();
  const body = await readFile(downloadPath!);
  expect(body.subarray(0, 2).toString()).toBe("PK");
}

test("administrator publishes a template, user applies and re-imports an independent package, unpublication preserves the applied work", async ({
  browser,
  page,
}) => {
  test.setTimeout(180_000);
  const longCategory = "限时特惠活动模板分类名称超长用于验证触发器截断";
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await loginAdmin(admin);
  await admin.getByRole("link", { name: "模板", exact: true }).click();
  await expect(admin).toHaveURL(/\/admin\/templates$/);
  const categoryReply = await admin.request.post(
    "http://127.0.0.1:15174/api/v1/admin/resources",
    {
      data: { kind: "template-category", title: longCategory, published: true },
    },
  );
  expect(categoryReply.ok()).toBeTruthy();
  await admin.getByRole("button", { name: "新建模板", exact: true }).click();
  const editor = admin.getByRole("dialog", { name: "模板编辑器" });
  await editor
    .getByLabel("模板背景图片文件", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await expect(
    editor.getByRole("button", { name: "添加文字", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await editor.getByLabel("模板名称", { exact: true }).fill("限时特惠模板");
  await editor.getByRole("button", { name: "添加文字", exact: true }).click();
  await editor.getByRole("button", { name: "编辑文字", exact: true }).click();
  await editor.getByRole("textbox", { name: "海报文字编辑" }).fill("限时特惠");
  await editor
    .getByRole("button", { name: "完成文字编辑", exact: true })
    .click();
  await editor.getByLabel("发布模板", { exact: true }).check();
  await chooseOption(admin, "模板分类", longCategory);
  await expect(
    editor.getByRole("button", { name: "保存模板", exact: true }),
  ).toBeEnabled({ timeout: 15_000 });
  await editor.getByRole("button", { name: "保存模板", exact: true }).click();
  const adminCard = admin
    .getByTestId("template-card")
    .filter({ hasText: "限时特惠模板" });
  await expect(adminCard).toBeVisible();
  await expect(adminCard.getByText("已发布", { exact: true })).toBeVisible();

  await registerUser(page, "template_user");
  await page.getByRole("button", { name: "模板库", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "模板库" });
  const templateCard = picker
    .locator(".template-card")
    .filter({ hasText: "限时特惠模板" });
  await expect(templateCard).toBeVisible({ timeout: 20_000 });
  await chooseOption(page, "模板分类", longCategory);
  await expect(selectValue(page, "模板分类")).toHaveText(longCategory);
  await expect(templateCard).toBeVisible({ timeout: 15_000 });
  await chooseOption(page, "模板分类", "全部分类");
  await expect(templateCard).toBeVisible({ timeout: 15_000 });
  const applyButton = templateCard.getByRole("button", {
    name: "使用模板",
    exact: true,
  });
  await expect(applyButton).toBeEnabled({ timeout: 15_000 });
  await applyButton.click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/edit$/, {
    timeout: 15_000,
  });
  const appliedUrl = page.url();
  await expect(page.locator("[data-text-block]")).toHaveText("限时特惠");

  await adminCard.getByRole("button", { name: "下架", exact: true }).click();
  await expect(adminCard.getByText("已下架", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-text-block]")).toHaveText("限时特惠");
  await page.getByRole("button", { name: "导出 PNG", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "下载原尺寸 PNG", exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await page
    .getByRole("dialog", { name: "导出海报" })
    .getByRole("button", { name: "关闭", exact: true })
    .click();

  const projectDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出模板包", exact: true }).click();
  const projectPackage = await projectDownload;
  expect(projectPackage.suggestedFilename()).toMatch(/\.zip$/);
  const projectPackagePath = await projectPackage.path();
  await expectZipMagic(projectPackagePath);

  await page.getByRole("link", { name: "返回作品", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByRole("button", { name: "模板库", exact: true }).click();
  const importPicker = page.getByRole("dialog", { name: "模板库" });
  await importPicker
    .getByLabel("导入模板包文件", { exact: true })
    .setInputFiles(projectPackagePath!);
  await expect(page).toHaveURL(/\/projects\/[^/]+\/edit$/, {
    timeout: 15_000,
  });
  expect(page.url()).not.toBe(appliedUrl);
  await expect(page.locator("[data-text-block]")).toHaveText("限时特惠");

  const adminDownload = admin.waitForEvent("download");
  await adminCard.getByRole("button", { name: "导出", exact: true }).click();
  const adminPackage = await adminDownload;
  expect(adminPackage.suggestedFilename()).toMatch(/\.zip$/);
  const adminPackagePath = await adminPackage.path();
  await expectZipMagic(adminPackagePath);
  await admin
    .getByLabel("导入管理员模板包", { exact: true })
    .setInputFiles(adminPackagePath!);
  await expect(
    admin.getByTestId("template-card").filter({ hasText: "限时特惠模板" }),
  ).toHaveCount(2);
  await adminContext.close();
});
