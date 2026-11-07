import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  chooseOption,
  openPoster,
  selectRoot,
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
  await expect(
    page.getByTestId("notice").filter({ hasText: "当前密码不正确" }),
  ).toBeVisible();
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
  // The option list scrolls inside antd's virtual-list holder; the listbox
  // itself spans the full content height.
  const holder = page.locator(
    ".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-dropdown-list-holder",
  );
  const scrollable = await holder.evaluate(
    (el) => el.scrollHeight > el.clientHeight,
  );
  expect(scrollable).toBeTruthy();
  const active = page.locator(
    ".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-active",
  );
  await expect(active).toHaveText("全部分类");
  await first.press("ArrowDown");
  await expect(active).not.toHaveText("全部分类");
  const moved = (await active.innerText()).trim();
  await first.press("Enter");
  await expect(listbox).toHaveCount(0);
  const afterEnter = await selectValue(page, "文案分类第1级").innerText();
  expect(afterEnter).toBe(moved);

  await first.click();
  await expect(listbox).toBeVisible();
  await expect(active).toHaveText(afterEnter);
  await first.press("ArrowDown");
  await expect(active).not.toHaveText(afterEnter);
  await first.press("Escape");
  await expect(listbox).toHaveCount(0);
  await expect(selectValue(page, "文案分类第1级")).toHaveText(afterEnter);
  await adminContext.close();
});

test("editor number fields keep drafts, bounds and Escape without touching the document", async ({
  page,
}) => {
  await openPoster(page, "ui_numbers");
  const block = page.locator("[data-text-block]").first();
  await page.getByRole("button", { name: "段落", exact: true }).click();
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
  await spacing.blur();

  await spacing.fill("40");
  await expect(block).toHaveCSS("letter-spacing", "40px");
  await spacing.press("Escape");
  await expect(spacing).toHaveValue("-2.5");
  await expect(block).toHaveCSS("letter-spacing", "-2.5px");

  await page.getByRole("button", { name: "文字", exact: true }).click();
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
  await page.getByRole("button", { name: "段落", exact: true }).click();
  const shown = await spacing.inputValue();
  await expect(block).toHaveCSS("letter-spacing", `${shown}px`);

  await page.getByRole("button", { name: "添加文字", exact: true }).click();
  const second = page.locator("[data-text-block]").nth(1);
  await expect(spacing).toHaveValue("0");
  await spacing.fill("9");
  await expect(second).toHaveCSS("letter-spacing", "9px");
  await expect(block).toHaveCSS("letter-spacing", `${shown}px`);
});

test("short select options can be selected at the right edge of their menu row", async ({
  page,
}) => {
  await openPoster(page, "ui_row_hit");
  await selectTrigger(page, "文字字重").click();
  const popup = page.locator("[data-fp-popup]");
  const row = page.getByRole("option", { name: "700", exact: true });
  // The menu fades and scales into place; its rect is only final once the
  // appear motion ends, so measure after the opacity settles rather than
  // clicking at a position the menu is about to leave.
  await expect(
    page.locator(".ant-select-dropdown").filter({ visible: true }),
  ).toHaveCSS("opacity", "1");
  const menuBox = (await popup.boundingBox())!;
  const rowBox = (await row.boundingBox())!;
  await page.mouse.click(
    menuBox.x + menuBox.width - 15,
    rowBox.y + rowBox.height / 2,
  );
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(selectValue(page, "文字字重")).toHaveText("700");
});

test("Escape restores the number from before sequential typing", async ({
  page,
}) => {
  await openPoster(page, "ui_cancel_typing");
  await page.getByRole("button", { name: "段落", exact: true }).click();
  const spacing = page.getByLabel("文字字距", { exact: true });
  const block = page.locator("[data-text-block]").first();
  await spacing.fill("8");
  await spacing.blur();
  await spacing.selectText();
  await spacing.pressSequentially("123");
  await expect(block).toHaveCSS("letter-spacing", "123px");
  await spacing.press("Escape");
  await expect(spacing).toHaveValue("8");
  await expect(block).toHaveCSS("letter-spacing", "8px");
});

test("unfinished decimals stay drafts until a valid number is entered", async ({
  page,
}) => {
  await openPoster(page, "ui_pending_decimal");
  await page.getByRole("button", { name: "段落", exact: true }).click();
  const spacing = page.getByLabel("文字字距", { exact: true });
  const block = page.locator("[data-text-block]").first();
  await spacing.fill("12");
  await spacing.blur();
  await spacing.fill("0.");
  await expect(spacing).toHaveValue("0.");
  await expect(block).toHaveCSS("letter-spacing", "12px");
  await spacing.press("Escape");
  await expect(spacing).toHaveValue("12");
  await expect(block).toHaveCSS("letter-spacing", "12px");
  await spacing.fill("0.");
  await expect(spacing).toHaveValue("0.");
  await spacing.press("Control+Home");
  await expect(spacing).toHaveValue("0.");
  await spacing.dispatchEvent("keydown", {
    key: "Enter",
    keyCode: 229,
    which: 229,
  });
  await expect(spacing).toHaveValue("0.");
  await spacing.fill("-.");
  await expect(block).toHaveCSS("letter-spacing", "12px");
  await spacing.fill("-.5");
  await expect(block).toHaveCSS("letter-spacing", "-0.5px");
  await spacing.fill("invalid paste");
  await expect(block).toHaveCSS("letter-spacing", "-0.5px");
  await spacing.blur();
  await expect(spacing).toHaveValue("-0.5");
  await spacing.selectText();
  await spacing.press("Backspace");
  await spacing.pressSequentially("-.5");
  await expect(spacing).toHaveValue("-.5");
  await expect(block).toHaveCSS("letter-spacing", "-0.5px");
});

test("Enter validates invalid and unfinished drafts without leaving a stale display", async ({
  page,
}) => {
  await openPoster(page, "ui_confirm_number");
  const size = page.getByLabel("文字字号", { exact: true });
  const block = page.locator("[data-text-block]").first();
  await size.fill("4097");
  await size.press("Enter");
  await expect(size).toHaveValue("64");
  await expect(block).toHaveCSS("font-size", "64px");
  await size.fill("80");
  await size.press("Enter");
  await expect(block).toHaveCSS("font-size", "80px");
  await size.fill("81.");
  await size.press("Enter");
  await expect(size).toHaveValue("80");
  await expect(block).toHaveCSS("font-size", "80px");
  await size.press("ArrowUp");
  await expect(size).toHaveValue("81");
  await expect(block).toHaveCSS("font-size", "81px");
  await size.press("Escape");
  await expect(size).toHaveValue("80");
  await expect(block).toHaveCSS("font-size", "80px");
  await size.fill("4096");
  await size.press("Enter");
  await size.fill("4097");
  await size.press("ArrowUp");
  await expect(size).toHaveValue("4096");
  await expect(block).toHaveCSS("font-size", "4096px");
});

test("the select trigger balances text and caret insets", async ({ page }) => {
  await openPoster(page, "ui_caret");
  const root = selectRoot(page, "文字字重");
  const caret = root.locator(".ant-select-suffix svg");
  await expect(caret).toHaveCSS(
    "color",
    await root.evaluate((el) => getComputedStyle(el).color),
  );

  const box = (await root.boundingBox())!;
  const ink = (await caret.boundingBox())!;
  const textLeft = await root.evaluate((el) => {
    const value = el.querySelector("[data-fp-select-value]")!;
    const range = document.createRange();
    range.selectNodeContents(value);
    return range.getBoundingClientRect().left;
  });
  const leftInset = textLeft - box.x;
  const rightInset = box.x + box.width - (ink.x + ink.width);
  // Glyph metrics differ from the layout box, so allow the ~2px visual error
  // the design signed off on instead of the old "arrow within 4px" target.
  expect(Math.abs(leftInset - rightInset)).toBeLessThanOrEqual(2);
});

async function expectFocusInk(input: Locator) {
  await input.focus();
  const ink = await input.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      border: style.borderTopColor,
      outline: style.outlineStyle,
      shadow: style.boxShadow,
    };
  });
  expect(ink.border).toBe("rgb(136, 164, 113)");
  expect(ink.outline).toBe("none");
  expect(ink.shadow).toContain("rgba(180, 199, 165");
}

test("bare picker search uses the green focus treatment", async ({ page }) => {
  await openPoster(page, "ui_focus");
  await page.getByRole("button", { name: "背景库", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "背景库" })).toBeVisible();
  await expectFocusInk(page.getByRole("textbox", { name: "搜索预设背景" }));
  await page.getByRole("button", { name: "关闭", exact: true }).click();

  await page.goto("/projects");
  const projectsSearch = page.getByRole("textbox", { name: "搜索作品" });
  await projectsSearch.focus();
  await expect(page.locator(".search-input")).toHaveCSS(
    "border-top-color",
    "rgb(136, 164, 113)",
  );
  expect(
    await projectsSearch.evaluate((el) => getComputedStyle(el).boxShadow),
  ).toBe("none");

  await page.getByRole("button", { name: "模板库", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "模板库" })).toBeVisible();
  await expectFocusInk(page.getByRole("textbox", { name: "搜索模板" }));
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
    // rc-dialog locks the page with an injected `html body` rule instead of
    // inline styles, so the computed value is the observable contract.
    overflowY: getComputedStyle(document.body).overflowY,
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
  const hint = page.getByRole("button", {
    name: "文字块前移一层",
    exact: true,
  });
  await expect(hint).toBeFocused();
  // antd fades the previous hint out over a couple of hundred milliseconds, so
  // during the handoff two bubbles exist. Address the hint of the focused action
  // by its own text; the contract is that it describes the button in focus.
  const shown = tip.filter({ hasText: "文字块前移一层" });
  await expect(shown).toBeVisible();
  await expect(shown).toHaveText("文字块前移一层");
  await page.keyboard.press("Escape");
  await expect(tip).toHaveCount(0);
  await expect(hint).toBeFocused();

  const redo = page.getByRole("button", { name: "重做", exact: true });
  await expect(redo).toBeDisabled();
  await redo.hover();
  await expect(tip).toHaveCount(0);
  const before = await page.locator("[data-text-block]").first().innerText();
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

test.describe("touch number stepping", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("cancelling a touch hold stops the number repeat", async ({ page }) => {
    await openPoster(page, "ui_touch_cancel");
    await page.getByRole("button", { name: "文字设置", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "文字设置", exact: true });
    const plus = dialog.getByRole("button", {
      name: "增加文字字号",
      exact: true,
    });
    const size = dialog.getByLabel("文字字号", { exact: true });
    // The tabs and scope row push the size field below the sheet's first
    // screenful; the sheet scrolls, so bring the control into view first.
    await plus.scrollIntoViewIfNeeded();
    // The sheet slides in; touch the step button only once the drawer has
    // reached its resting position, otherwise the press lands where the
    // button was a frame earlier.
    await expect
      .poll(async () => {
        const box = (await dialog.boundingBox())!;
        return Math.round(box.y + box.height);
      })
      .toBe(844);
    const box = (await plus.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
    });
    await page.waitForTimeout(650);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    const stopped = await size.inputValue();
    expect(Number(stopped)).toBeGreaterThan(64);
    await page.waitForTimeout(600);
    expect(await size.inputValue()).toBe(stopped);
  });
});

test("fractional bounds stay reachable from the step button and End", async ({
  page,
}) => {
  await openPoster(page, "ui_fraction_bound");
  await page.getByRole("button", { name: "位置", exact: true }).click();
  const width = page.getByLabel("文本框宽度", { exact: true });
  await width.fill("200.2");
  await width.blur();
  await page.getByRole("button", { name: "效果", exact: true }).click();
  const padding = page.getByLabel("内边距", { exact: true });
  const plus = page.getByRole("button", {
    name: "增加内边距",
    exact: true,
  });
  await padding.fill("100");
  await padding.blur();
  await plus.click();
  await expect(plus).toBeDisabled();
  const stepped = Number(await padding.inputValue());
  expect(stepped).toBeGreaterThan(100);
  expect(stepped).toBeLessThanOrEqual(100.099);

  await padding.fill("99");
  await padding.blur();
  await padding.press("End");
  await expect(plus).toBeDisabled();
  expect(Number(await padding.inputValue())).toBeGreaterThan(99);
});

/**
 * A01 / FP-04. Reduced motion must not truncate antd's rc-motion lifecycle:
 * the global `animation: none !important` rule left popups at 0x0, made their
 * options unclickable and stopped Escape from finishing the leave transition,
 * which in turn kept the page scroll lock. Exercise the overlay matrix in both
 * motion modes, then peel a nested dialog one Escape at a time.
 */
test("reduced motion leaves overlays usable", async ({ browser, page }) => {
  test.setTimeout(240_000);

  // antd opens a popup with an enter motion whose first frame is 0x0; wait for
  // it to settle so a normal animation is not mistaken for the reduced-motion
  // defect, which never grows past that first frame.
  async function assertUsable(target: Locator, name: string) {
    await expect
      .poll(
        async () => {
          if (!(await target.isVisible())) return 0;
          const box = await target.boundingBox();
          return box ? Math.min(box.width, box.height) : 0;
        },
        {
          message: `${name} should stay visible with a real size, not 0x0`,
          timeout: 6000,
        },
      )
      .toBeGreaterThan(0);
  }

  // UIProvider reads the motion preference once when the app loads, so each
  // mode is set on its own context before navigation. Changing the OS setting
  // mid-session takes effect only after a reload; it no longer remounts the
  // editor (see the A01 fix report, Ruling 9).
  async function exercise(target: Page, mode: "no-preference" | "reduce") {
    await openPoster(target, `a01_${mode}`);

    // Select
    const weight = selectTrigger(target, "文字字重");
    await weight.click();
    const weightList = target.getByRole("listbox");
    await assertUsable(weightList, `${mode} select listbox`);
    await weightList
      .getByRole("option", { name: "700", exact: true })
      .click({ timeout: 8000 });
    await expect(weightList).toHaveCount(0);
    await expect(selectValue(target, "文字字重")).toHaveText("700");

    // Combobox (font)
    const font = selectTrigger(target, "文字字体");
    await font.click();
    const fontList = target.getByRole("listbox");
    await assertUsable(fontList, `${mode} font listbox`);
    await target.keyboard.press("Escape");
    await expect(fontList).toHaveCount(0);

    // ColorPicker
    const color = target.getByLabel("文字颜色", { exact: true });
    await color.click();
    const hexInput = target.locator(".ant-color-picker-hex-input input");
    await assertUsable(hexInput, `${mode} color hex input`);
    await hexInput.fill("00ff00");
    await color.click();
    await expect(target.locator(".ant-color-picker-hex-input")).toHaveCount(0);

    // Tooltip
    const copy = target.getByRole("button", {
      name: "复制文字块",
      exact: true,
    });
    await copy.hover();
    const tip = target.locator("[data-fp-tooltip]");
    await assertUsable(tip, `${mode} tooltip`);
    await target.mouse.move(0, 0);
    await expect(tip).toHaveCount(0);

    // Modal (Dialog) with a nested Select: two Escapes peel one layer each.
    await target.getByRole("button", { name: "背景库", exact: true }).click();
    const picker = target.getByRole("dialog", { name: "背景库" });
    await assertUsable(picker, `${mode} background dialog`);
    await selectTrigger(target, "预设背景分类").click();
    const innerList = target.getByRole("listbox");
    await assertUsable(innerList, `${mode} nested listbox`);
    await target.keyboard.press("Escape");
    await expect(innerList).toHaveCount(0);
    await expect(picker).toBeVisible();
    await target.keyboard.press("Escape");
    await expect(picker).toHaveCount(0);
    await expect(target.locator("body")).not.toHaveCSS("overflow-y", "hidden");

    // Drawer (BottomSheet): the phone editor's 更换背景 sheet is an rc-motion
    // Drawer. Narrow the viewport to expose its bottom-bar entry, operate it
    // in this motion mode, then restore the desktop layout for the list page.
    const desktop = target.viewportSize();
    await target.setViewportSize({ width: 390, height: 844 });
    const bg = target.getByRole("button", { name: "更换背景", exact: true });
    await bg.click();
    const sheet = target.getByRole("dialog", { name: "更换背景" });
    await assertUsable(sheet, `${mode} drawer`);
    await target.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(target.locator("body")).not.toHaveCSS("overflow-y", "hidden");
    await target.setViewportSize(desktop ?? { width: 1280, height: 720 });

    // Card Dropdown on the list page.
    await target.goto("/projects");
    const trigger = target.locator('[aria-label$="的操作"]').first();
    await trigger.click();
    const menu = target.getByRole("menu");
    await assertUsable(menu, `${mode} card menu`);
    await trigger.click();
    await expect(menu).toHaveCount(0);
  }

  await test.step("no-preference overlays", () =>
    exercise(page, "no-preference"));
  // A separate context keeps the two sessions apart: sharing cookies would
  // redirect the second /register visit straight past the sign-up form.
  const reduceContext = await browser.newContext({
    reducedMotion: "reduce",
    baseURL: test.info().project.use.baseURL,
  });
  const reducePage = await reduceContext.newPage();
  try {
    await test.step("reduce overlays", () => exercise(reducePage, "reduce"));
  } finally {
    await reduceContext.close();
  }
});

/**
 * A04 / FP-01. antd gives every default, primary and danger button a resting
 * 2px bottom shadow through the shared Button theme tokens. It must be gone on
 * both sites while the border, disabled, busy, pressed and focus-visible
 * feedback stays. Brief A04.1 asks for `toHaveCSS("box-shadow", "none")`: its
 * auto-waiting read is what turns a settled resting shadow into a stable RED
 * instead of catching an in-flight transition frame.
 */
test("antd action buttons have no resting shadow", async ({
  browser,
  page,
}) => {
  test.setTimeout(180_000);
  await openPoster(page, "a04_shadow");

  const controls = page.locator("button[data-fp-control]");
  const count = await controls.count();
  expect(count, "editor exposes shared buttons").toBeGreaterThan(0);
  // Auto-waiting per-button read. On the real baseline the settled value is a
  // stable 2px projection, not the 0.02px interpolation frame a single
  // getComputedStyle snapshot can catch right after mount.
  for (let i = 0; i < count; i++) {
    await expect(
      controls.nth(i),
      "every shared button has no resting shadow",
    ).toHaveCSS("box-shadow", "none");
  }
  const variants = await controls.evaluateAll((els) =>
    els.map(
      (el) =>
        [...el.classList].find((c) =>
          /^button-(primary|secondary|danger|ghost)$/.test(c),
        ) ?? "",
    ),
  );
  expect(variants, "default variant is under test").toContain(
    "button-secondary",
  );
  expect(variants, "primary variant is under test").toContain("button-primary");

  // FP-01 / Ruling 38: at 320px the header must not scroll and every header
  // control must keep a 44x44 touch target. The two collapsed actions keep
  // their accessible names (a real `title` attribute would need a DOM change
  // outside this task's file list).
  await page.setViewportSize({ width: 320, height: 900 });
  await page.waitForTimeout(250);
  const header = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".editor-header");
    const items = el
      ? [...el.querySelectorAll<HTMLElement>("button, a")].map((node) => {
          const box = node.getBoundingClientRect();
          return {
            name:
              node.getAttribute("aria-label") ||
              node.textContent?.trim() ||
              node.tagName,
            width: Math.round(box.width * 10) / 10,
            height: Math.round(box.height * 10) / 10,
          };
        })
      : [];
    return {
      scrollWidth: el?.scrollWidth ?? -1,
      clientWidth: el?.clientWidth ?? -1,
      items,
    };
  });
  expect(
    header.scrollWidth,
    "320px header does not scroll horizontally",
  ).toBeLessThanOrEqual(header.clientWidth + 1);
  expect(header.items.length, "header controls present").toBeGreaterThanOrEqual(
    4,
  );
  for (const item of header.items) {
    expect(
      item.width,
      `320px ${item.name} hit-area width`,
    ).toBeGreaterThanOrEqual(44);
    expect(
      item.height,
      `320px ${item.name} hit-area height`,
    ).toBeGreaterThanOrEqual(44);
  }

  // Ruling 38: the collapsed icon buttons stay discoverable. The DOM file
  // (ProjectWorkspace.tsx) is out of scope, so there is no real `title`; the
  // stylesheet renders the accessible name as a CSS-only tooltip instead.
  // Prove the three states on a real labelled button while still at 320px.
  const labelled = page.locator(".editor-header .button[aria-label]").first();
  const tipRest = await labelled.evaluate((el) => ({
    label: el.getAttribute("aria-label"),
    display: getComputedStyle(el, "::after").display,
  }));
  expect(
    tipRest.label,
    "collapsed action keeps an accessible name",
  ).toBeTruthy();
  expect(tipRest.display, "tooltip is hidden at rest").toBe("none");
  await labelled.hover();
  const tipHover = await labelled.evaluate((el) => ({
    display: getComputedStyle(el, "::after").display,
    content: getComputedStyle(el, "::after").content,
  }));
  expect(tipHover.display, "tooltip shows on hover").toBe("block");
  expect(tipHover.content, "tooltip text comes from aria-label").toBe(
    `"${tipRest.label}"`,
  );
  await page.mouse.move(0, 0);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(200);

  // Ruling 37 / FP-01: focus a concrete shared button by keyboard and check
  // the project's own focus ring, not "some focused element has an outline".
  const save = page.getByLabel("保存作品", { exact: true });
  await expect(save, "resting outline is not visible").toHaveCSS(
    "outline-style",
    "none",
  );
  await page.keyboard.press("Tab"); // establish keyboard modality
  await save.focus();
  const focusRing = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const style = getComputedStyle(el);
    return {
      isControl: !!el?.matches("button[data-fp-control]"),
      focusVisible: el?.matches(":focus-visible") ?? false,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      shadow: style.boxShadow,
    };
  });
  expect(focusRing.isControl, "a concrete button is focused").toBeTruthy();
  expect(
    focusRing.focusVisible,
    "keyboard focus is :focus-visible",
  ).toBeTruthy();
  expect(focusRing.outlineStyle, "project focus ring appears").toBe("solid");
  expect(focusRing.outlineWidth, "project ring keeps its 3px width").toBe(
    "3px",
  );
  expect(focusRing.shadow, "focus does not restore a resting shadow").toBe(
    "none",
  );

  // FP-01 feedback that removing the resting shadow must not erase.
  const redo = page.getByLabel("重做", { exact: true });
  await expect(redo, "a real disabled control exists").toBeDisabled();
  await expect(redo, "disabled feedback survives").toHaveCSS(
    "cursor",
    "not-allowed",
  );
  await expect(redo).toHaveCSS("box-shadow", "none");

  const add = page.getByRole("button", { name: "添加文字", exact: true });
  const restBg = await add.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  const addBox = (await add.boundingBox())!;
  await page.mouse.move(
    addBox.x + addBox.width / 2,
    addBox.y + addBox.height / 2,
  );
  await page.mouse.down();
  // The :active background is a short CSS transition; a single read can land
  // on its first frame (identical to rest) and report a false miss. Poll while
  // the button is held so the settled pressed colour is what we compare.
  await expect
    .poll(() => add.evaluate((el) => getComputedStyle(el).backgroundColor), {
      message: "pressed (:active) feedback survives",
      timeout: 3000,
    })
    .not.toBe(restBg);
  await page.mouse.move(0, 0);
  await page.mouse.up();

  let busySeen = false;
  await page.route("**/api/v1/**", async (route) => {
    try {
      await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    } catch {
      // A request cancelled while the delay is pending is already settled by
      // the browser; the busy state we are observing has already been read.
    }
  });
  try {
    if (await save.isEnabled()) {
      await save.click();
      await expect
        .poll(() => save.getAttribute("aria-busy"), "busy flag appears")
        .toBe("true");
      busySeen = true;
      await expect(save, "busy control keeps no resting shadow").toHaveCSS(
        "box-shadow",
        "none",
      );
    }
  } finally {
    await page.unroute("**/api/v1/**");
  }
  expect(busySeen, "a real busy state was observed").toBeTruthy();

  // dangerShadow is a separate theme token: isolate a real variant="danger"
  // instance (the move-to-trash confirmation) and assert its resting shadow.
  await page.getByRole("link", { name: "返回作品", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page
    .getByTestId("project-card")
    .first()
    .getByLabel(/的操作/, { exact: false })
    .click();
  await page.getByRole("menuitem", { name: "移到回收站", exact: true }).click();
  const danger = page.locator("button.button-danger");
  await expect(danger, "a real danger button is under test").toHaveCount(1);
  await expect(danger, "dangerShadow is removed too").toHaveCSS(
    "box-shadow",
    "none",
  );

  // Admin site shares the same theme. A fixed test account avoids consuming
  // the per-IP registration quota for this assertion.
  const adminContext = await browser.newContext();
  try {
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
    await admin.goto("http://127.0.0.1:15174/admin/templates");
    const adminButtons = admin.locator("button[data-fp-control]");
    const adminCount = await adminButtons.count();
    expect(adminCount, "admin exposes shared buttons").toBeGreaterThan(0);
    for (let i = 0; i < adminCount; i++) {
      await expect(adminButtons.nth(i), "admin resting shadow").toHaveCSS(
        "box-shadow",
        "none",
      );
    }
  } finally {
    await adminContext.close();
  }
});

/**
 * A04 / FP-03. The closed select value, the swatch, the search input and the
 * arrow must all sit on the trigger's vertical centre line. antd turns the
 * single-value `content` slot into `display:block`, and the old rule stretched
 * it to `height:100%`, so the inline text sat at the block's top while the
 * suffix stayed centred (~7px offset). Measure the real boxes: the gap between
 * the visible value container and the trigger must stay within 2px, and the
 * arrow is checked separately.
 */
test("closed select values share the trigger center", async ({
  browser,
  page,
}) => {
  test.setTimeout(180_000);
  await openPoster(page, "a04_center");

  type Alignment = { trigger: number; value: number; caret: number };
  async function alignment(scope: Page, label: string): Promise<Alignment> {
    const root = selectRoot(scope, label);
    await expect(root, `${label} trigger`).toBeVisible();
    // The closed value is normally the shared `labelRender` span
    // ([data-fp-select-value]); a combobox with no value can instead render
    // antd's own placeholder node. Measure whichever the browser produced so
    // empty / placeholder states are covered by the same centre-line rule.
    const value = selectValue(scope, label);
    const placeholder = root.locator(".ant-select-selection-placeholder");
    const text = (await value.count()) > 0 ? value : placeholder;
    await expect(text, `${label} value or placeholder`).toHaveCount(1);
    const caret = root.locator(".ant-select-suffix svg");
    await expect(caret, `${label} caret`).toHaveCount(1);
    const rootBox = (await root.boundingBox())!;
    const valueBox = (await text.boundingBox())!;
    const caretBox = (await caret.boundingBox())!;
    return {
      trigger: rootBox.y + rootBox.height / 2,
      value: valueBox.y + valueBox.height / 2,
      caret: caretBox.y + caretBox.height / 2,
    };
  }
  function expectCentered(m: Alignment, note: string) {
    expect(
      Math.abs(m.value - m.trigger),
      `${note}: value vs trigger`,
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs(m.caret - m.trigger),
      `${note}: caret vs trigger`,
    ).toBeLessThanOrEqual(2);
  }

  // A04.1 list, editor "文字" group: numeric weight / mixed, Chinese font,
  // preset colour swatch. These are closed, filled selects of three kinds.
  const cases = [
    ["文字字重", "数字/字号与混合态"],
    ["文字字体", "中文字体"],
    ["预设文字颜色", "预设色/色块"],
  ] as const;
  for (const [label, note] of cases) {
    expectCentered(await alignment(page, label), `${label} (${note})`);
  }

  // The colour swatch itself must share the same centre line. Select a preset
  // first so labelRender actually renders the swatch span (the initial colour
  // is a custom #000000 with no preset swatch).
  await chooseOption(page, "预设文字颜色", "经典 · 墨黑");
  {
    const root = selectRoot(page, "预设文字颜色");
    const swatch = root.locator("[data-fp-select-value] > span").first();
    await expect(swatch, "preset swatch").toHaveCount(1);
    const rootBox = (await root.boundingBox())!;
    const swatchBox = (await swatch.boundingBox())!;
    expect(
      Math.abs(
        swatchBox.y + swatchBox.height / 2 - (rootBox.y + rootBox.height / 2),
      ),
      "preset swatch vs trigger",
    ).toBeLessThanOrEqual(2);
  }

  // Ruling 36 / A04.4: "样式不作用到海报文档节点" is proved by reading the
  // document node's computed font-size / colour and comparing them with the
  // A04 UI rule values (13px labels / --fp-text #202C25), not by DOM ancestry.
  // The real text block created by openPoster guarantees the node exists.
  {
    const scope = await page.evaluate(() => {
      const canvas = document.querySelector(".poster-canvas");
      const block = document.querySelector<HTMLElement>("[data-text-block]");
      const uiSwatches = document.querySelectorAll(
        ".editor-properties [class*='swatch']",
      );
      const cs = block ? getComputedStyle(block) : null;
      return {
        uiSwatches: uiSwatches.length,
        swatchInCanvas: [...uiSwatches].some((s) => !!canvas?.contains(s)),
        hasBlock: !!block,
        fontSize: cs?.fontSize ?? null,
        color: cs?.color ?? null,
        inlineFontSize: block?.style.fontSize ?? null,
        inlineColor: block?.style.color ?? null,
        matchesUI: block
          ? block.matches(
              ".panel-field, .style-target, .inspector-content, .editor-properties, [class*='swatch'], [data-fp-input]",
            )
          : null,
      };
    });
    expect(scope.uiSwatches, "inspector renders UI swatches").toBeGreaterThan(
      0,
    );
    expect(scope.hasBlock, "a real document text block exists").toBeTruthy();
    expect(scope.matchesUI, "document node matches no A04 UI selector").toBe(
      false,
    );
    expect(scope.fontSize, "canvas font-size comes from the document").toBe(
      scope.inlineFontSize,
    );
    expect(
      scope.fontSize,
      "A04 13px label rule does not reach the canvas",
    ).not.toBe("13px");
    expect(scope.color, "canvas colour comes from the document").toBe(
      scope.inlineColor,
    );
    expect(scope.color, "A04 --fp-text ink does not reach the canvas").not.toBe(
      "rgb(32, 44, 37)",
    );
    expect(scope.swatchInCanvas, "UI swatch never enters the canvas").toBe(
      false,
    );
  }

  // Font search state: the search input and arrow stay on the centre line.
  {
    const font = selectTrigger(page, "文字字体");
    await font.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await font.fill("字");
    const root = selectRoot(page, "文字字体");
    const rootBox = (await root.boundingBox())!;
    const input = root.locator(".ant-select-input");
    await expect(input, "font search input").toHaveCount(1);
    const caret = root.locator(".ant-select-suffix svg");
    await expect(caret, "font search caret").toHaveCount(1);
    const inputBox = (await input.boundingBox())!;
    const caretBox = (await caret.boundingBox())!;
    const trigger = rootBox.y + rootBox.height / 2;
    expect(
      Math.abs(inputBox.y + inputBox.height / 2 - trigger),
      "font search input vs trigger",
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs(caretBox.y + caretBox.height / 2 - trigger),
      "font search caret vs trigger",
    ).toBeLessThanOrEqual(2);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
  }

  // Admin site: "后台分类" (FP-13 second site) plus the A04.1 "空值" and
  // "禁用" coverage items. A fixed account avoids the registration quota.
  const adminContext = await browser.newContext();
  try {
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
    await admin.goto("http://127.0.0.1:15174/admin/templates");
    expectCentered(await alignment(admin, "筛选模板分类"), "后台分类 select");

    // Ruling 34: real empty-value and disabled Select instances. Editing a
    // seeded font opens a form whose 素材分类 is an empty-string value and
    // whose 字体字重 / 字体样式 are disabled until a replacement file is
    // chosen. No DOM is mocked; these are the app's own documented states.
    await admin.goto("http://127.0.0.1:15174/admin/fonts");
    await admin
      .getByRole("button", { name: "编辑", exact: true })
      .first()
      .click();
    await expect(admin.getByRole("dialog", { name: "编辑素材" })).toBeVisible();
    // antd Dialog slides in with an rc-motion appear transform. Two sequential
    // boundingBox() calls can land on different frames of that animation and
    // report a false ~300px offset, so let the dialog settle before measuring.
    await admin.waitForTimeout(400);
    await expect(
      selectValue(admin, "素材分类"),
      "空值走 labelRender 值节点",
    ).toHaveText("未分类");
    expectCentered(await alignment(admin, "素材分类"), "空值/未分类 select");
    for (const label of ["字体字重", "字体样式"] as const) {
      await expect(
        selectRoot(admin, label),
        `${label} is a real disabled select`,
      ).toHaveClass(/ant-select-disabled/);
      expectCentered(await alignment(admin, label), `禁用 select ${label}`);
    }
  } finally {
    await adminContext.close();
  }

  // Ruling 39 / FP-01: touch-sized real text inputs at 390 and 320. The
  // position group renders .geometry-fields directly under .inspector-content,
  // outside .panel-field, so it needs its own 16px rule on touch widths.
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    const entry = page.getByRole("button", { name: "文字设置", exact: true });
    if (await entry.count()) await entry.first().click();
    await page.waitForTimeout(200);
    // The sheet keeps the previously shown group across viewport changes, so
    // return to 文字 explicitly before reading a .panel-field input.
    const textTab = page.getByRole("button", { name: "文字", exact: true });
    if (await textTab.count()) await textTab.first().click();
    await page.waitForTimeout(150);
    const panelFs = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(
        ".panel-field [data-fp-input]",
      );
      return el ? getComputedStyle(el).fontSize : null;
    });
    const posTab = page.getByRole("button", { name: "位置", exact: true });
    if (await posTab.count()) await posTab.first().click();
    await page.waitForTimeout(200);
    const geoFs = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(".geometry-fields input");
      return el ? getComputedStyle(el).fontSize : null;
    });
    expect(geoFs, `${width}px position-group input is 16px`).toBe("16px");
    expect(panelFs, `${width}px panel field input stays 16px`).toBe("16px");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
});
