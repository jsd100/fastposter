import { test, expect, type Browser, type Page } from "@playwright/test";
import path from "node:path";
import { chooseCardAction } from "./helpers";
async function account(page: Page, name: string) {
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
test("register, create, rename, copy, delete, restore, isolate next account", async ({
  page,
}) => {
  const suffix = Date.now().toString(36);
  await account(page, "poster_" + suffix);
  await page
    .getByLabel("导入背景图文件")
    .setInputFiles(path.resolve("tests/fixtures/images/rgba.png"));
  await expect(page).toHaveURL(/\/projects\/[^/]+\/edit/);
  await page.getByRole("link", { name: "返回作品", exact: true }).click();
  await expect(page.getByTestId("project-card")).toHaveCount(1);
  await chooseCardAction(page, page.getByLabel("rgba 的操作"), "重命名");
  await page.getByLabel("作品名称").fill("旅行日记");
  await page.getByRole("button", { name: "保存名称", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "旅行日记", exact: true }),
  ).toBeVisible();
  await chooseCardAction(page, page.getByLabel("旅行日记 的操作"), "复制作品");
  await expect(page.getByTestId("project-card")).toHaveCount(2);
  await chooseCardAction(
    page,
    page.getByLabel("旅行日记 的操作", { exact: true }),
    "移到回收站",
  );
  await page.getByRole("button", { name: "确认移入回收站" }).click();
  await expect(page.getByTestId("project-card")).toHaveCount(1);
  await page.getByRole("button", { name: "回收站", exact: true }).click();
  await expect(page.getByTestId("project-card")).toHaveCount(1);
  await page.getByRole("button", { name: "恢复作品" }).click();
  await expect(page.getByTestId("project-card")).toHaveCount(0);
  await page.getByRole("button", { name: "我的作品", exact: true }).click();
  await expect(page.getByTestId("project-card")).toHaveCount(2);
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await account(page, "second_" + suffix);
  await expect(page.getByTestId("project-card")).toHaveCount(0);
  await expect(page.getByText("旅行日记", { exact: true })).toHaveCount(0);
});
test("360px viewport keeps critical controls within screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await account(page, "mobile_" + Date.now().toString(36));
  await expect(
    page.getByRole("button", { name: "新建海报", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  for (const name of ["新建海报", "我的作品", "回收站"]) {
    const box = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  }
});
/**
 * Imports one poster so the session holds a document the server accepts, then
 * clones it under `${title} 01..NN`. Leaves the browser in the editor and
 * returns the document every seeded project shares.
 */
async function seedGallery(page: Page, title: string, count: number) {
  await page
    .getByLabel("导入背景图文件")
    .setInputFiles(path.resolve("tests/fixtures/images/rgba.png"));
  await expect(page).toHaveURL(/\/edit$/);
  const id = new URL(page.url()).pathname.split("/")[2];
  const detail = await (
    await page.request.get(`/api/v1/projects/${id}`)
  ).json();
  for (let index = 1; index <= count; index++) {
    const created = await page.request.post("/api/v1/projects", {
      data: {
        title: `${title} ${String(index).padStart(2, "0")}`,
        document: detail.project.document,
      },
    });
    expect(created.ok()).toBeTruthy();
  }
  return detail.project.document as string;
}
test("return to filtered gallery restores page and scroll for the same account", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const suffix = Date.now().toString(36);
  const search = page.getByLabel("搜索作品", { exact: true });
  const pager = page.getByRole("navigation", { name: "作品分页" });
  const pagerPage = (index: number) =>
    expect(
      pager.getByRole("button", { name: `页 ${index}`, exact: true }),
    ).toHaveAttribute("aria-current", "page");

  await account(page, "gallery_" + suffix);
  const documentJson = await seedGallery(page, "画廊作品", 32);
  // One newest work the keyword cannot match: while the keyword is still
  // debounced it sits at the top of the first page, so its absence is the
  // signal that the filtered result is the one on screen.
  const sentinel = "不落入选 99";
  expect(
    (
      await page.request.post("/api/v1/projects", {
        data: { title: sentinel, document: documentJson },
      })
    ).ok(),
  ).toBeTruthy();

  // A filtered gallery that really has a second page to scroll through.
  await page.goto("/projects");
  await search.fill("画廊作品");
  await expect(
    page.getByTestId("project-card").filter({ hasText: sentinel }),
  ).toHaveCount(0);
  await pagerPage(1);
  await expect(page.getByTestId("project-card")).toHaveCount(24);
  await pager.getByRole("button", { name: "下一页", exact: true }).click();
  await pagerPage(2);
  await expect(page.getByTestId("project-card")).toHaveCount(8);

  await page.evaluate(() => window.scrollTo(0, 240));
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(0);
  // The card on screen when the work is opened is the one on screen again
  // on the way back.
  const topTitle = await page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>("[data-testid='project-card']"),
    );
    const visible = cards.find((card) => {
      const box = card.getBoundingClientRect();
      return box.bottom > 0 && box.top < window.innerHeight;
    });
    return visible?.querySelector("h3")?.textContent ?? "";
  });
  expect(topTitle).not.toBe("");

  await page
    .getByRole("link", { name: `编辑 ${topTitle}`, exact: true })
    .click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/edit$/);
  await expect(
    page.getByRole("button", { name: "添加文字", exact: true }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "返回作品", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);

  await expect(search).toHaveValue("画廊作品");
  await pagerPage(2);
  await expect(page.getByTestId("project-card")).toHaveCount(8);
  await expect(
    page.getByTestId("project-card").locator("h3").first(),
  ).toHaveText(topTitle);
  await expect
    .poll(async () =>
      Math.abs((await page.evaluate(() => window.scrollY)) - scrolled),
    )
    .toBeLessThanOrEqual(8);

  // A different account starts clean in the same App session: the previous
  // account's keyword and page are not carried over.
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await account(page, "second_" + suffix);
  await seedGallery(page, "另一空间", 25);
  await page.getByRole("link", { name: "返回作品", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(search).toHaveValue("");
  // The works above arrive through the API, not through this app instance, so
  // the gallery needs a fresh request to list them.
  await page.goto("/projects");
  await pagerPage(1);
  await expect(page.getByTestId("project-card")).toHaveCount(24);
  const titles = await page
    .getByTestId("project-card")
    .locator("h3")
    .allTextContents();
  expect(titles[0]).toContain("另一空间");
  expect(titles.some((title) => title.includes("画廊作品"))).toBe(false);
});

/**
 * FP-05 / A06.1. Publish a real background through the admin site (the same
 * path as admin-catalog.spec.ts) and return the admin context for the caller
 * to close. A fresh account's gallery then sees it in the public catalog.
 */
async function publishBackground(browser: Browser, title: string) {
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
  await admin.getByRole("link", { name: "背景库", exact: true }).click();
  await admin.getByRole("button", { name: "添加背景", exact: true }).click();
  await admin.getByLabel("素材名称", { exact: true }).fill(title);
  await admin
    .getByLabel("背景图片文件", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await admin.getByLabel("立即发布", { exact: true }).check();
  await admin.getByRole("button", { name: "保存素材", exact: true }).click();
  await expect(
    admin.getByTestId("resource-card").filter({ hasText: title }),
  ).toBeVisible();
  return context;
}

/**
 * A06.1 / A06.2 / A06.3. Both the top bar and the empty state reach one
 * clearly-named source selection. The baseline's 「新建海报」 opens the native
 * file chooser directly (or has no gallery entry at all); the fixed product
 * shows a source dialog, opens the file chooser only from 「上传本地图片」
 * inside the click's activation, and creates from a real published background
 * with zero local uploads, original dimensions/version, a returned id that can
 * be re-opened.
 */
test("gallery creates at the published background dimensions", async ({
  page,
  browser,
}) => {
  test.setTimeout(150_000);
  const title = "共享风景 " + Date.now().toString(36);
  const adminContext = await publishBackground(browser, title);
  await account(page, "a06_gallery_" + Date.now().toString(36));

  const uploads: string[] = [];
  const creates: unknown[] = [];
  let chooserCount = 0;
  page.on("request", (req) => {
    if (req.method() !== "POST") return;
    const p = new URL(req.url()).pathname;
    if (p === "/api/v1/assets/images") uploads.push(p);
    if (p === "/api/v1/projects") creates.push(req.postDataJSON());
  });
  // Observe (and cancel) every native file chooser: setFiles([]) leaves the
  // input with no file, so a cancel can never start an upload.
  page.on("filechooser", (fc) => {
    chooserCount += 1;
    void fc.setFiles([]).catch(() => {});
  });

  const menu = () => page.getByRole("dialog", { name: "新建海报" });
  const top = () => page.getByRole("button", { name: "新建海报", exact: true });

  // (A) Top bar reaches the source selection; no direct file picker; cancel
  // produces zero uploads and zero creates.
  await top().click();
  await expect(menu()).toBeVisible();
  expect(chooserCount).toBe(0);
  await menu().getByRole("button", { name: "取消", exact: true }).click();
  await expect(menu()).toHaveCount(0);
  expect(uploads.length).toBe(0);
  expect(creates.length).toBe(0);

  // (B) The empty state reaches the same source selection.
  await page.getByRole("button", { name: "导入背景图", exact: true }).click();
  await expect(menu()).toBeVisible();
  await menu().getByRole("button", { name: "取消", exact: true }).click();
  await expect(menu()).toHaveCount(0);
  expect(uploads.length).toBe(0);
  expect(creates.length).toBe(0);

  // (C) 「上传本地图片」 opens the native picker inside the click's user
  // activation; cancelling produces no write and restores focus.
  await top().click();
  const chooserPromise = page.waitForEvent("filechooser");
  await menu()
    .getByRole("button", { name: "上传本地图片", exact: true })
    .click();
  await chooserPromise;
  expect(chooserCount).toBe(1);
  await expect(menu()).toHaveCount(0);
  expect(uploads.length).toBe(0);
  expect(creates.length).toBe(0);
  await expect(top()).toBeFocused();

  // (D) Real published background, single-select + confirm, no local upload.
  await top().click();
  await menu()
    .getByRole("button", { name: "从背景库选择", exact: true })
    .click();
  const library = page.getByRole("dialog", { name: "背景库" });
  await expect(library).toBeVisible();
  const card = library.getByRole("button", {
    name: `选择 ${title}`,
    exact: true,
  });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await library
    .getByRole("button", { name: "用此背景创建", exact: true })
    .click();

  await expect(page).toHaveURL(/\/projects\/[^/]+\/edit$/, {
    timeout: 20_000,
  });
  expect(uploads.length).toBe(0);
  expect(creates.length).toBe(1);

  const projectId = new URL(page.url()).pathname.split("/")[2];
  const detail = await (
    await page.request.get(`/api/v1/projects/${projectId}`)
  ).json();
  const catalog = await (
    await page.request.get("/api/v1/catalog/background?page=1&pageSize=24")
  ).json();
  const resource = catalog.resources.find(
    (r: { title: string }) => r.title === title,
  );
  expect(resource).toBeTruthy();
  const doc = JSON.parse(detail.project.document);
  expect(detail.project.title).toBe(title);
  expect(doc.canvas.width).toBe(resource.asset.width);
  expect(doc.canvas.height).toBe(resource.asset.height);
  expect(doc.background.assetId).toBe(resource.asset.id);
  expect(doc.background.version).toBe(resource.asset.version);

  // The returned id opens, and the created work can be re-opened.
  await page.getByRole("link", { name: "返回作品", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(
    page.getByTestId("project-card").filter({ hasText: title }),
  ).toHaveCount(1);
  await page.getByRole("link", { name: `编辑 ${title}`, exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/edit$/);

  await adminContext.close();
});

/**
 * A06.1 / A06.4 / Ruling 66. A create-mode selection is cleared when it
 * changes in the catalog: a filter that hides it, a resource unpublished or
 * revised before confirm, and a failed re-check each keep the filter/page for
 * retry and send zero create requests. The catalog is controlled so 「下架」,
 * 「改版」 and 「复查失败」 can be driven deterministically.
 */
test("create clears a selection that changes in the catalog", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const bg = {
    id: "e2e-res-1",
    kind: "background",
    title: "共享风景",
    sortOrder: 0,
    published: true,
    version: "1",
    asset: {
      id: "e2e-asset-1",
      version: "1",
      kind: "image",
      name: "bg",
      width: 1200,
      height: 800,
      size: "1",
      sha256: "x",
      previewUrl:
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    },
  };
  // The re-check is the only catalog GET fired by a confirm, so a one-shot
  // flag drives just that reply while display/filter loads stay published.
  let recheck: "unpublished" | "revised" | "fail" | null = null;
  await page.route(/\/api\/v1\/catalog\/background(\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const mode = recheck;
    recheck = null;
    if (mode === "fail")
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          code: "RECHECK_FAILED",
          message: "复查失败",
          requestId: "e2e",
        }),
      });
    const keyword =
      new URL(route.request().url()).searchParams.get("keyword") ?? "";
    let resources = [bg].filter(
      (r) => !keyword || r.title.includes(keyword),
    ) as Record<string, unknown>[];
    if (mode === "unpublished") resources = [];
    if (mode === "revised")
      resources = resources.map((r) => ({ ...r, version: "2" }));
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "e2e",
        total: resources.length,
        resources,
      }),
    });
  });

  const creates: string[] = [];
  page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      new URL(req.url()).pathname === "/api/v1/projects"
    )
      creates.push(req.url());
  });

  await account(page, "a06_clear_" + Date.now().toString(36));
  await page.getByRole("button", { name: "新建海报", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "新建海报" })).toBeVisible();
  await page
    .getByRole("dialog", { name: "新建海报" })
    .getByRole("button", { name: "从背景库选择", exact: true })
    .click();
  const library = page.getByRole("dialog", { name: "背景库" });
  const card = () =>
    library.getByRole("button", { name: "选择 共享风景", exact: true });
  const confirmBtn = library.getByRole("button", {
    name: "用此背景创建",
    exact: true,
  });
  const search = library.getByLabel("搜索预设背景", { exact: true });
  const error = () => page.getByTestId("picker-confirm-error");
  await expect(card()).toBeVisible({ timeout: 20_000 });

  // (1) A filter that hides the selected card clears the selection.
  await card().click();
  await expect(card()).toHaveAttribute("aria-pressed", "true");
  await expect(confirmBtn).toBeEnabled();
  await search.fill("nomatch");
  await expect(search).toHaveValue("nomatch");
  await expect(confirmBtn).toBeDisabled();
  await expect(card()).toHaveCount(0);
  await search.fill("");
  await expect(card()).toBeVisible();

  // (2) Unpublished before confirm: clear selection, explain, keep filter,
  // zero creates.
  await card().click();
  recheck = "unpublished";
  await confirmBtn.click();
  await expect(error()).toContainText("已下架");
  await expect(confirmBtn).toBeDisabled();
  await expect(search).toHaveValue("");
  expect(creates.length).toBe(0);

  // (3) Revised before confirm: clear selection, explain, keep filter, zero
  // creates. The card is still visible from the cached catalog, so reselect.
  await card().click();
  recheck = "revised";
  await confirmBtn.click();
  await expect(error()).toContainText("已改版");
  await expect(confirmBtn).toBeDisabled();
  await expect(search).toHaveValue("");
  expect(creates.length).toBe(0);

  // (4) Failed re-check: keep filter/page and selection for retry, zero
  // creates.
  await card().click();
  recheck = "fail";
  await confirmBtn.click();
  await expect(error()).toContainText("复查失败");
  await expect(error()).toContainText("筛选和分页已保留");
  await expect(confirmBtn).toBeEnabled();
  await expect(card()).toHaveAttribute("aria-pressed", "true");
  await expect(search).toHaveValue("");
  expect(creates.length).toBe(0);
});

/**
 * FP-06 / Ruling 64. A background-library create whose outcome cannot be
 * confirmed (server committed, reply dropped as a 5xx) must never be
 * resubmitted; only a read-only list reload is offered and the late-reply /
 * account-scope guards of A05's shared create path apply.
 */
test("background library create with unknown outcome only refreshes the list", async ({
  page,
  browser,
}) => {
  test.setTimeout(150_000);
  const title = "共享风景 " + Date.now().toString(36);
  const adminContext = await publishBackground(browser, title);
  await account(page, "a06_unknown_" + Date.now().toString(36));

  let createPosts = 0;
  await page.route(/\/api\/v1\/projects(\?|$)/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    createPosts += 1;
    await route.fetch(); // server really commits
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        code: "CREATE_UNCONFIRMED",
        message: "创建结果无法确认",
        requestId: "e2e",
      }),
    });
  });

  await page.getByRole("button", { name: "新建海报", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "新建海报" })).toBeVisible();
  await page
    .getByRole("dialog", { name: "新建海报" })
    .getByRole("button", { name: "从背景库选择", exact: true })
    .click();
  const library = page.getByRole("dialog", { name: "背景库" });
  const card = library.getByRole("button", {
    name: `选择 ${title}`,
    exact: true,
  });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.click();
  await library
    .getByRole("button", { name: "用此背景创建", exact: true })
    .click();

  const unknownNotice = () =>
    page.getByTestId("notice").filter({ hasText: "结果未确认" });
  await expect(unknownNotice()).toHaveCount(1);
  await expect(unknownNotice().getByTestId("notice-action")).toHaveText(
    "重新加载作品列表",
  );
  await expect(page).toHaveURL(/\/projects$/);
  expect(createPosts).toBe(1); // no automatic re-submission
  await expect(page.getByTestId("project-card")).toHaveCount(0);

  // The read-only reload reveals the committed work, without another write.
  await unknownNotice().getByTestId("notice-action").click();
  await expect(unknownNotice()).toHaveCount(0);
  await expect(page.getByTestId("project-card")).toHaveCount(1);
  expect(createPosts).toBe(1);

  await adminContext.close();
});
