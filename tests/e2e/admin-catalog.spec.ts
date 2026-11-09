import { test, expect } from "@playwright/test";
import path from "node:path";
import {
  chooseOption,
  openPoster,
  selectScenery,
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
  // Selecting a file is not uploading it: every request below is one the page
  // makes when the form is submitted, so the count is the contract.
  const uploads: string[] = [];
  admin.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/api\/v1\/assets\/images$/.test(new URL(request.url()).pathname)
    )
      uploads.push(request.url());
  });
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
  const secondForm = admin.getByRole("dialog", { name: "添加背景" });
  await admin
    .getByLabel("背景图片文件", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/images/rgba.png"));
  await expect(secondForm.getByText("rgba.png", { exact: true })).toBeVisible();
  expect(uploads).toHaveLength(1);
  // Cancelling the pick takes the pending file back and sends nothing.
  await secondForm
    .getByRole("button", { name: "删除文件", exact: true })
    .click();
  await expect(secondForm.getByText("rgba.png", { exact: true })).toHaveCount(
    0,
  );
  await admin
    .getByLabel("背景图片文件", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/images/rgba.png"));
  await admin.getByLabel("立即发布", { exact: true }).check();
  await admin.getByRole("button", { name: "保存素材", exact: true }).click();
  expect(uploads).toHaveLength(2);
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
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = await selectScenery(page);
  const font = page.getByLabel("文字字体", { exact: true });
  // The 500-only Latin family cannot cover the selected Chinese, so the
  // preflight rejects it and the untouched document stays exportable.
  await font.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await font.fill("Test Inter");
  await page
    .getByRole("listbox")
    .getByRole("option", { name: "Test Inter", exact: true })
    .click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(
    page.getByTestId("notice").filter({ hasText: "缺少字形" }),
  ).toBeVisible();
  await expect(input).toHaveCSS("font-family", /fp_builtin-noto-sc-400/);
  // The combobox keeps its search field empty once the menu closes; the chosen
  // family is what the trigger shows.
  await expect(selectValue(page, "文字字体")).toHaveText("思源黑体");
  await expect(selectValue(page, "文字字重")).toHaveText("400");
  await expect(
    page.getByRole("button", { name: "导出 PNG", exact: true }),
  ).toBeEnabled();
  await page
    .getByTestId("notice")
    .filter({ hasText: "缺少字形" })
    .getByTestId("notice-close")
    .click();
  // English text has glyphs, so the same family applies at weight 500.
  await input.fill("Poster 2026");
  await input.press("ControlOrMeta+A");
  await chooseOption(page, "文字字体", "Test Inter");
  await expect(selectValue(page, "文字字重")).toHaveText("500");
  await expect(input.getByText("Poster 2026", { exact: true })).toHaveCSS(
    "font-family",
    /fp_/,
  );
  // Appending Chinese leaves the document with missing glyphs; the long-lived
  // check blocks export until the target is repaired.
  await input.press("End");
  await page.keyboard.insertText("海报");
  await expect(
    page.getByTestId("notice").filter({ hasText: "缺少字形" }),
  ).toBeVisible();
  await expect(
    page.locator(".status-error").filter({ hasText: "缺少字形" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "导出 PNG", exact: true }),
  ).toBeDisabled();
  // A loaded missing-glyph document can still repair the current target.
  await input.press("Shift+ArrowLeft");
  await input.press("Shift+ArrowLeft");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("海报");
  await chooseOption(page, "文字字体", "思源黑体");
  await expect(
    page.getByTestId("notice").filter({ hasText: "缺少字形" }),
  ).toHaveCount(0);
  await expect(
    page.locator(".status-error").filter({ hasText: "缺少字形" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "导出 PNG", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const projectId = page.url().split("/").at(-2)!;
  const project = (
    await (await page.request.get(`/api/v1/projects/${projectId}`)).json()
  ).project;
  const savedDocument = JSON.parse(project.document) as {
    fonts: { family: string }[];
  };
  expect(savedDocument.fonts.some((ref) => ref.family === "Test Inter")).toBe(
    true,
  );
  await admin
    .getByTestId("resource-card")
    .filter({ hasText: "中等字体 500" })
    .getByRole("button", { name: "下架", exact: true })
    .click();
  await page.reload();
  await expect(page.locator("[data-text-block]")).toHaveText("Poster 2026海报");
  await page.getByRole("button", { name: "导出 PNG", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "下载原尺寸 PNG", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await context.close();
});

/* FP-09 / A08.1. The admin background grid shares the same 25 -> 24 shrink
   path as the user gallery. On the baseline it has no pageAfterShrink at all,
   so deleting the last page-2 row locks the list into its empty state instead
   of re-requesting page=1. This case is PNG-safe (no export step). */
test("background grid returns to the previous page after its last row disappears", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const context = await browser.newContext();
  const admin = await context.newPage();
  await admin.goto("http://127.0.0.1:15174/admin/login");
  await admin.getByLabel("用户名", { exact: true }).fill("admin-e2e");
  await admin
    .getByLabel("密码", { exact: true })
    .fill("fastposter-test-only-password");
  await admin
    .getByRole("button", { name: "登录管理后台", exact: true })
    .click();
  await expect(admin).toHaveURL(/\/admin\/overview$/);
  try {
    const listPath = "/api/v1/admin/resources/background";
    const row = (n: number) => ({
      id: `a08-bg-${n}`,
      kind: "background",
      title: `背景 ${String(n).padStart(2, "0")}`,
      categoryId: "",
      sortOrder: n,
      published: true,
      version: "1",
      asset: {
        id: `a08-asset-${n}`,
        version: "1",
        kind: "image",
        name: "bg",
        width: 1200,
        height: 800,
        size: "1",
        sha256: "x",
        previewUrl: "",
      },
    });
    const firstPage = Array.from({ length: 24 }, (_, i) => row(i + 1));
    let shrunk = false;
    await admin.route(
      /\/api\/v1\/admin\/resources\/background\?/,
      async (route) => {
        const page = new URL(route.request().url()).searchParams.get("page");
        const resources = page === "2" ? (shrunk ? [] : [row(25)]) : firstPage;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            requestId: "e2e-a08",
            resources,
            total: shrunk ? 24 : 25,
          }),
        });
      },
    );
    await admin.route(/\/api\/v1\/admin\/resources\/a08-bg-25$/, (route) => {
      shrunk = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ requestId: "e2e-a08" }),
      });
    });

    const listPages: string[] = [];
    admin.on("request", (req) => {
      const u = new URL(req.url());
      if (req.method() === "GET" && u.pathname === listPath)
        listPages.push(u.searchParams.get("page") ?? "1");
    });

    await admin.getByRole("link", { name: "背景库", exact: true }).click();
    await expect(admin.getByTestId("resource-card")).toHaveCount(24);
    await admin.getByRole("button", { name: "下一页", exact: true }).click();
    await expect(admin.getByTestId("resource-card")).toHaveCount(1);
    const last = admin
      .getByTestId("resource-card")
      .filter({ hasText: "背景 25" });
    await expect(last).toBeVisible();

    listPages.length = 0;
    await last.getByRole("button", { name: "删除", exact: true }).click();

    // 25 -> 24: a successful shrink must re-request page=1 (real sequence).
    await expect.poll(() => listPages.includes("1")).toBe(true);
    expect(listPages).toContain("2");
    await expect(admin.getByTestId("resource-card")).toHaveCount(24);
    await expect(
      admin.getByRole("button", { name: "下一页", exact: true }),
    ).toHaveCount(0);
    await expect(admin.getByText("还没有共享背景")).toHaveCount(0);
  } finally {
    await context.close();
  }
});
