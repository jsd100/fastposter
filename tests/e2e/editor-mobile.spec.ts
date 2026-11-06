import { test, expect, type Locator, type Page } from "@playwright/test";
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
/**
 * A02 / FP-13. Seed a known document through the project API instead of
 * relying on however many taps a test happens to make. The editor reloads the
 * saved revision, so the 100-block capacity case and the lower-selection case
 * both start from fixed geometry.
 */
async function seedDocument(
  page: Page,
  mutate: (doc: Record<string, any>) => void,
) {
  const projectId = page.url().split("/").at(-2)!;
  const url = `/api/v1/projects/${projectId}`;
  // The editor autosaves ~1s after the last edit. Wait for the server copy to
  // carry the block we just created, then let the in-flight save settle so the
  // revision we seed against is the current one.
  await expect
    .poll(
      async () => {
        const read = await page.request.get(url);
        return read.ok()
          ? JSON.parse((await read.json()).project.document).textBlocks.length
          : 0;
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
  await page.waitForTimeout(1200);
  const read = await page.request.get(url);
  expect(read.ok()).toBeTruthy();
  const project = (await read.json()).project as {
    title: string;
    revision: string;
    document: string;
  };
  const doc = JSON.parse(project.document);
  mutate(doc);
  const saved = await page.request.put(url, {
    data: {
      title: project.title,
      document: JSON.stringify(doc),
      expectedRevision: project.revision,
    },
  });
  const body = await saved.text();
  expect(saved.ok(), body).toBeTruthy();
  // A local autosave draft can conflict with the revision we just wrote. The
  // product offers "use cloud version" for exactly this case; take it so the
  // seeded document is the one the editor renders.
  const verify = await (await page.request.get(url)).json();
  expect(JSON.parse(verify.project.document).textBlocks.length).toBe(
    doc.textBlocks.length,
  );
  await page.reload();
  const useCloud = page.getByRole("button", {
    name: "使用云端版本",
    exact: true,
  });
  await expect
    .poll(
      async () => {
        if (await useCloud.isVisible()) {
          await useCloud.click();
          return "cloud";
        }
        return (await page.locator("[data-editor-stage]").count())
          ? "ready"
          : "pending";
      },
      { timeout: 15_000 },
    )
    .not.toBe("pending");
}

test("phone can undo and redo after deleting a text block", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  for (const width of [320, 390]) {
    await test.step(`phone ${width}px history`, async () => {
      // Each width needs its own registration session: an already signed-in
      // page is redirected away from /register on the second pass.
      const context = await browser.newContext({
        viewport: { width, height: 800 },
        hasTouch: true,
        deviceScaleFactor: 2,
        baseURL: test.info().project.use.baseURL,
      });
      const page = await context.newPage();
      try {
        await openPoster(page, `a02undo${width}`);
        const blocks = page.locator("[data-text-block]");
        await expect(blocks).toHaveCount(1);
        const undo = page.getByRole("button", { name: "撤销", exact: true });
        const redo = page.getByRole("button", { name: "重做", exact: true });
        await expect(undo).toBeVisible();
        await expect(redo).toBeVisible();
        for (const control of [undo, redo]) {
          const box = (await control.boundingBox())!;
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
        const del = page.getByRole("button", {
          name: "删除文字块",
          exact: true,
        });
        await expect(del.first()).toBeEnabled();
        await del.first().tap();
        await expect(blocks).toHaveCount(0);
        await undo.tap();
        await expect(blocks).toHaveCount(1);
        await redo.tap();
        await expect(blocks).toHaveCount(0);
        await expect(redo).toBeDisabled();
      } finally {
        await context.close();
      }
    });
  }
});

test("phone inspector keeps lower selection visible and restores the view", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 800 });
  await openPoster(page, "a02lower");
  // Two blocks: the lower one is the selection under test; the other one is
  // the "other selection content" FP-07 must not clear on a block switch.
  await seedDocument(page, (doc) => {
    const base = doc.textBlocks[0];
    const setText = (block: Record<string, any>, value: string) => {
      const paragraph = block.content.content[0];
      if (paragraph.content?.[0]) paragraph.content[0].text = value;
      else paragraph.content = [{ type: "text", text: value }];
    };
    const lower = {
      ...structuredClone(base),
      id: "lower",
      y: Math.max(1, doc.canvas.height - 160),
    };
    lower.defaultStyle.fontSize = 72;
    setText(lower, "底部文字");
    const other = {
      ...structuredClone(base),
      id: "other",
      y: Math.max(1, Math.min(100, doc.canvas.height - 200)),
      zIndex: 1,
    };
    setText(other, "其他文字块");
    doc.textBlocks = [lower, other];
  });
  const canvas = page.locator(".poster-canvas");
  const stage = page.locator("[data-editor-stage]");
  const block = page.locator('[data-text-block="lower"]');
  const other = page.locator('[data-text-block="other"]');
  const overlap = (
    top: number,
    bottom: number,
    box: { y: number; height: number },
  ) => Math.min(box.y + box.height, bottom) - Math.max(box.y, top);
  // Read a rect only once the drawer's CSS transform slide has settled. A
  // mid-animation rect makes the reduced band look wider than it really is,
  // which would turn the acceptance assertion into a vacuous one.
  const settledBox = async (drawer: Locator) => {
    let prevY = Number.NaN;
    let prevHeight = Number.NaN;
    let stable = 0;
    for (let i = 0; i < 120; i += 1) {
      const box = await drawer.boundingBox();
      if (
        box &&
        Math.abs(box.y - prevY) < 0.5 &&
        Math.abs(box.height - prevHeight) < 0.5
      )
        stable += 1;
      else stable = 0;
      if (box) {
        prevY = box.y;
        prevHeight = box.height;
      }
      if (stable >= 5 && box) return box;
      await page.waitForTimeout(16);
    }
    throw new Error("drawer did not reach a resting position");
  };

  // Select the lower block through the layers sheet.
  await page.getByRole("button", { name: "图层", exact: true }).click();
  const layers = page.getByRole("dialog", { name: "图层" });
  await expect(layers).toBeVisible();
  await layers.locator(".layer-item").filter({ hasText: "底部文字" }).click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(layers).toHaveCount(0);

  // Pan the still-selected lower block (a pure view change) down to the very
  // bottom of the stage. With no drawer it is still on the stage; a bottom
  // drawer will cover it. The wheel sign is derived from a real measurement
  // so the fixture never hard-codes the browser's convention.
  const stageBox = (await stage.boundingBox())!;
  await page.mouse.move(stageBox.x + stageBox.width / 2, stageBox.y + 60);
  const firstY = (await block.boundingBox())!.y;
  await page.mouse.wheel(0, -100);
  await expect
    .poll(async () => (await block.boundingBox())!.y)
    .not.toBe(firstY);
  const downSign = (await block.boundingBox())!.y > firstY ? -1 : 1;
  const target = stageBox.y + stageBox.height - 40;
  for (let i = 0; i < 40; i += 1) {
    const b = (await block.boundingBox())!;
    if (Math.abs(b.y - target) <= 20) break;
    const y = b.y;
    const need = Math.max(-80, Math.min(80, target - y));
    await page.mouse.wheel(0, downSign * need);
    await expect.poll(async () => (await block.boundingBox())!.y).not.toBe(y);
  }
  const placed = (await block.boundingBox())!;
  // Ruling 18.4 (no occlusion): the selection is still visible on the stage
  // before the drawer opens.
  expect(
    overlap(stageBox.y, stageBox.y + stageBox.height, placed),
  ).toBeGreaterThan(0);
  const before = await canvas.getAttribute("style");
  const beforeY = await block.getAttribute("data-y");

  const openSheet = page.getByRole("button", { name: "文字设置", exact: true });
  await openSheet.click();
  const sheet = page.getByRole("dialog", { name: "文字设置" });
  await expect(sheet).toBeVisible();
  // The band is measured from the same overlay the product measures, after
  // its transform slide has settled, so the assertion is about the real
  // reduced band and not a mid-animation rect.
  const panel = page.locator("[data-fp-overlay].bottom-sheet").first();
  const panelBox = await settledBox(panel);
  const bandTop = stageBox.y;
  const bandBottom = panelBox.y;
  // Fixture proof: the unadjusted selection really sat behind the drawer.
  // Without a view adjustment the product cannot show it at all.
  expect(
    overlap(panelBox.y, panelBox.y + panelBox.height, placed),
  ).toBeGreaterThan(0);

  // === Acceptance result (A02.1 / FP-07) ===
  // The transformed selection must intersect the reduced visible band. On the
  // baseline product code no adjustment happens and this poll times out.
  await expect
    .poll(
      async () => {
        const b = await block.boundingBox();
        return b ? overlap(bandTop, bandBottom, b) : 0;
      },
      {
        message: "the lower selection must stay visible above the open drawer",
        timeout: 10_000,
      },
    )
    .toBeGreaterThan(0);
  // A property change must be visible on that same, now-visible selection:
  // bind the value change and the geometric intersection into one assertion,
  // so "font-size changed" alone can never be a vacuous proof.
  await sheet.getByLabel("文字字号", { exact: true }).fill("80");
  await expect
    .poll(
      async () => {
        const b = await block.boundingBox();
        if (!b) return "pending";
        const font = await block.evaluate(
          (el) => getComputedStyle(el).fontSize,
        );
        return overlap(bandTop, bandBottom, b) > 0 && font === "80px"
          ? "visible-and-styled"
          : "pending";
      },
      { timeout: 10_000 },
    )
    .toBe("visible-and-styled");

  // === Mechanism assertions (not the acceptance result) ===
  // The adjustment is a pure setView: transform changes, document does not.
  await expect(canvas).not.toHaveAttribute("style", before!);
  await expect(block).toHaveAttribute("data-y", beforeY!);
  // Switching a property group keeps the local effective change.
  await sheet.getByRole("button", { name: "段落", exact: true }).click();
  await sheet.getByRole("button", { name: "文字", exact: true }).click();
  await expect(sheet.getByLabel("文字字号", { exact: true })).toHaveValue("80");

  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(canvas).toHaveAttribute("style", before!);

  // Ruling 21 / FP-07: switching text blocks keeps the other block's content
  // and the local effective change (the group-switch assertion stays above).
  await page.getByRole("button", { name: "图层", exact: true }).click();
  const switchLayers = page.getByRole("dialog", { name: "图层" });
  await expect(switchLayers).toBeVisible();
  await switchLayers
    .locator(".layer-item")
    .filter({ hasText: "其他文字块" })
    .click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(switchLayers).toHaveCount(0);
  await expect(block).toHaveCSS("font-size", "80px");
  await expect(other).toContainText("其他文字块");
});

test("add text capacity is the same on mobile and desktop", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPoster(page, "a02cap");
  await seedDocument(page, (doc) => {
    const base = doc.textBlocks[0];
    doc.textBlocks = Array.from({ length: 100 }, (_, i) => ({
      ...structuredClone(base),
      id: `cap-${i}`,
      x: (i % 5) * 24,
      y: Math.floor(i / 5) * 24,
      zIndex: i,
    }));
  });
  const blocks = page.locator("[data-text-block]");
  await expect(blocks).toHaveCount(100);
  // Desktop toolbar entry is disabled at the shared 100-block limit.
  await expect(
    page.getByRole("button", { name: "添加文字", exact: true }),
  ).toBeDisabled();

  // The same shared rule disables the phone sheet's only creation entry.
  await page.setViewportSize({ width: 390, height: 800 });
  await page.getByRole("button", { name: "文字设置", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "文字设置" });
  await expect(sheet).toBeVisible();
  await expect(
    sheet.getByRole("button", { name: "添加文字", exact: true }),
  ).toBeDisabled();
  // No write happened: the document still holds exactly 100 blocks.
  await expect(blocks).toHaveCount(100);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
});

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
