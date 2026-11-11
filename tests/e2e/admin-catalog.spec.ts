import { test, expect } from "@playwright/test";
import path from "node:path";
import {
  chooseOption,
  openPoster,
  selectScenery,
  selectTrigger,
  selectValue,
  showOpenOptions,
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

/* FP-10 / A09.1 / A09.4. The admin background filter must read the WHOLE
   category catalog before offering a tree/dropdown: the 101st category lives
   on a second page. The request sequence (page 1, page 2, pageSize 100) is
   asserted so a synthetic single page cannot pass by accident. */
test("admin catalog reads every category page before showing the tree", async ({
  browser,
}) => {
  test.setTimeout(90_000);
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
    const first = Array.from({ length: 100 }, (_, i) => ({
      id: `a09-bg-cat-${String(i).padStart(3, "0")}`,
      kind: "background-category",
      title: `背景分类 ${String(i).padStart(3, "0")}`,
      sortOrder: i,
      published: true,
      version: "1",
    }));
    const last = {
      id: "a09-bg-cat-100",
      kind: "background-category",
      title: "第 101 个背景分类",
      sortOrder: 100,
      published: true,
      version: "1",
    };
    const seen: string[] = [];
    await admin.route(
      /\/api\/v1\/admin\/resources\/background-category\?/,
      (route) => {
        const url = new URL(route.request().url());
        const p = url.searchParams.get("page") ?? "1";
        seen.push(`${p}:${url.searchParams.get("pageSize") ?? ""}`);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            requestId: "e2e-a09",
            resources: p === "1" ? first : [last],
            total: 101,
          }),
        });
      },
    );
    await admin.route(/\/api\/v1\/admin\/resources\/background\?/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          requestId: "e2e-a09",
          resources: [],
          total: 0,
        }),
      }),
    );
    await admin.getByRole("link", { name: "背景库", exact: true }).click();
    await expect(admin).toHaveURL(/\/admin\/backgrounds$/);
    await expect.poll(() => seen.join("|")).toBe("1:100|2:100");
    const listbox = await showOpenOptions(admin, "筛选素材分类");
    await expect(
      listbox.getByRole("option", {
        name: "第 101 个背景分类",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

/* B01 fix round / Rulings 199-202. A quick publish toggle (Resources.tsx)
   must recover a REVISION_CONFLICT by reloading the newest resource through
   AdminGetResource and waiting for an explicit confirmation before a second
   POST. No automatic resend, no silent merge. */
test("quick publish conflict reloads newest resource and waits for explicit confirmation", async ({
  browser,
}) => {
  test.setTimeout(90_000);
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
    const id = "fix-bg-conflict";
    const resource = (version: string, published: boolean, title: string) => ({
      id,
      kind: "background",
      title,
      version,
      published,
      sortOrder: 0,
      categoryId: "",
      asset: {
        id: "fix-bg-asset",
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
    let postCount = 0;
    let succeeded = false;
    const bodies: Array<Record<string, unknown>> = [];

    // The admin detail route returns the newest server-side snapshot.
    await admin.route(
      /\/api\/v1\/admin\/resources\/fix-bg-conflict\/detail$/,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            requestId: "e2e-fix",
            resource: resource("7", false, "服务端最新背景"),
          }),
        }),
    );
    // First POST -> 409; a second POST only happens after explicit confirm.
    await admin.route(/\/api\/v1\/admin\/resources$/, (route) => {
      postCount++;
      bodies.push(route.request().postDataJSON() as Record<string, unknown>);
      if (postCount === 1)
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            code: "REVISION_CONFLICT",
            message: "资源已被其他操作更新，请刷新后重试",
            requestId: "e2e-fix",
          }),
        });
      succeeded = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          requestId: "e2e-fix",
          resource: resource("8", true, "服务端最新背景"),
        }),
      });
    });
    // Synthetic list; after the confirmed success it reflects the new state.
    await admin.route(/\/api\/v1\/admin\/resources\/background\?/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          requestId: "e2e-fix",
          resources: [
            resource(
              succeeded ? "8" : "1",
              succeeded,
              succeeded ? "服务端最新背景" : "修复测试背景",
            ),
          ],
          total: 1,
        }),
      }),
    );
    await admin.route(
      /\/api\/v1\/admin\/resources\/background-category\?/,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            requestId: "e2e-fix",
            resources: [],
            total: 0,
          }),
        }),
    );

    await admin.getByRole("link", { name: "背景库", exact: true }).click();
    await expect(admin).toHaveURL(/\/admin\/backgrounds$/);
    const card = admin.getByTestId("resource-card");
    await expect(card).toHaveCount(1);
    await card.getByRole("button", { name: "发布", exact: true }).click();

    // (a) 409 must NOT trigger an automatic second POST.
    await expect.poll(() => postCount).toBe(1);
    expect(bodies[0].expectedVersion).toBe("1");

    // (b) visible conflict state showing the newest version/state/title.
    const conflict = admin.getByTestId("version-conflict");
    await expect(conflict).toBeVisible();
    await expect(conflict).toContainText("7");
    await expect(conflict).toContainText("服务端最新背景");

    // (c) explicit confirmation affordance; still no auto resend.
    const confirm = admin.getByRole("button", {
      name: "确认重新提交",
      exact: true,
    });
    await expect(confirm).toBeVisible();
    await expect.poll(() => postCount).toBe(1);

    // (d) only the confirmation sends the second POST, with latest.version.
    await confirm.click();
    await expect.poll(() => postCount).toBe(2);
    expect(bodies[1].expectedVersion).toBe("7");
    expect(bodies[1].published).toBe(true);

    // (e) success clears the conflict state and refreshes the list.
    await expect(admin.getByTestId("version-conflict")).toHaveCount(0);
    await expect(admin.getByTestId("resource-card")).toContainText("已发布");
  } finally {
    await context.close();
  }
});
