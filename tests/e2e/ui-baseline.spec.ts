import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { chooseCardAction } from "./helpers";

// Playwright wipes test-results/ before every run, so a before/after comparison
// needs FP_UI_BASELINE_OUT pointed somewhere outside it.
const OUT = process.env.FP_UI_BASELINE_OUT ?? "test-results/ui-baseline";
const capture = process.env.FP_UI_BASELINE === "1";
if (capture) fs.mkdirSync(OUT, { recursive: true });
const describeCapture = capture ? test.describe : test.describe.skip;
const FIXTURE = path.resolve("tests/fixtures/images/editor.png");
const FREEZE =
  "*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}";

async function settle(page: Page) {
  const freeze = await page.addStyleTag({
    content: FREEZE + "html{cursor:default!important}",
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((resolve) => {
              img.onload = img.onerror = resolve;
            }),
        ),
    );
  });
  await page.waitForTimeout(200);
  return freeze;
}

async function shoot(page: Page, name: string) {
  const freeze = await settle(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  // Keep the freeze only for the shot. antd's motion waits for animationend,
  // which `animation:none` never emits, so a lingering copy leaves every
  // later menu stuck at opacity 0 with a zero-sized box.
  await freeze.evaluate((node) => node.remove());
}

async function adminLoginPage(page: Page) {
  await page.goto("http://127.0.0.1:15174/admin/login");
}

async function submitAdminLogin(page: Page) {
  await page.getByLabel("用户名", { exact: true }).fill("admin-e2e");
  await page
    .getByLabel("密码", { exact: true })
    .fill("fastposter-test-only-password");
  await page.getByRole("button", { name: "登录管理后台", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/overview$/);
}

async function loginAdmin(page: Page) {
  await adminLoginPage(page);
  await submitAdminLogin(page);
}

async function createCategory(admin: Page, title: string) {
  const response = await admin.request.post(
    "http://127.0.0.1:15174/api/v1/admin/resources",
    { data: { kind: "copy-category", title, published: true } },
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()).resource.id as string;
}

async function createCopy(
  admin: Page,
  input: { title: string; body: string; categoryId: string },
) {
  const response = await admin.request.post(
    "http://127.0.0.1:15174/api/v1/admin/resources",
    { data: { kind: "copy", ...input, published: true } },
  );
  expect(response.ok()).toBeTruthy();
}

describeCapture("desktop 1440x1000", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("seed shared data and capture the user app", async ({
    browser,
    page,
  }) => {
    test.setTimeout(420_000);
    const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const admin = await adminContext.newPage();
    await adminLoginPage(admin);
    await shoot(admin, "d-07-admin-login");
    await submitAdminLogin(admin);

    await admin.getByRole("link", { name: "背景库", exact: true }).click();
    await admin.getByRole("button", { name: "添加背景", exact: true }).click();
    await admin.getByLabel("素材名称", { exact: true }).fill("共享风景");
    await admin
      .getByLabel("背景图片文件", { exact: true })
      .setInputFiles(FIXTURE);
    await admin.getByLabel("立即发布", { exact: true }).check();
    await admin.getByRole("button", { name: "保存素材", exact: true }).click();
    await expect(
      admin.getByTestId("resource-card").filter({ hasText: "共享风景" }),
    ).toBeVisible();

    const category = await createCategory(admin, "旅行的意义");
    await createCopy(admin, {
      title: "山海之间",
      body: "心之所向，是山海之间。",
      categoryId: category,
    });
    await createCopy(admin, {
      title: "春日来信",
      body: "把春天折进信里，寄给路过的风。",
      categoryId: category,
    });

    await admin.getByRole("link", { name: "模板", exact: true }).click();
    await admin.getByRole("button", { name: "新建模板", exact: true }).click();
    const templateEditor = admin.getByRole("dialog", { name: "模板编辑器" });
    await templateEditor
      .getByLabel("模板背景图片文件", { exact: true })
      .setInputFiles(FIXTURE);
    await expect(
      templateEditor.getByRole("button", { name: "添加文字", exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await templateEditor
      .getByLabel("模板名称", { exact: true })
      .fill("夏日特惠");
    await templateEditor
      .getByRole("button", { name: "添加文字", exact: true })
      .click();
    await templateEditor
      .getByRole("button", { name: "编辑文字", exact: true })
      .click();
    await templateEditor
      .getByRole("textbox", { name: "海报文字编辑" })
      .fill("夏日特惠");
    await templateEditor
      .getByRole("button", { name: "完成文字编辑", exact: true })
      .click();
    await templateEditor.getByLabel("发布模板", { exact: true }).check();
    await expect(
      templateEditor.getByRole("button", { name: "保存模板", exact: true }),
    ).toBeEnabled({ timeout: 20_000 });
    await templateEditor
      .getByRole("button", { name: "保存模板", exact: true })
      .click();
    await expect(
      admin.getByTestId("template-card").filter({ hasText: "夏日特惠" }),
    ).toBeVisible();

    await admin.goto("http://127.0.0.1:15174/admin/backgrounds");
    await admin.getByRole("button", { name: "添加背景", exact: true }).click();
    await admin.getByLabel("素材名称", { exact: true }).fill("晨雾山谷");
    await shoot(admin, "d-08-admin-background-form");
    await adminContext.close();

    // Shared backgrounds must be visible to the user, so capture the user app
    // after the admin context is closed.
    await page.goto("/login");
    await shoot(page, "d-01-login");

    await page.goto("/register");
    await page.getByLabel("用户名", { exact: true }).fill("ui_baseline");
    await page
      .getByLabel("密码", { exact: true })
      .fill("a secure test password");
    await page.getByRole("button", { name: "创建账号", exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel("用户名", { exact: true }).fill("ui_baseline");
    await page
      .getByLabel("密码", { exact: true })
      .fill("a secure test password");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page).toHaveURL(/\/projects$/);

    await page.getByLabel("导入背景图文件").setInputFiles(FIXTURE);
    await expect(page).toHaveURL(/\/projects\/[^/]+\/edit/);
    await page.getByRole("link", { name: "返回作品", exact: true }).click();
    await expect(page.getByTestId("project-card")).toHaveCount(1);
    await chooseCardAction(page, page.getByLabel("editor 的操作"), "重命名");
    await page.getByLabel("作品名称").fill("旅行日记");
    await page.getByRole("button", { name: "保存名称", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "旅行日记", exact: true }),
    ).toBeVisible();
    await chooseCardAction(
      page,
      page.getByLabel("旅行日记 的操作"),
      "复制作品",
    );
    await expect(page.getByTestId("project-card")).toHaveCount(2);
    await chooseCardAction(
      page,
      page.getByLabel("旅行日记 副本 的操作"),
      "重命名",
    );
    await page.getByLabel("作品名称").fill("春日明信片");
    await page.getByRole("button", { name: "保存名称", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "春日明信片", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("project-card")).toHaveCount(2);
    await shoot(page, "d-02-projects");

    await page.getByRole("button", { name: "模板库", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "模板库" })).toBeVisible();
    await shoot(page, "d-03-template-picker");
    await page.getByRole("textbox", { name: "搜索模板" }).focus();
    await shoot(page, "d-09-template-search-focus");
    await page.getByRole("button", { name: "关闭", exact: true }).click();

    await page
      .getByRole("link", { name: "编辑 春日明信片", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "添加文字", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "添加文字", exact: true }).click();
    await page.getByRole("button", { name: "编辑文字", exact: true }).click();
    const input = page.getByRole("textbox", { name: "海报文字编辑" });
    await input.fill("你好风景世界");
    for (let i = 0; i < 4; i++) await input.press("ArrowLeft");
    await input.press("Shift+ArrowRight");
    await input.press("Shift+ArrowRight");
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toBe("风景");
    await shoot(page, "d-04-editor-panel");

    const font = page.getByLabel("文字字体", { exact: true });
    await font.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await font.fill("文楷");
    await page
      .getByRole("listbox")
      .getByRole("option", { name: "霞鹜文楷", exact: true })
      .hover();
    await expect(page.locator("[data-fp-font-preview]")).toContainText(
      "霞鹜文楷",
    );
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.fonts.check('16px "fp_builtin-lxgw-wenkai-400"', "海报"),
        ),
      )
      .toBe(true);
    await shoot(page, "d-10-font-menu-preview");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);

    await font.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    const interOption = page
      .getByRole("listbox")
      .getByRole("option", { name: "Inter", exact: true });
    await expect(interOption).toBeDisabled();
    await interOption.scrollIntoViewIfNeeded();
    await shoot(page, "d-11-font-unavailable");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);

    await page.getByRole("button", { name: "背景库", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "背景库" })).toBeVisible();
    await shoot(page, "d-05-background-picker");
    await page.getByRole("button", { name: "关闭", exact: true }).click();

    await page.getByRole("button", { name: "文案", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "文案库" })).toBeVisible();
    await shoot(page, "d-06-copy-picker");
    await page.getByRole("button", { name: "关闭", exact: true }).click();
  });
});

describeCapture("mobile 390x844", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  test("capture the same pages on a phone viewport", async ({
    browser,
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto("/login");
    await shoot(page, "m-01-login");
    await page.getByLabel("用户名", { exact: true }).fill("ui_baseline");
    await page
      .getByLabel("密码", { exact: true })
      .fill("a secure test password");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByTestId("project-card")).toHaveCount(2);
    await shoot(page, "m-02-projects");

    await page.getByRole("button", { name: "模板库", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "模板库" })).toBeVisible();
    await shoot(page, "m-03-template-picker");
    await page.getByRole("textbox", { name: "搜索模板" }).focus();
    await shoot(page, "m-09-template-search-focus");
    await page.getByRole("button", { name: "关闭", exact: true }).click();

    await page
      .getByRole("link", { name: "编辑 春日明信片", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "添加文字", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "添加文字", exact: true }).click();
    await page.getByRole("button", { name: "编辑文字", exact: true }).click();
    const input = page.getByRole("textbox", { name: "海报文字编辑" });
    await input.fill("你好风景世界");
    for (let i = 0; i < 4; i++) await input.press("ArrowLeft");
    await input.press("Shift+ArrowRight");
    await input.press("Shift+ArrowRight");
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toBe("风景");
    await shoot(page, "m-04-editor");
    await page.getByRole("button", { name: "文字设置", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "文字设置" })).toBeVisible();
    await shoot(page, "m-05-editor-sheet");

    const font = page.getByLabel("文字字体", { exact: true });
    await font.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await font.fill("文楷");
    await page
      .getByRole("listbox")
      .getByRole("option", { name: "霞鹜文楷", exact: true })
      .hover();
    await expect(page.locator("[data-fp-font-preview]")).toContainText(
      "霞鹜文楷",
    );
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.fonts.check('16px "fp_builtin-lxgw-wenkai-400"', "海报"),
        ),
      )
      .toBe(true);
    await shoot(page, "m-10-font-menu-preview");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);

    await font.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    const interOption = page
      .getByRole("listbox")
      .getByRole("option", { name: "Inter", exact: true });
    await expect(interOption).toBeDisabled();
    await interOption.scrollIntoViewIfNeeded();
    await shoot(page, "m-11-font-unavailable");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);

    await page.getByRole("button", { name: "关闭", exact: true }).click();
    await page
      .getByRole("button", { name: "完成文字编辑", exact: true })
      .click();

    await page.getByRole("button", { name: "背景库", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "背景库" })).toBeVisible();
    await shoot(page, "m-06-background-picker");
    await page.getByRole("button", { name: "关闭", exact: true }).click();

    await page.getByRole("button", { name: "文案", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "文案库" })).toBeVisible();
    await shoot(page, "m-07-copy-picker");
    await page.getByRole("button", { name: "关闭", exact: true }).click();

    const adminContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const admin = await adminContext.newPage();
    await loginAdmin(admin);
    /* The phone layout hides the sidebar; the same links live in the drawer. */
    await admin.getByRole("button", { name: "导航菜单", exact: true }).click();
    await admin.getByRole("link", { name: "背景库", exact: true }).click();
    await admin.getByRole("button", { name: "添加背景", exact: true }).click();
    await admin.getByLabel("素材名称", { exact: true }).fill("晨雾山谷");
    await shoot(admin, "m-08-admin-background-form");
    await adminContext.close();
  });
});
