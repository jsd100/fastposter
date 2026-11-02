import { test, expect, type Page } from "@playwright/test";
import {
  chooseOption,
  openPoster,
  selectTrigger,
  selectValue,
} from "./helpers";

const password = "a secure test password";

async function account(page: Page, name: string) {
  await page.goto("/register");
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
}

test("password form submits explicitly and secondary actions do not submit", async ({
  page,
}) => {
  const name = "ui_controls_" + Date.now().toString(36);
  let passwordRequests = 0;
  await page.route("**/api/v1/auth/password", async (route) => {
    passwordRequests += 1;
    await route.continue();
  });
  await account(page, name);

  await page.goto("/password");
  await expect(page.getByRole("heading", { name: "修改密码" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "更新密码", exact: true }),
  ).toHaveAttribute("type", "submit");

  await page.getByRole("link", { name: "返回作品" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  expect(passwordRequests).toBe(0);

  await page.goto("/password");
  await page
    .getByLabel("当前密码", { exact: true })
    .fill("not the current password");
  await page
    .getByLabel("新密码", { exact: true })
    .fill("a brand new test password");
  await page.getByRole("button", { name: "更新密码", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("当前密码不正确");
  await expect(page).toHaveURL(/\/password$/);
  expect(passwordRequests).toBe(1);

  await page.getByLabel("当前密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "更新密码", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(passwordRequests).toBe(2);

  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page
    .getByLabel("密码", { exact: true })
    .fill("a brand new test password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
});

test("catalog selects support keyboard selection and Escape", async ({
  browser,
  page,
}) => {
  test.setTimeout(180_000);
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

  async function createCategory(title: string) {
    const response = await admin.request.post(
      "http://127.0.0.1:15174/api/v1/admin/resources",
      { data: { kind: "copy-category", title, published: true } },
    );
    expect(response.ok()).toBeTruthy();
    return (await response.json()).resource.id as string;
  }
  async function createCopy(title: string, categoryId: string) {
    const response = await admin.request.post(
      "http://127.0.0.1:15174/api/v1/admin/resources",
      {
        data: {
          kind: "copy",
          title,
          body: `${title}的正文内容。`,
          categoryId,
          published: true,
        },
      },
    );
    expect(response.ok()).toBeTruthy();
  }
  const keyboard = await createCategory("键盘可选分类");
  const other = await createCategory("另一分类");
  const longNames: string[] = [];
  for (let index = 1; index <= 25; index++) {
    const title = `超长文案分类名称用于验证触发器文本截断与下拉菜单滚动效果第二十五组序号${index}号`;
    longNames.push(title);
    await createCategory(title);
  }
  await createCopy("键盘文案", keyboard);
  await createCopy("另一文案", other);

  await page.setViewportSize({ width: 430, height: 900 });
  await openPoster(page, "ui_selects");
  await page.getByRole("button", { name: "文案", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "文案库" });
  const first = selectTrigger(page, "文案分类第1级");
  await expect(selectValue(page, "文案分类第1级")).toHaveText("全部分类");
  await expect(
    picker.getByRole("button", { name: "使用文案 键盘文案", exact: true }),
  ).toBeVisible();
  await expect(
    picker.getByRole("button", { name: "使用文案 另一文案", exact: true }),
  ).toBeVisible();

  await chooseOption(page, "文案分类第1级", "键盘可选分类");
  await expect(
    picker.getByRole("button", { name: "使用文案 键盘文案", exact: true }),
  ).toBeVisible();
  await expect(
    picker.getByRole("button", { name: "使用文案 另一文案", exact: true }),
  ).toHaveCount(0);
  await chooseOption(page, "文案分类第1级", "全部分类");
  await expect(
    picker.getByRole("button", { name: "使用文案 另一文案", exact: true }),
  ).toBeVisible();

  const last = longNames[longNames.length - 1];
  await chooseOption(page, "文案分类第1级", last);
  const truncation = await selectValue(page, "文案分类第1级").evaluate(
    (el) => ({
      clipped: el.scrollWidth > el.clientWidth,
      overflow: getComputedStyle(el).textOverflow,
    }),
  );
  expect(truncation.clipped).toBeTruthy();
  expect(truncation.overflow).toBe("ellipsis");
  await chooseOption(page, "文案分类第1级", "全部分类");

  await first.click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  const scrollable = await listbox.evaluate(
    (el) => el.scrollHeight > el.clientHeight,
  );
  expect(scrollable).toBeTruthy();
  const highlighted = listbox.locator("[data-highlighted]");
  await expect(highlighted).toHaveText("全部分类");
  await highlighted.press("ArrowDown");
  await expect(highlighted).not.toHaveText("全部分类");
  const moved = (await highlighted.innerText()).trim();
  await highlighted.press("Enter");
  await expect(listbox).toHaveCount(0);
  const afterEnter = await selectValue(page, "文案分类第1级").innerText();
  expect(afterEnter).toBe(moved);

  await first.click();
  await expect(listbox).toBeVisible();
  const reopenActive = listbox.locator("[data-highlighted]");
  await expect(reopenActive).toHaveText(afterEnter);
  await reopenActive.press("ArrowDown");
  await expect(reopenActive).not.toHaveText(afterEnter);
  await reopenActive.press("Escape");
  await expect(listbox).toHaveCount(0);
  await expect(selectValue(page, "文案分类第1级")).toHaveText(afterEnter);
  await adminContext.close();
});

test("editor number fields keep drafts, bounds and Escape without touching the document", async ({
  page,
}) => {
  await openPoster(page, "ui_numbers");
  const block = page.locator("[data-text-block]").first();
  const spacing = page.getByLabel("文字字距", { exact: true });

  await spacing.fill("12");
  await expect(block).toHaveCSS("letter-spacing", "12px");
  await spacing.fill("");
  await expect(block).toHaveCSS("letter-spacing", "12px");
  await spacing.blur();
  await expect(spacing).toHaveValue("12");
  await expect(block).toHaveCSS("letter-spacing", "12px");

  await spacing.fill("-2.5");
  await expect(block).toHaveCSS("letter-spacing", "-2.5px");

  await spacing.fill("40");
  await expect(block).toHaveCSS("letter-spacing", "40px");
  await spacing.press("Escape");
  await expect(spacing).toHaveValue("-2.5");
  await expect(block).toHaveCSS("letter-spacing", "-2.5px");

  const size = page.getByLabel("文字字号", { exact: true });
  await size.fill("4097");
  await expect(size).toHaveValue("4097");
  await expect(block).toHaveCSS("font-size", "64px");
  await size.blur();
  await expect(size).toHaveValue("64");

  const font = selectTrigger(page, "文字字体");
  await font.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page.locator("[data-text-block]")).toHaveCount(1);
  await font.click();
  await page.keyboard.press("Delete");
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(page.locator("[data-text-block]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);

  await page.getByRole("button", { name: "撤销", exact: true }).click();
  const shown = await spacing.inputValue();
  await expect(block).toHaveCSS("letter-spacing", `${shown}px`);

  await page.getByRole("button", { name: "添加文字", exact: true }).click();
  const second = page.locator("[data-text-block]").nth(1);
  await expect(spacing).toHaveValue("0");
  await spacing.fill("9");
  await expect(second).toHaveCSS("letter-spacing", "9px");
  await expect(block).toHaveCSS("letter-spacing", `${shown}px`);
});

test("the select trigger keeps the native control's ink and insets", async ({
  page,
}) => {
  await openPoster(page, "ui_caret");
  const trigger = selectTrigger(page, "文字字体");
  const caret = trigger.locator("svg");
  await expect(caret).toHaveCSS(
    "color",
    await trigger.evaluate((el) => getComputedStyle(el).color),
  );

  // The native arrow hugged the control's right border; the component must not
  // push it into the field's padding.
  const box = (await trigger.boundingBox())!;
  const ink = (await caret.boundingBox())!;
  expect(box.x + box.width - (ink.x + ink.width)).toBeLessThanOrEqual(4);

  // A native menulist indented its value past the author padding, and every
  // field next to it was laid out against that.
  const textLeft = await trigger.evaluate((el) => {
    const value = el.querySelector("[data-fp-select-value]")!;
    const range = document.createRange();
    range.selectNodeContents(value);
    return range.getBoundingClientRect().left;
  });
  expect(Math.round(textLeft - box.x)).toBeGreaterThanOrEqual(13);
});

test("select inside the template dialog closes before its parent and restores focus", async ({
  page,
}) => {
  await account(page, "ui_dialog_nested_" + Date.now().toString(36));
  const opener = page.getByRole("button", { name: "模板库", exact: true });
  await opener.click();
  const picker = page.getByRole("dialog", { name: "模板库" });
  await expect(picker).toBeVisible();

  const trigger = selectTrigger(page, "模板分类");
  await trigger.click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  await expect(picker.locator("[data-fp-popup]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(listbox).toHaveCount(0);
  await expect(picker).toBeVisible();
  await expect(trigger).toBeFocused();

  await chooseOption(page, "模板分类", "全部分类");
  await expect(picker).toBeVisible();
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("modal dialog traps focus, locks page scroll and restores both after closing", async ({
  page,
}) => {
  await account(page, "ui_dialog_trap_" + Date.now().toString(36));
  await page.setViewportSize({ width: 430, height: 900 });
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.id = "scroll-spacer";
    spacer.style.height = "3000px";
    document.body.append(spacer);
  });
  const opener = page.getByRole("button", { name: "模板库", exact: true });
  await opener.click();
  const picker = page.getByRole("dialog", { name: "模板库" });
  await expect(picker).toBeVisible();

  const placed = (await picker.boundingBox())!;
  // The authored width is 100vw - 28px, but a modal keeps the gutter the browser
  // used to clamp dialogs to, so the narrower of the two wins.
  expect(Math.round(placed.width)).toBe(396);
  expect(Math.round(placed.x)).toBe(17);
  expect(placed.height).toBeLessThanOrEqual(900 - 36);
  expect(Math.abs(placed.y - (900 - placed.height) / 2)).toBeLessThanOrEqual(2);

  const locked = await page.evaluate(() => ({
    overflowY:
      document.body.style.overflowY || document.documentElement.style.overflowY,
    scrollbar: document.body.style.scrollbarGutter || "",
  }));
  expect(locked.overflowY).toMatch(/hidden|clip/);

  // Scripted scrolling moves the page, but a fixed popup must stay centred.
  await page.evaluate(() => window.scrollTo(0, 400));
  const scrolled = (await picker.boundingBox())!;
  expect(
    Math.abs(scrolled.y - (900 - scrolled.height) / 2),
  ).toBeLessThanOrEqual(2);

  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const active = document.activeElement;
          const popup = document.querySelector("[data-fp-overlay]");
          return !!active && !!popup && popup.contains(active);
        }),
      )
      .toBe(true);
  }
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Shift+Tab");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const active = document.activeElement;
          const popup = document.querySelector("[data-fp-overlay]");
          return !!active && !!popup && popup.contains(active);
        }),
      )
      .toBe(true);
  }

  const anchor = await page.evaluate(() => window.scrollY);
  await page.mouse.move(5, 5);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(anchor);

  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(
    await page.evaluate(() => ({
      bodyOverflowY: document.body.style.overflowY,
      bodyOverflowX: document.body.style.overflowX,
      htmlOverflowY: document.documentElement.style.overflowY,
      padding: document.body.style.paddingRight,
      margin: document.body.style.marginRight,
      gutter: document.documentElement.style.scrollbarGutter,
    })),
  ).toEqual({
    bodyOverflowY: "",
    bodyOverflowX: "",
    htmlOverflowY: "",
    padding: "",
    margin: "",
    gutter: "",
  });

  const restored = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 400);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(restored);
});

test("a short dialog hugs its content instead of filling the viewport", async ({
  page,
}) => {
  await account(page, "ui_dialog_fit_" + Date.now().toString(36));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "模板库", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "模板库" });
  await expect(picker).toBeVisible();
  const fit = await picker.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const last = el.lastElementChild!.getBoundingClientRect();
    return {
      dead:
        box.bottom -
        last.bottom -
        parseFloat(getComputedStyle(el).paddingBottom),
      height: Math.round(box.height),
      scrollable: el.scrollHeight > el.clientHeight + 1,
    };
  });
  expect(fit.scrollable).toBe(false);
  expect(fit.dead).toBeLessThanOrEqual(2);
  expect(fit.height).toBeLessThan(600);
});

test("icon actions describe themselves on keyboard focus and disabled actions stay inert", async ({
  page,
}) => {
  await openPoster(page, "uitip");
  const tip = page.locator("[data-fp-tooltip]");
  await expect(tip).toHaveCount(0);
  await page.getByRole("button", { name: "复制文字块", exact: true }).focus();
  await page.keyboard.press("Tab");
  const hint = page.getByRole("button", { name: "文字块前移一层", exact: true });
  await expect(hint).toBeFocused();
  await expect(tip).toBeVisible();
  await expect(tip).toHaveText("文字块前移一层");
  await page.keyboard.press("Escape");
  await expect(tip).toHaveCount(0);
  await expect(hint).toBeFocused();

  const redo = page.getByRole("button", { name: "重做", exact: true });
  await expect(redo).toBeDisabled();
  await redo.hover();
  await expect(tip).toHaveCount(0);
  const before = await page
    .locator("[data-text-block]")
    .first()
    .innerText();
  await redo.click({ force: true });
  await expect(redo).toBeDisabled();
  await expect(page.locator("[data-text-block]").first()).toHaveText(before);
});

test("the undo hint stays readable without becoming the only name", async ({
  page,
}) => {
  await openPoster(page, "uitip2");
  const undo = page.getByRole("button", { name: "撤销", exact: true });
  await expect(undo).toBeEnabled();
  await expect(undo).toHaveAttribute("aria-keyshortcuts", /Z/);
  await expect(undo).not.toHaveAttribute("title");
  await page.getByRole("button", { name: "背景库", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(undo).toBeFocused();
  const tip = page.locator("[data-fp-tooltip]");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Ctrl/⌘ Z");
});

test("a click that leaves focus on a toolbar button keeps the editor shortcuts", async ({
  page,
}) => {
  await openPoster(page, "ui_shortcut");
  const blocks = page.locator("[data-text-block]");
  await expect(blocks).toHaveCount(1);

  const add = page.getByRole("button", { name: "添加文字", exact: true });
  await add.click();
  await expect(blocks).toHaveCount(2);
  await expect(add).toBeFocused();
  await page.keyboard.press("Delete");
  await expect(blocks).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(blocks).toHaveCount(2);
});
