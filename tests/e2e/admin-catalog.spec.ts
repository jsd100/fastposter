import { test, expect } from "@playwright/test";
import path from "node:path";
import {
  chooseOption,
  openPoster,
  selectTrigger,
  selectValue,
} from "./helpers";
test("administrator publishes a background, user adopts it, unpublication preserves export", async ({
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
  await admin.getByRole("button", { name: "添加分类", exact: true }).click();
  const categoryForm = admin.getByRole("dialog", { name: "添加分类" });
  await categoryForm.getByLabel("分类名称", { exact: true }).fill("风景摄影");
  await categoryForm
    .getByRole("button", { name: "保存分类", exact: true })
    .click();
  await expect(categoryForm).toHaveCount(0);
  await admin.getByRole("button", { name: "添加背景", exact: true }).click();
  await admin.getByLabel("素材名称", { exact: true }).fill("共享风景");
  await chooseOption(admin, "素材分类", "风景摄影");
  await admin
    .getByLabel("背景图片文件", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await admin.getByLabel("立即发布", { exact: true }).check();
  await admin.getByRole("button", { name: "保存素材", exact: true }).click();
  await expect(
    admin.getByTestId("resource-card").filter({ hasText: "共享风景" }),
  ).toBeVisible();
  await admin.getByRole("button", { name: "添加背景", exact: true }).click();
  await admin.getByLabel("素材名称", { exact: true }).fill("另一背景");
  await admin
    .getByLabel("背景图片文件", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/images/rgba.png"));
  await admin.getByLabel("立即发布", { exact: true }).check();
  await admin.getByRole("button", { name: "保存素材", exact: true }).click();
  await expect(admin.getByTestId("resource-card")).toHaveCount(2);
  await chooseOption(admin, "筛选素材分类", "风景摄影");
  await expect(selectValue(admin, "筛选素材分类")).toHaveText("风景摄影");
  await expect(admin.getByTestId("resource-card")).toHaveCount(1);
  await chooseOption(admin, "筛选素材分类", "全部分类");
  await expect(admin.getByTestId("resource-card")).toHaveCount(2);
  await openPoster(page, "shared");
  await page.getByRole("button", { name: "背景库", exact: true }).click();
  await page
    .getByRole("button", { name: "选用 共享风景", exact: true })
    .click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await admin
    .getByTestId("resource-card")
    .filter({ hasText: "共享风景" })
    .getByRole("button", { name: "下架", exact: true })
    .click();
  await expect(
    admin.getByText("已下架", { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-text-block]")).toHaveCount(1);
  await page.getByRole("button", { name: "导出 PNG", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "下载原尺寸 PNG", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  const forbidden = await page.request.get("/api/v1/admin/overview");
  expect(forbidden.status()).toBe(403);
  const metadata = await admin.request.get(
    "http://127.0.0.1:15174/api/v1/admin/projects",
  );
  expect(metadata.ok()).toBeTruthy();
  expect(JSON.stringify(await metadata.json())).not.toContain("textBlocks");
  await adminContext.close();
});
test("uploaded actual 500-weight font warns missing glyphs and remains usable after unpublication", async ({
  browser,
  page,
}) => {
  const context = await browser.newContext(),
    admin = await context.newPage();
  await admin.goto("http://127.0.0.1:15174/admin/login");
  await admin.getByLabel("用户名", { exact: true }).fill("admin-e2e");
  await admin
    .getByLabel("密码", { exact: true })
    .fill("fastposter-test-only-password");
  await admin
    .getByRole("button", { name: "登录管理后台", exact: true })
    .click();
  await expect(admin).toHaveURL(/\/admin\/overview$/);
  await admin.getByRole("link", { name: "字体库", exact: true }).click();
  await admin.getByRole("button", { name: "添加字体", exact: true }).click();
  await admin.getByLabel("素材名称", { exact: true }).fill("中等字体 500");
  await admin.getByLabel("字体家族", { exact: true }).fill("Test Inter");
  await chooseOption(admin, "字体字重", "500");
  await chooseOption(admin, "字体样式", "正常");
  await admin
    .getByLabel("字体文件", { exact: true })
    .setInputFiles(path.resolve("assets/fonts/Inter-VF.ttf"));
  await admin
    .getByLabel("授权说明", { exact: true })
    .fill("SIL Open Font License 1.1");
  await admin.getByLabel("立即发布", { exact: true }).check();
  await admin.getByRole("button", { name: "保存素材", exact: true }).click();
  await expect(
    admin.getByTestId("resource-card").filter({ hasText: "中等字体 500" }),
  ).toBeVisible();
  await admin
    .getByTestId("resource-card")
    .filter({ hasText: "中等字体 500" })
    .getByRole("button", { name: "编辑", exact: true })
    .click();
  await expect(selectTrigger(admin, "字体字重")).toBeDisabled();
  await selectTrigger(admin, "字体字重").click({ force: true });
  await expect(admin.getByRole("listbox")).toHaveCount(0);
  await expect(selectValue(admin, "字体字重")).toHaveText("500");
  await admin.getByRole("button", { name: "取消", exact: true }).click();
  await openPoster(page, "font");
  await page
    .getByLabel("文字字体", { exact: true })
    .selectOption({ label: "Test Inter" });
  await expect(page.getByLabel("文字字重", { exact: true })).toHaveValue("500");
  await expect(
    page.getByRole("alert").filter({ hasText: "缺少字形" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "导出 PNG", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  await page.getByRole("textbox", { name: "海报文字编辑" }).fill("Poster 2026");
  await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "缺少字形" }),
  ).toHaveCount(0);
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await admin
    .getByTestId("resource-card")
    .filter({ hasText: "中等字体 500" })
    .getByRole("button", { name: "下架", exact: true })
    .click();
  await page.reload();
  await expect(page.locator("[data-text-block]")).toHaveText("Poster 2026");
  await page.getByRole("button", { name: "导出 PNG", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "下载原尺寸 PNG", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await context.close();
});
