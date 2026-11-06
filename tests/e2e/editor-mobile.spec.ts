import { test, expect } from "@playwright/test";
import { openPoster, selectScenery, selectValue, setColor } from "./helpers";
test.use({
  viewport: { width: 360, height: 800 },
  hasTouch: true,
  deviceScaleFactor: 2,
});
test("mobile bottom sheet styles selected text without horizontal overflow", async ({
  page,
}) => {
  await openPoster(page, "mobiletext");
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  await selectScenery(page);
  await page.getByRole("button", { name: "文字设置", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await setColor(page, "文字颜色", "ff0000");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();
  await expect(
    page.locator("[data-text-block]").getByText("风景", { exact: true }),
  ).toHaveCSS("color", "rgb(255, 0, 0)");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  const stage = page.locator("[data-editor-stage]"),
    canvas = page.locator(".poster-canvas"),
    block = page.locator("[data-text-block]");
  const before = await canvas.getAttribute("style"),
    x = await block.getAttribute("data-x"),
    y = await block.getAttribute("data-y");
  const r = (await stage.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const a = { id: 1, x: r.x + 90, y: r.y + r.height * 0.8 },
    b = { id: 2, x: r.x + 270, y: r.y + r.height * 0.8 };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [a],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [a, b],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { ...a, x: a.x - 30 },
      { ...b, x: b.x + 30 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(canvas).not.toHaveAttribute("style", before!);
  await expect(block).toHaveAttribute("data-x", x!);
  await expect(block).toHaveAttribute("data-y", y!);
});

test("bottom sheet font menu stays inside the viewport and keeps the selection", async ({
  page,
}) => {
  await openPoster(page, "mobilesheet");
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = await selectScenery(page);
  const openSheet = page.getByRole("button", { name: "文字设置", exact: true });
  await openSheet.click();
  const sheet = page.getByRole("dialog", { name: "文字设置" });
  await expect(sheet).toBeVisible();

  // The drawer slides up, so its resting box is what the layout promises.
  await expect
    .poll(async () => {
      const box = (await sheet.boundingBox())!;
      return Math.round(box.y + box.height);
    })
    .toBe(800);
  const sheetBox = (await sheet.boundingBox())!;
  // A centred or bottom sheet keeps the 17px gutter the browser used to clamp
  // modals to, so the authored width never runs out to the screen edge.
  expect(sheetBox.x).toBe(17);
  expect(Math.round(sheetBox.width)).toBe(326);
  // The editor caps its sheet below the package default; the popup still has to
  // reach that page rule after being portalled out of the editor.
  expect(Math.round(sheetBox.height)).toBeLessThanOrEqual(520);
  expect(await sheet.evaluate((el) => getComputedStyle(el).paddingBottom)).toBe(
    "24px",
  );

  const font = sheet.getByLabel("文字字体", { exact: true });
  await font.click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  const popup = sheet.locator("[data-fp-popup]");
  await expect(popup).toHaveCount(1);
  const box = (await popup.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);

  // The first Escape only dismisses the font menu. The sheet, and the editor
  // range it is styling, have to survive until a choice is made; the font
  // below only reaches 风景, not the rest of the block.
  await page.keyboard.press("Escape");
  await expect(listbox).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await expect(selectValue(page, "文字字体")).toHaveText("思源黑体");

  // The menu consumed the first Escape. With no inner layer left, the next
  // one closes the sheet and hands focus back to the trigger that opened it.
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(openSheet).toBeFocused();
  await openSheet.click();
  await expect(sheet).toBeVisible();

  await font.click();
  await expect(listbox).toBeVisible();
  await page.getByRole("option", { name: "思源宋体", exact: true }).click();
  await expect(listbox).toHaveCount(0);
  await expect(sheet).toBeVisible();

  // The page behind a modal dialog is hidden from the accessibility tree, so the
  // live editor DOM is read here rather than through a role query.
  const scenery = page.locator(
    'span[data-font-id="builtin-noto-serif-sc-400"]',
  );
  await expect(scenery).toHaveCount(1);
  await expect(scenery).toHaveText("风景");
  await sheet.getByLabel("文字字号", { exact: true }).fill("80");
  await expect(scenery).toHaveCSS("font-size", "80px");

  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(openSheet).toBeFocused();
  await expect(input).toContainText("你好风景世界");
  await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();
  const block = page.locator("[data-text-block]").first();
  await expect(block.getByText("风景", { exact: true })).toHaveCSS(
    "font-size",
    "80px",
  );
  await expect(block.getByText("你好", { exact: true })).toHaveCSS(
    "font-size",
    "64px",
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});

test("mobile text panel adds a second text block", async ({ page }) => {
  await openPoster(page, "mobileadd");
  const blocks = page.locator("[data-text-block]");
  await expect(blocks).toHaveCount(1);
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  await page.getByRole("textbox", { name: "海报文字编辑" }).fill("第一块");
  await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();
  await expect(blocks.first()).toHaveText("第一块");

  await page.getByRole("button", { name: "文字设置", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "文字设置" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "添加文字", exact: true }).click();
  await expect(blocks).toHaveCount(2);
  // The panel keeps working on the new block while the old one stays as it
  // was, and the new block is the selected layer.
  await expect(sheet.getByText("当前文字块")).toBeVisible();
  await expect(blocks.first()).toHaveText("第一块");
  await expect(blocks.nth(1)).toContainText("把喜欢的风景");
  await page.getByRole("button", { name: "关闭", exact: true }).click();

  await page.getByRole("button", { name: "图层", exact: true }).click();
  const layers = page.getByRole("dialog", { name: "图层" });
  const rows = layers.locator(".layer-item");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "关闭", exact: true }).click();

  // With no selection the panel still offers its headline add entry.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "文字设置", exact: true }).click();
  await expect(sheet.getByText("选择一个文字块")).toBeVisible();
  await sheet.getByRole("button", { name: "添加文字", exact: true }).click();
  await expect(blocks).toHaveCount(3);
  await expect(sheet.getByText("当前文字块")).toBeVisible();
});

test("phone background nav offers upload and the background library", async ({
  page,
}) => {
  await openPoster(page, "mobilebackground");
  await page.getByRole("button", { name: "更换背景", exact: true }).click();
  const chooser = page.getByRole("dialog", { name: "更换背景" });
  await expect(chooser).toBeVisible();
  await expect(
    chooser.getByRole("button", { name: "上传图片", exact: true }),
  ).toBeVisible();
  await chooser
    .getByRole("button", { name: "从背景库选择", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "背景库" })).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "背景库" })).toHaveCount(0);
});

test("font menu rows keep a thumb-sized target on a touch screen", async ({
  page,
}) => {
  await openPoster(page, "mobilemenu");
  await page.getByRole("button", { name: "文字设置", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "文字设置" });
  await expect(sheet).toBeVisible();

  await sheet.getByLabel("文字字体", { exact: true }).click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  const row = listbox.getByRole("option", { name: "Inter", exact: true });
  // The page grows the trigger to 44px, but the rows inside the menu are what a
  // thumb actually hits, so the package grows those with it. The menu opens
  // with a scale animation, so measure the settled row rather than the frame
  // that first becomes visible.
  await expect
    .poll(async () => (await row.boundingBox())?.height ?? 0)
    .toBeGreaterThanOrEqual(44);
  await expect(row).toHaveCSS("font-size", "16px");

  // The menu portals into the sheet, which is itself a scroll box, so being
  // visible is not enough: it has to sit inside that box, and what does not fit
  // has to be reachable by scrolling the list rather than cut off.
  // The menu is positioned asynchronously after it mounts; wait for it to
  // settle inside the sheet's scroll box before measuring.
  const popup = sheet.locator("[data-fp-popup]");
  await expect
    .poll(async () => {
      const box = (await popup.boundingBox())!;
      const clip = await sheet.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      });
      // The menu now anchors below the property tabs and clamps at the panel's
      // top edge; antd places that clamped popup on the section border, a hair
      // above the panel box. Allow that border, not visible clipping.
      return box.y >= clip.top - 2 && box.y + box.height <= clip.bottom + 0.5;
    })
    .toBe(true);
  await expect(popup.locator(".ant-select-dropdown-list-holder")).toHaveCSS(
    "overflow-y",
    "auto",
  );
});

/**
 * A01 / FP-04 + FP-13. "背景 → 从背景库选择" is a source swap: the sheet
 * that opened the library is gone when the library closes, so its trigger
 * can no longer take focus. Focus must land on the still-present bottom-bar
 * 背景 button, not on BODY, and the page must not keep a stale scroll lock.
 * The Drawer is exercised in both motion modes (each set before load): reduced
 * motion used to freeze rc-motion sheets at their 0x0 enter frame.
 */
test("mobile background picker returns focus to background tool", async ({
  browser,
  page,
}) => {
  test.setTimeout(240_000);

  async function exercise(
    target: typeof page,
    mode: "no-preference" | "reduce",
  ) {
    await openPoster(target, `a01_focus_${mode}`);
    const backgroundTool = target.getByRole("button", {
      name: "更换背景",
      exact: true,
    });
    await backgroundTool.click();
    const chooser = target.getByRole("dialog", { name: "更换背景" });
    await expect(chooser).toBeVisible();
    // The Drawer must be a real, usable layer in both motion modes, not the
    // 0x0 first frame a blanket `animation: none` used to freeze it at.
    await expect
      .poll(
        async () => {
          const box = await chooser.boundingBox();
          return box ? Math.min(box.width, box.height) : 0;
        },
        {
          message: `${mode} drawer should keep a real size, not 0x0`,
          timeout: 6000,
        },
      )
      .toBeGreaterThan(20);
    await chooser
      .getByRole("button", { name: "从背景库选择", exact: true })
      .click();
    const library = target.getByRole("dialog", { name: "背景库" });
    await expect(library).toBeVisible();
    await library.getByRole("button", { name: "关闭", exact: true }).click();
    await expect(library).toHaveCount(0);

    await expect(backgroundTool).toBeFocused();
    await expect(target.locator("body")).not.toHaveCSS("overflow-y", "hidden");
  }

  await test.step("no-preference focus return", () =>
    exercise(page, "no-preference"));
  // Set reduced motion before load. Flipping the media feature while the app
  // is mounted makes antd's MotionWrapper re-wrap the ConfigProvider subtree,
  // which remounts the editor and detaches the bottom bar. A separate context
  // also keeps the two registration sessions apart: sharing cookies would
  // redirect the second /register straight past the sign-up form.
  const reduceContext = await browser.newContext({
    viewport: { width: 360, height: 800 },
    hasTouch: true,
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    baseURL: test.info().project.use.baseURL,
  });
  const reducePage = await reduceContext.newPage();
  try {
    await test.step("reduce focus return", () =>
      exercise(reducePage, "reduce"));
  } finally {
    await reduceContext.close();
  }
});
