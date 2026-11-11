import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import {
  chooseOption,
  openPoster,
  selectTrigger,
  selectValue,
  setColor,
  showOpenOptions,
} from "./helpers";

async function loginAdmin(page: Page) {
  await page.goto("http://127.0.0.1:15174/admin/login");
  await page.getByLabel("用户名", { exact: true }).fill("admin-e2e");
  await page
    .getByLabel("密码", { exact: true })
    .fill("fastposter-test-only-password");
  await page.getByRole("button", { name: "登录管理后台", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/overview$/);
}

async function createCategory(admin: Page, title: string, parentId?: string) {
  const response = await admin.request.post(
    "http://127.0.0.1:15174/api/v1/admin/resources",
    { data: { kind: "copy-category", title, parentId, published: true } },
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()).resource.id as string;
}

async function createCopy(
  admin: Page,
  input: {
    title: string;
    body: string;
    categoryId: string;
    published: boolean;
  },
) {
  const response = await admin.request.post(
    "http://127.0.0.1:15174/api/v1/admin/resources",
    { data: { kind: "copy", ...input } },
  );
  expect(response.ok()).toBeTruthy();
}

test("administrator maintains a five-level copy tree; users cascade, search, insert and replace with one-step undo", async ({
  browser,
  page,
}) => {
  test.setTimeout(180_000);
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await loginAdmin(admin);
  const level1 = await createCategory(admin, "季节主题");
  const level2 = await createCategory(admin, "秋季场景", level1);
  const level3 = await createCategory(admin, "促销风格", level2);
  const level4 = await createCategory(admin, "正式语气", level3);
  const level5 = await createCategory(admin, "门店落款", level4);
  await createCopy(admin, {
    title: "夏日回顾",
    body: "夏日回顾，清爽一夏。",
    categoryId: level5,
    published: true,
  });
  await createCopy(admin, {
    title: "隐藏文案",
    body: "这条文案不应出现。",
    categoryId: level5,
    published: false,
  });
  const pagedCategory = await createCategory(admin, "分页文案");
  for (let i = 1; i <= 55; i++)
    await createCopy(admin, {
      title: `分页文案 ${String(i).padStart(2, "0")}`,
      body: `分页内容 ${i}`,
      categoryId: pagedCategory,
      published: true,
    });

  await admin.getByRole("link", { name: "文案库", exact: true }).click();
  await expect(admin).toHaveURL(/\/admin\/copy$/);
  await expect(admin.getByText("门店落款", { exact: true })).toBeVisible();
  await admin.getByRole("button", { name: "新建文案", exact: true }).click();
  const form = admin.getByRole("dialog", { name: "新建文案" });
  await form.getByLabel("文案标题", { exact: true }).fill("秋季上新");
  await form
    .getByLabel("文案正文", { exact: true })
    .fill("秋季上新，限时八折。");
  await chooseOption(admin, "文案分类", "门店落款");
  await form.getByLabel("发布文案", { exact: true }).check();
  await form.getByRole("button", { name: "保存文案", exact: true }).click();
  const created = admin
    .getByTestId("copy-card")
    .filter({ hasText: "秋季上新" });
  await expect(created).toBeVisible();
  await expect(created.getByText("已发布", { exact: true })).toBeVisible();
  await admin.getByLabel("搜索文案", { exact: true }).fill("秋季");
  await expect(admin.getByTestId("copy-card")).toHaveCount(1);
  await admin.getByLabel("搜索文案", { exact: true }).fill("");

  await page.goto("/register");
  const name = "copy_user_" + Date.now().toString(36);
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page
    .getByLabel("导入背景图文件")
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await expect(page).toHaveURL(/\/edit$/);
  await expect(
    page.getByRole("button", { name: "文案", exact: true }),
  ).toBeEnabled({ timeout: 15_000 });

  await page.getByRole("button", { name: "文案", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "文案库" });
  await chooseOption(page, "文案分类第1级", "季节主题");
  await chooseOption(page, "文案分类第2级", "秋季场景");
  await chooseOption(page, "文案分类第3级", "促销风格");
  await chooseOption(page, "文案分类第4级", "正式语气");
  await expect(picker.getByText("该分类暂无已发布文案。")).toBeVisible();
  await chooseOption(page, "文案分类第5级", "门店落款");
  await expect(picker.getByText("夏日回顾", { exact: true })).toBeVisible();

  await chooseOption(page, "文案分类第1级", "分页文案");
  await expect(picker.getByLabel("文案分类第2级", { exact: true })).toHaveCount(
    0,
  );
  await chooseOption(page, "文案分类第1级", "季节主题");
  await expect(selectValue(page, "文案分类第2级")).toHaveText("第 2 级分类");
  await expect(picker.getByLabel("文案分类第3级", { exact: true })).toHaveCount(
    0,
  );
  await chooseOption(page, "文案分类第2级", "秋季场景");
  await expect(selectValue(page, "文案分类第3级")).toHaveText("第 3 级分类");

  await chooseOption(page, "文案分类第1级", "全部分类");
  await expect(selectTrigger(page, "文案分类第1级")).toHaveCount(1);
  await picker.getByLabel("搜索文案", { exact: true }).fill("夏日回顾");
  await expect(
    picker.getByRole("button", { name: "使用文案 夏日回顾", exact: true }),
  ).toBeVisible();
  await picker.getByLabel("搜索文案", { exact: true }).fill("");
  await picker.getByLabel("搜索文案", { exact: true }).fill("秋季");
  await expect(
    picker.getByRole("button", { name: "使用文案 秋季上新", exact: true }),
  ).toBeVisible();
  await expect(
    picker.getByRole("button", { name: "使用文案 夏日回顾", exact: true }),
  ).toHaveCount(0);
  await picker.getByLabel("搜索文案", { exact: true }).fill("隐藏");
  await expect(
    picker.getByText("暂无已发布文案。", { exact: true }),
  ).toBeVisible();
  await picker.getByLabel("搜索文案", { exact: true }).fill("");
  await picker
    .getByRole("button", { name: "使用文案 秋季上新", exact: true })
    .click();
  await expect(picker).toHaveCount(0);
  const block = page.locator("[data-text-block]");
  await expect(block).toHaveCount(1);
  await expect(block).toHaveText("秋季上新，限时八折。");

  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = page.getByRole("textbox", { name: "海报文字编辑" });
  await input.fill("前半后半");
  for (let i = 0; i < 2; i++) await input.press("ArrowLeft");
  for (let i = 0; i < 2; i++) await input.press("Shift+ArrowLeft");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("前半");
  await page.getByLabel("文字字号", { exact: true }).fill("80");
  await setColor(page, "文字颜色", "ff0000");
  await expect(input.getByText("前半", { exact: true })).toHaveCSS(
    "font-size",
    "80px",
  );
  const unstyled = await input.evaluate((root) => {
    const sizes: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode())
      if (node.textContent && "后半".includes(node.textContent))
        sizes.push(getComputedStyle(node.parentElement!).fontSize);
    return sizes;
  });
  expect(unstyled.length).toBeGreaterThan(0);
  expect(unstyled.every((size) => size === "64px")).toBeTruthy();
  await input.press("Meta+a");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("前半后半");

  await page.getByRole("button", { name: "文案", exact: true }).click();
  const replacePicker = page.getByRole("dialog", { name: "文案库" });
  await replacePicker.getByLabel("搜索文案", { exact: true }).fill("夏日回顾");
  await replacePicker
    .getByRole("button", { name: "使用文案 夏日回顾", exact: true })
    .click();
  await expect(replacePicker).toHaveCount(0);
  await expect(input).toHaveText("夏日回顾，清爽一夏。");
  await expect(
    input.getByText("夏日回顾，清爽一夏。", { exact: true }),
  ).toHaveCSS("font-size", "80px");
  await expect(
    input.getByText("夏日回顾，清爽一夏。", { exact: true }),
  ).toHaveCSS("color", "rgb(255, 0, 0)");
  await expect(block).toHaveCount(1);

  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(block).toHaveText("前半后半");
  await expect(block.getByText("前半", { exact: true })).toHaveCSS(
    "font-size",
    "80px",
  );
  await page.getByRole("button", { name: "保存作品", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "文案", exact: true }).click();
  const paged = page.getByRole("dialog", { name: "文案库" });
  await chooseOption(page, "文案分类第1级", "分页文案");
  await expect(
    paged.getByRole("button", { name: /使用文案 分页文案/ }),
  ).toHaveCount(50);
  await expect(
    paged.getByRole("button", { name: "下一页", exact: true }),
  ).toBeEnabled();
  await paged.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(
    paged.getByRole("button", { name: /使用文案 分页文案/ }),
  ).toHaveCount(5);
  await expect(
    paged.getByRole("button", { name: "下一页", exact: true }),
  ).toBeDisabled();
  await paged.getByRole("button", { name: "关闭", exact: true }).click();
  await adminContext.close();
});

/* FP-09 / A08.1. The admin copy list shares the 25 -> 24 shrink path and has
   no pageAfterShrink on the baseline (empty-state lock-up). The publish toggle
   is the list action that triggers the refetch; the controlled responses model
   a real 25 -> 24 shrink. PNG-safe. */
test("copy list returns to the previous page after its last row disappears", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await loginAdmin(admin);
  try {
    const listPath = "/api/v1/admin/resources/copy";
    const row = (n: number) => ({
      id: `a08-copy-${n}`,
      kind: "copy",
      title: `文案 ${String(n).padStart(2, "0")}`,
      body: `文案内容 ${n}`,
      categoryId: "",
      sortOrder: n,
      published: true,
      version: "1",
    });
    const firstPage = Array.from({ length: 24 }, (_, i) => row(i + 1));
    let shrunk = false;
    await admin.route(/\/api\/v1\/admin\/resources\/copy\?/, async (route) => {
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
    });
    // The publish toggle (AdminSaveResource POST) is the action that triggers
    // the copies refetch; it models the shrink without a copy delete endpoint.
    await admin.route(/\/api\/v1\/admin\/resources$/, (route) => {
      shrunk = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ requestId: "e2e-a08", resource: row(25) }),
      });
    });

    const listPages: string[] = [];
    admin.on("request", (req) => {
      const u = new URL(req.url());
      if (req.method() === "GET" && u.pathname === listPath)
        listPages.push(u.searchParams.get("page") ?? "1");
    });

    await admin.getByRole("link", { name: "文案库", exact: true }).click();
    await expect(admin.getByTestId("copy-card")).toHaveCount(24);
    await admin.getByRole("button", { name: "下一页", exact: true }).click();
    await expect(admin.getByTestId("copy-card")).toHaveCount(1);
    const last = admin.getByTestId("copy-card").filter({ hasText: "文案 25" });
    await expect(last).toBeVisible();

    listPages.length = 0;
    await last.getByRole("button", { name: "下架", exact: true }).click();

    await expect.poll(() => listPages.includes("1")).toBe(true);
    expect(listPages).toContain("2");
    await expect(admin.getByTestId("copy-card")).toHaveCount(24);
    await expect(
      admin.getByRole("button", { name: "下一页", exact: true }),
    ).toHaveCount(0);
    await expect(admin.getByText("还没有文案")).toHaveCount(0);
  } finally {
    await adminContext.close();
  }
});

/* FP-10 / A09.1. A complete catalog read must see past the 100th record and
   still assemble a cross-page parent/child pair. The two synthetic pages are
   keyed on searchParams("page"); the request sequence is asserted. */
test("catalog includes category 101 and cross-page ancestry", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await loginAdmin(admin);
  try {
    const first = Array.from({ length: 100 }, (_, i) => ({
      id: `a09-cat-${String(i).padStart(3, "0")}`,
      kind: "copy-category",
      title: `分页分类 ${String(i).padStart(3, "0")}`,
      sortOrder: i,
      published: true,
      version: "1",
    }));
    const parentId = first[0].id;
    const child = {
      id: "a09-cat-100",
      kind: "copy-category",
      title: "第 101 条跨页子分类",
      sortOrder: 100,
      published: true,
      version: "1",
      parentId,
    };
    const seen: string[] = [];
    const categoryBody = (resources: unknown[]) =>
      JSON.stringify({ requestId: "e2e-a09", resources, total: 101 });
    await admin.route(
      /\/api\/v1\/admin\/resources\/copy-category\?/,
      (route) => {
        const url = new URL(route.request().url());
        const p = url.searchParams.get("page") ?? "1";
        seen.push(`${p}:${url.searchParams.get("pageSize") ?? ""}`);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: categoryBody(p === "1" ? first : [child]),
        });
      },
    );
    await admin.route(/\/api\/v1\/admin\/resources\/copy\?/, (route) =>
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
    await admin.getByRole("link", { name: "文案库", exact: true }).click();
    await expect(admin).toHaveURL(/\/admin\/copy$/);
    // Exact request sequence: page 1 then page 2, both pageSize 100.
    await expect.poll(() => seen.join("|")).toBe("1:100|2:100");
    // The 101st record is in the tree and its cross-page parent is present.
    await expect(
      admin.getByText("第 101 条跨页子分类", { exact: true }),
    ).toBeVisible();
    await expect(
      admin.getByText("分页分类 000", { exact: true }),
    ).toBeVisible();
  } finally {
    await adminContext.close();
  }
});

/* FP-10 / A09.1 / Ruling 136. Prefer the real API: an unpublished parent with
   a published child. The server filters by each category's own published flag,
   so the parent is absent from the public catalog; the child must still be a
   selectable top-level entry carrying its visible descendants. */
test("published copy child without visible parent remains selectable", async ({
  browser,
  page,
}) => {
  test.setTimeout(150_000);
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await loginAdmin(admin);
  const stamp = Date.now().toString(36);
  const parentTitle = `未发布父级 ${stamp}`;
  const childTitle = `可见子级 ${stamp}`;
  const grandTitle = `可见孙级 ${stamp}`;
  const post = (data: Record<string, unknown>) =>
    admin.request.post("http://127.0.0.1:15174/api/v1/admin/resources", {
      data,
    });
  const parentResponse = await post({
    kind: "copy-category",
    title: parentTitle,
    published: false,
  });
  expect(parentResponse.ok()).toBeTruthy();
  const parentId = (await parentResponse.json()).resource.id as string;
  const childResponse = await post({
    kind: "copy-category",
    title: childTitle,
    parentId,
    published: true,
  });
  expect(childResponse.ok()).toBeTruthy();
  const childId = (await childResponse.json()).resource.id as string;
  const grandResponse = await post({
    kind: "copy-category",
    title: grandTitle,
    parentId: childId,
    published: true,
  });
  expect(grandResponse.ok()).toBeTruthy();
  // A published root keeps the level-1 dropdown present on BOTH baseline and
  // fixed code, so the orphaned-child assertion is a real product outcome,
  // not a missing-selector timeout.
  const anchorTitle = `可见根级 ${stamp}`;
  const anchorResponse = await post({
    kind: "copy-category",
    title: anchorTitle,
    published: true,
  });
  expect(anchorResponse.ok()).toBeTruthy();

  const copyQueries: string[] = [];
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (req.method() === "GET" && u.pathname === "/api/v1/catalog/copy")
      copyQueries.push(u.searchParams.get("categoryId") ?? "");
  });

  await openPoster(page, "a09_orphan");
  const copyButton = page.getByRole("button", { name: "文案", exact: true });
  await expect(copyButton).toBeEnabled({ timeout: 15_000 });
  await copyButton.click();
  const picker = page.getByRole("dialog", { name: "文案库" });
  await expect(picker).toBeVisible();

  const listbox = await showOpenOptions(page, "文案分类第1级");
  await expect(
    listbox.getByRole("option", { name: anchorTitle, exact: true }),
  ).toBeVisible();
  // The published child whose parent is invisible is a selectable root.
  await expect(
    listbox.getByRole("option", { name: childTitle, exact: true }),
  ).toBeVisible();
  await expect(
    listbox.getByRole("option", { name: parentTitle, exact: true }),
  ).toHaveCount(0);
  await listbox.getByRole("option", { name: childTitle, exact: true }).click();
  // antd keeps a closed dropdown mounted through its exit animation; wait for
  // it to leave so getByRole('listbox') resolves to a single element again.
  await expect(page.getByRole("listbox")).toHaveCount(0);

  // The real category id (not a synthetic one) drives the copy query.
  await expect.poll(() => copyQueries.includes(childId)).toBe(true);
  // Its published descendant is carried along as the next level.
  const level2 = await showOpenOptions(page, "文案分类第2级");
  await expect(
    level2.getByRole("option", { name: grandTitle, exact: true }),
  ).toBeVisible();
  await adminContext.close();
});

/* B01 / Ruling 191. Renaming a category AND re-parenting it in one edit must
   be a single atomic AdminSaveResource request (carrying parentId and the
   snapshot version), never a move + save two-request chain. */
test("category rename plus move sends exactly one atomic save", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await loginAdmin(admin);
  try {
    const rootA = await createCategory(admin, "根A");
    const rootB = await createCategory(admin, "根B");
    await createCategory(admin, "子分类", rootA);

    let saveCount = 0;
    let moveCount = 0;
    admin.on("request", (req) => {
      const u = new URL(req.url());
      if (req.method() === "POST" && u.pathname === "/api/v1/admin/resources")
        saveCount++;
      if (req.method() === "POST" && u.pathname.endsWith("/move")) moveCount++;
    });

    await admin.getByRole("link", { name: "文案库", exact: true }).click();
    await expect(admin).toHaveURL(/\/admin\/copy$/);
    await expect(
      admin.getByLabel("编辑分类 子分类", { exact: true }),
    ).toBeVisible();
    await admin.getByLabel("编辑分类 子分类", { exact: true }).click();
    const form = admin.getByRole("dialog", { name: "编辑分类" });
    await form.getByLabel("分类名称", { exact: true }).fill("子分类改名");
    await chooseOption(admin, "上级分类", "根B");

    saveCount = 0;
    moveCount = 0;
    await form.getByRole("button", { name: "保存分类", exact: true }).click();
    await expect.poll(() => saveCount).toBe(1);
    expect(moveCount).toBe(0);
    expect(saveCount).toBe(1);
  } finally {
    await adminContext.close();
  }
});
