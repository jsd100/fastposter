import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { chooseOption, selectTrigger, selectValue, setColor } from "./helpers";

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
