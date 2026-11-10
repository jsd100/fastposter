import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { chooseOption, selectValue, showOpenOptions } from "./helpers";

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

test("blank template editor loads only the fonts it needs", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const fontRequests: string[] = [];
  admin.on("request", (request) => {
    if (/\/api\/v1\/assets\/builtin-/.test(request.url()))
      fontRequests.push(request.url());
  });
  await loginAdmin(admin);
  await admin.getByRole("link", { name: "模板", exact: true }).click();
  await expect(admin).toHaveURL(/\/admin\/templates$/);
  fontRequests.length = 0;
  await admin.getByRole("button", { name: "新建模板", exact: true }).click();
  const editor = admin.getByRole("dialog", { name: "模板编辑器" });
  await editor
    .getByLabel("模板背景图片文件", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await expect(
    editor.getByRole("button", { name: "添加文字", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await admin.waitForTimeout(1500);
  expect(fontRequests.filter((url) => /-(700|900)\//.test(url))).toEqual([]);
  expect(
    fontRequests.filter((url) =>
      /builtin-(inter|lxgw|zcool|noto-serif)/.test(url),
    ),
  ).toEqual([]);
  await editor.getByRole("button", { name: "添加文字", exact: true }).click();
  await admin.waitForTimeout(1500);
  expect(
    fontRequests.filter((url) =>
      /builtin-(inter|lxgw|zcool|noto-serif)/.test(url),
    ),
  ).toEqual([]);
  await adminContext.close();
});

/**
 * The template workspace is a full-screen container that hosts the shared
 * Editor, so it has to behave like one: the keyboard goes to it on open and
 * back to the row that opened it on close, while the list keeps the filters
 * that produced that row.
 */
test("closing template editor returns to the filtered list", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const category = "关闭回到筛选列表";
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await loginAdmin(admin);
  await admin.getByRole("link", { name: "模板", exact: true }).click();
  await expect(admin).toHaveURL(/\/admin\/templates$/);
  const categoryReply = await admin.request.post(
    "http://127.0.0.1:15174/api/v1/admin/resources",
    { data: { kind: "template-category", title: category, published: true } },
  );
  expect(categoryReply.ok()).toBeTruthy();
  await admin.getByRole("button", { name: "新建模板", exact: true }).click();
  const created = admin.getByRole("dialog", { name: "模板编辑器" });
  await created
    .getByLabel("模板背景图片文件", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await expect(
    created.getByRole("button", { name: "添加文字", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await created.getByLabel("模板名称", { exact: true }).fill("筛选回归模板");
  await chooseOption(admin, "模板分类", category);
  await created.getByLabel("发布模板", { exact: true }).check();
  await expect(
    created.getByRole("button", { name: "保存模板", exact: true }),
  ).toBeEnabled({ timeout: 15_000 });
  await created.getByRole("button", { name: "保存模板", exact: true }).click();
  const card = admin
    .getByTestId("template-card")
    .filter({ hasText: "筛选回归模板" });
  await expect(card).toBeVisible();

  await chooseOption(admin, "筛选模板分类", category);
  await admin.getByLabel("搜索模板", { exact: true }).fill("筛选回归");
  await expect(admin.getByTestId("template-card")).toHaveCount(1);

  await card.getByRole("button", { name: "编辑", exact: true }).click();
  const workspace = admin.getByRole("dialog", { name: "模板编辑器" });
  await expect(workspace).toBeVisible();
  // Opening the workspace takes the keyboard; the row keeps it only until then.
  await expect(workspace).toBeFocused();
  // Font and background picks stay reachable inside the registered container.
  await expect(
    workspace.getByLabel("模板背景图片文件", { exact: true }),
  ).toHaveCount(1);
  await workspace
    .getByRole("button", { name: "添加文字", exact: true })
    .click();
  await workspace
    .getByRole("button", { name: "编辑文字", exact: true })
    .click();
  await chooseOption(admin, "文字字体", "思源黑体");

  await workspace.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(workspace).toHaveCount(0);
  await expect(selectValue(admin, "筛选模板分类")).toHaveText(category);
  await expect(admin.getByLabel("搜索模板", { exact: true })).toHaveValue(
    "筛选回归",
  );
  await expect(
    card.getByRole("button", { name: "编辑", exact: true }),
  ).toBeFocused();
  await adminContext.close();
});

/**
 * FP-06 / A05.1 / A05.4. A create whose outcome cannot be confirmed (server
 * committed but the reply was dropped, a 5xx, a network abort) must never be
 * resubmitted automatically; the only next step is a read-only list reload.
 * The same rule covers the local two-step chain, template apply and ZIP import.
 */
test("unknown creation outcome only refreshes list", async ({ page }) => {
  test.setTimeout(150_000);
  await registerUser(page, "a05_unknown");

  // A minimal, valid published template document so the picker can offer the
  // "使用模板" action without any admin catalog setup. The apply/import writes
  // themselves are intercepted below; nothing is silently retried.
  const document = JSON.stringify({
    schemaVersion: 1,
    canvas: { width: 4, height: 3 },
    background: { assetId: "e2e-template-bg", version: "1" },
    fonts: [],
    textBlocks: [],
  });
  let createPosts = 0;
  let applyPosts = 0;
  let importPosts = 0;
  await page.route(/\/api\/v1\/projects(\?|$)/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    createPosts += 1;
    // The server really commits the project (route.fetch), but the browser
    // only sees a 5xx, so the outcome cannot be confirmed.
    await route.fetch();
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        code: "CREATE_UNCONFIRMED",
        message: "创建结果无法确认",
        requestId: "e2e-create",
      }),
    });
  });
  await page.route(/\/api\/v1\/catalog\/template(\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "e2e-catalog",
        total: 1,
        resources: [
          {
            id: "e2e-template-1",
            kind: "template",
            title: "未知结果测试模板",
            sortOrder: 0,
            published: true,
            version: "1",
            document,
          },
        ],
      }),
    }),
  );
  // A connection drop (network TypeError) is also an unknown outcome.
  await page.route(/\/api\/v1\/templates\/[^/]+\/apply(\?|$)/, (route) => {
    applyPosts += 1;
    return route.abort("internetdisconnected");
  });
  // A non-JSON 200 decodes as INVALID_RESPONSE: still an unknown outcome.
  await page.route(/\/api\/v1\/templates\/import(\?|$)/, (route) => {
    importPosts += 1;
    return route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: "not-json",
    });
  });

  const unknownNotice = () =>
    page.getByTestId("notice").filter({ hasText: "结果未确认" });
  const reloadAction = () => unknownNotice().getByTestId("notice-action");

  // (1) Local two-step chain: server committed, response disconnected.
  await page
    .getByLabel("导入背景图文件")
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await expect(unknownNotice()).toHaveCount(1);
  await expect(reloadAction()).toHaveText("重新加载作品列表");
  await expect(page).toHaveURL(/\/projects$/);
  expect(createPosts).toBe(1); // no automatic re-submission
  await expect(page.getByTestId("project-card")).toHaveCount(0);
  await reloadAction().click();
  await expect(page.getByTestId("project-card")).toHaveCount(1);
  await expect(unknownNotice()).toHaveCount(0);

  // (2) Template apply: unknown outcome, no resubmission, no editor navigation.
  await page.getByRole("button", { name: "模板库", exact: true }).click();
  let picker = page.getByRole("dialog", { name: "模板库" });
  const card = picker
    .locator(".template-card")
    .filter({ hasText: "未知结果测试模板" });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByRole("button", { name: "使用模板" })).toBeEnabled();
  await card.getByRole("button", { name: "使用模板" }).click();
  await expect(picker).toHaveCount(0); // return to the works list
  await expect(unknownNotice()).toHaveCount(1);
  await expect(page).toHaveURL(/\/projects$/);
  expect(applyPosts).toBe(1);
  await reloadAction().click();
  await expect(unknownNotice()).toHaveCount(0);

  // (3) ZIP import: unknown outcome, no resubmission, no editor navigation.
  await page.getByRole("button", { name: "模板库", exact: true }).click();
  picker = page.getByRole("dialog", { name: "模板库" });
  await picker.getByLabel("导入模板包文件", { exact: true }).setInputFiles({
    name: "unknown.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("PK\u0003\u0004test"),
  });
  await expect(picker).toHaveCount(0);
  await expect(unknownNotice()).toHaveCount(1);
  await expect(page).toHaveURL(/\/projects$/);
  expect(importPosts).toBe(1);
  expect(createPosts).toBe(1); // none of the reloads created another write
  await reloadAction().click();
  await expect(unknownNotice()).toHaveCount(0);
});

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

/**
 * A01 / FP-04. The full-screen workbench must take the list and the sidebar
 * out of the tab order while it is open, keep the editor's own shortcuts, let
 * a nested popup own the keyboard, and hand focus back to its opener on the
 * explicit close.
 */
test("workbench contains tab focus and keeps editor shortcuts", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await loginAdmin(admin);
  await admin.getByRole("link", { name: "模板", exact: true }).click();
  await expect(admin).toHaveURL(/\/admin\/templates$/);

  const opener = admin.getByRole("button", { name: "新建模板", exact: true });
  await opener.click();
  const workbench = admin.getByRole("dialog", { name: "模板编辑器" });
  await expect(workbench).toBeVisible();
  await expect(workbench).toBeFocused();

  // A blank template has no canvas controls until a background is chosen.
  await workbench
    .getByLabel("模板背景图片文件", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await expect(
    workbench.getByRole("button", { name: "添加文字", exact: true }),
  ).toBeVisible({ timeout: 15_000 });

  // Reverse Tab must never leak into the list or the sidebar behind it.
  for (let i = 0; i < 12; i++) {
    await admin.keyboard.press("Shift+Tab");
    await expect
      .poll(() =>
        admin.evaluate(() => {
          const wb = document.querySelector(".workbench");
          return !!wb && wb.contains(document.activeElement);
        }),
      )
      .toBe(true);
  }

  // The workbench does not claim the editor's own shortcuts.
  const blocks = workbench.locator("[data-text-block]");
  await workbench
    .getByRole("button", { name: "添加文字", exact: true })
    .click();
  await expect(blocks).toHaveCount(1);
  await admin.keyboard.press("Control+z");
  await expect(blocks).toHaveCount(0);

  // A nested popup stays usable without the workbench trap pulling focus back.
  await chooseOption(admin, "模板分类", "未分类");

  // Explicit close hands focus back to the control that opened the workbench.
  await workbench.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(workbench).toHaveCount(0);
  await expect(opener).toBeFocused();
  await adminContext.close();
});

/* FP-09 / A08.1. The admin template grid shares the 25 -> 24 shrink path and
   has no pageAfterShrink on the baseline (empty-state lock-up). PNG-safe. */
test("template grid returns to the previous page after its last row disappears", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await loginAdmin(admin);
  try {
    const listPath = "/api/v1/admin/resources/template";
    const row = (n: number) => ({
      id: `a08-tpl-${n}`,
      kind: "template",
      title: `模板 ${String(n).padStart(2, "0")}`,
      categoryId: "",
      sortOrder: n,
      published: true,
      version: "1",
      document: "",
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
      /\/api\/v1\/admin\/resources\/template\?/,
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
    await admin.route(/\/api\/v1\/admin\/resources\/a08-tpl-25$/, (route) => {
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

    await admin.getByRole("link", { name: "模板", exact: true }).click();
    await expect(admin).toHaveURL(/\/admin\/templates$/);
    await expect(admin.getByTestId("template-card")).toHaveCount(24);
    await admin.getByRole("button", { name: "下一页", exact: true }).click();
    await expect(admin.getByTestId("template-card")).toHaveCount(1);
    const last = admin
      .getByTestId("template-card")
      .filter({ hasText: "模板 25" });
    await expect(last).toBeVisible();

    listPages.length = 0;
    await last.getByRole("button", { name: "删除", exact: true }).click();

    await expect.poll(() => listPages.includes("1")).toBe(true);
    expect(listPages).toContain("2");
    await expect(admin.getByTestId("template-card")).toHaveCount(24);
    await expect(
      admin.getByRole("button", { name: "下一页", exact: true }),
    ).toHaveCount(0);
    await expect(admin.getByText("还没有模板")).toHaveCount(0);
  } finally {
    await adminContext.close();
  }
});

/* FP-10 / A09.1 / A09.4. A failure on ANY page keeps the current scope, shows
   a visible error and retries the whole catalog (page 1 + page 2), never
   presenting a partial tree. TemplateList and TemplateEditor share the
   ["admin","categories","template"] query key, so this covers both. */
test("template categories retry a failed page within the same scope", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await loginAdmin(admin);
  try {
    const first = Array.from({ length: 100 }, (_, i) => ({
      id: `a09-tpl-cat-${String(i).padStart(3, "0")}`,
      kind: "template-category",
      title: `模板分类 ${String(i).padStart(3, "0")}`,
      sortOrder: i,
      published: true,
      version: "1",
    }));
    const last = {
      id: "a09-tpl-cat-100",
      kind: "template-category",
      title: "第 101 个模板分类",
      sortOrder: 100,
      published: true,
      version: "1",
    };
    let pageTwoFailed = false;
    const seen: string[] = [];
    await admin.route(
      /\/api\/v1\/admin\/resources\/template-category\?/,
      (route) => {
        const url = new URL(route.request().url());
        const p = url.searchParams.get("page") ?? "1";
        seen.push(`${p}:${url.searchParams.get("pageSize") ?? ""}`);
        if (p === "2" && !pageTwoFailed) {
          pageTwoFailed = true;
          return route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              code: "UPSTREAM_UNAVAILABLE",
              message: "分类第 2 页失败",
              requestId: "e2e-a09",
            }),
          });
        }
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
    await admin.route(/\/api\/v1\/admin\/resources\/template\?/, (route) =>
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
    await admin.getByRole("link", { name: "模板", exact: true }).click();
    await expect(admin).toHaveURL(/\/admin\/templates$/);
    await expect.poll(() => seen.join("|")).toBe("1:100|2:100");
    const errorBox = admin.getByTestId("category-error");
    await expect(errorBox).toBeVisible();
    // Retry re-reads the entire catalog in the same scope.
    seen.length = 0;
    await errorBox
      .getByRole("button", { name: "重新加载", exact: true })
      .click();
    await expect.poll(() => seen.join("|")).toBe("1:100|2:100");
    await expect(errorBox).toHaveCount(0);
    const listbox = await showOpenOptions(admin, "筛选模板分类");
    await expect(
      listbox.getByRole("option", {
        name: "第 101 个模板分类",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await adminContext.close();
  }
});
