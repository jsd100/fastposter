import { test, expect } from "@playwright/test";
import { openPoster, selectScenery } from "./helpers";
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
  await page.getByLabel("文字颜色", { exact: true }).fill("#ff0000");
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

  const sheetBox = (await sheet.boundingBox())!;
  expect(Math.round(sheetBox.y + sheetBox.height)).toBe(800);
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
  await expect(sheet.locator("[data-fp-popup]")).toHaveCount(1);
  const box = (await listbox.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);

  await listbox
    .getByRole("option", { name: "思源宋体", exact: true })
    .click();
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
  // thumb actually hits, so the package grows those with it.
  expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(row).toHaveCSS("font-size", "16px");

  // The menu portals into the sheet, which is itself a scroll box, so being
  // visible is not enough: it has to sit inside that box, and what does not fit
  // has to be reachable by scrolling the list rather than cut off.
  const listBox = (await listbox.boundingBox())!;
  const clip = await sheet.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  });
  expect(listBox.y).toBeGreaterThanOrEqual(clip.top - 0.5);
  expect(listBox.y + listBox.height).toBeLessThanOrEqual(clip.bottom + 0.5);
  await expect(listbox).toHaveCSS("overflow-y", "auto");
});
