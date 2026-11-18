import { test, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { chooseOption, openPoster, selectScenery, setColor } from "./helpers";

async function exportPng(page: Page): Promise<Buffer> {
  await page.getByRole("button", { name: "导出 PNG", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "导出海报" });
  const link = dialog.getByRole("link", {
    name: "下载原尺寸 PNG",
    exact: true,
  });
  await expect(link).toBeVisible({ timeout: 20_000 });
  const body = await (
    await page.request.get((await link.getAttribute("href"))!)
  ).body();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  return body;
}
test("selected words keep style and selection across panel edits and save", async ({
  page,
}) => {
  await openPoster(page);
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = await selectScenery(page);
  await page.getByLabel("文字字号", { exact: true }).fill("80");
  await expect(input.getByText("风景", { exact: true })).toHaveCSS(
    "font-size",
    "80px",
  );
  await setColor(page, "文字颜色", "ff0000");
  await expect(input.getByText("风景", { exact: true })).toHaveCSS(
    "color",
    "rgb(255, 0, 0)",
  );
  await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();
  const block = page.locator("[data-text-block]").first();
  await expect(block.getByText("风景", { exact: true })).toHaveCSS(
    "color",
    "rgb(255, 0, 0)",
  );
  await expect(block.getByText("风景", { exact: true })).toHaveCSS(
    "font-size",
    "80px",
  );
  await expect(block.getByText("你好", { exact: true })).toHaveCSS(
    "font-size",
    "64px",
  );
  await page.getByRole("button", { name: "保存作品", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.locator("[data-text-block]").getByText("风景", { exact: true }),
  ).toHaveCSS("color", "rgb(255, 0, 0)");
});
test("cursor styles affect later input; IME events and shared undo preserve text", async ({
  page,
}) => {
  await openPoster(page, "ime");
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = page.getByRole("textbox", { name: "海报文字编辑" });
  await input.fill("前");
  await page.getByLabel("文字字号", { exact: true }).fill("80");
  await setColor(page, "文字颜色", "ff0000");
  // Closing the picker returns focus to its trigger. Moving back into the
  // canvas restores the Tiptap selection asynchronously, so wait for the
  // caret before typing; otherwise the first key lands at the block start.
  await input.focus();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const selection = window.getSelection();
        return (
          selection?.anchorNode?.nodeType === Node.TEXT_NODE &&
          selection.anchorNode.textContent === "前" &&
          selection.anchorOffset === 1
        );
      }),
    )
    .toBe(true);
  await input.pressSequentially("后");
  await expect(input).toHaveText("前后");
  await expect(input.getByText("后", { exact: true })).toHaveCSS(
    "font-size",
    "80px",
  );
  await expect(input.getByText("后", { exact: true })).toHaveCSS(
    "color",
    "rgb(255, 0, 0)",
  );
  await input.dispatchEvent("compositionstart", { data: "" });
  await input.pressSequentially("中文");
  await input.dispatchEvent("compositionupdate", { data: "中文" });
  await input.dispatchEvent("compositionend", { data: "中文" });
  await expect(input).toHaveText("前后中文");
  await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.locator("[data-text-block]")).toContainText("前后");
  await expect(page.locator("[data-text-block]")).not.toContainText("中文");
});

test("changing the selected words leaves the rest of the block alone and undoes", async ({
  page,
}) => {
  await openPoster(page, "scope");
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = await selectScenery(page);
  await chooseOption(page, "文字字体", "思源宋体");
  const scenery = input.locator(
    'span[data-font-id="builtin-noto-serif-sc-400"]',
  );
  await expect(scenery).toHaveCount(1);
  await expect(scenery).toHaveText("风景");
  await expect(scenery).toHaveCSS(
    "font-family",
    /fp_builtin-noto-serif-sc-400/,
  );
  await expect(input).toContainText("你好风景世界");
  await page.getByLabel("文字字号", { exact: true }).fill("80");
  await expect(scenery).toHaveCSS("font-size", "80px");
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
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(block.getByText("风景", { exact: true })).toHaveCSS(
    "font-size",
    "64px",
  );
  await expect(block.getByText("风景", { exact: true })).toHaveCSS(
    "font-family",
    /fp_builtin-noto-serif-sc-400/,
  );
  await expect(block.getByText("世界", { exact: true })).toHaveCSS(
    "font-family",
    /fp_builtin-noto-sc-400/,
  );
});

test("format toggles bold only the selected words and announce their pressed state", async ({
  page,
}) => {
  await openPoster(page, "toggle");
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = await selectScenery(page);
  const bold = page.getByRole("button", { name: "粗体", exact: true });
  await expect(bold).toHaveAttribute("aria-pressed", "false");
  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "true");
  const strong = input.locator("strong");
  await expect(strong).toHaveCount(1);
  await expect(strong).toHaveText("风景");
  await expect(strong).toHaveCSS("font-weight", "700");
  await expect(input).toContainText("你好风景世界");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("风景");
  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "false");
  await expect(input.locator("strong")).toHaveCount(0);
  await expect(input).toContainText("你好风景世界");
});

/** Two valid changes inside one open picker, with the 650ms rich-text
 *  debounce allowed to elapse in between, and no close until the end. */
async function twoChangesInOnePicker(
  page: import("@playwright/test").Page,
  trigger: import("@playwright/test").Locator,
  first: string,
  second: string,
) {
  await trigger.click();
  const hex = page.locator(".ant-color-picker-hex-input input");
  await expect(hex).toBeVisible();
  await hex.fill(first);
  await page.waitForTimeout(900);
  await hex.fill(second);
  // The gesture must still own an open transaction: no save may slip out and
  // the workspace must stay in its editing state until the picker closes.
  await page.waitForTimeout(1400);
}

type SavedRichNode = {
  type: string;
  content?: SavedRichNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

async function savedDocument(page: import("@playwright/test").Page) {
  const id = page.url().split("/").at(-2)!;
  const body = await (await page.request.get(`/api/v1/projects/${id}`)).json();
  return JSON.parse(body.project.document);
}

async function savedColor(page: import("@playwright/test").Page) {
  return (await savedDocument(page)).textBlocks[0].defaultStyle.color as string;
}

/** Color of the textStyle mark on the "风景" range, or null once it is undone.
 *  That mark is the only thing keeping "风景" a standalone DOM node, so a CSS
 *  selector on getByText("风景") becomes unreliable after undo removes it. */
async function savedRangeColor(page: import("@playwright/test").Page) {
  const content = (await savedDocument(page)).textBlocks[0]
    .content as SavedRichNode;
  let found: string | null = null;
  const walk = (node: SavedRichNode) => {
    if (node.text?.includes("风景")) {
      const mark = node.marks?.find((m) => m.type === "textStyle");
      found = (mark?.attrs?.color as string | undefined) ?? null;
    }
    node.content?.forEach(walk);
  };
  walk(content);
  return found;
}

test("color gesture owns range changes until close", async ({ page }) => {
  await openPoster(page, "a03color");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "PUT" &&
      /\/api\/v1\/projects\//.test(request.url())
    )
      writes.push(request.url());
  });

  // Whole-block scope: two valid changes in one open must be a single undo.
  const trigger = page.getByLabel("文字颜色", { exact: true });
  await twoChangesInOnePicker(page, trigger, "ff0000", "0000ff");
  expect(writes).toHaveLength(0);
  await trigger.click();
  await expect(page.locator(".ant-color-picker-hex-input")).toHaveCount(0);
  await expect.poll(() => savedColor(page)).toBe("#0000ff");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect.poll(() => savedColor(page)).toBe("#284632");

  // Selected-range scope: the rich-text debounce must not commit the external
  // color transaction early, nor split it into two undo steps.
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = await selectScenery(page);
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  writes.length = 0;
  const rangeTrigger = page.getByLabel("文字颜色", { exact: true });
  await twoChangesInOnePicker(page, rangeTrigger, "ff0000", "0000ff");
  expect(writes).toHaveLength(0);
  await expect(
    page.getByText("正在编辑或上传…", { exact: true }),
  ).toBeVisible();
  await expect(input.getByText("风景", { exact: true })).toHaveCSS(
    "color",
    "rgb(0, 0, 255)",
  );
  await rangeTrigger.click();
  await expect(page.locator(".ant-color-picker-hex-input")).toHaveCount(0);
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  // The two in-picker changes collapse into one committed range transaction.
  await expect.poll(() => savedRangeColor(page)).toBe("#0000ff");
  // One undo returns to the color saved before this gesture: the mark is gone
  // and the block default is back to its original #284632.
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect.poll(() => savedRangeColor(page)).toBeNull();
  await expect.poll(() => savedColor(page)).toBe("#284632");

  // A03.1 tail: an active target switch (deleting the block) after a range
  // gesture. The gesture must close on its ORIGINAL target before the block
  // goes away: no save before it closes, and undoing the delete restores the
  // LAST VALID colour of the interrupted gesture, never the original colour
  // and never a stale draft.
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  await selectScenery(page);
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  writes.length = 0;
  const deleteTrigger = page.getByLabel("文字颜色", { exact: true });
  await twoChangesInOnePicker(page, deleteTrigger, "ff0000", "00ff00");
  expect(writes).toHaveLength(0);
  // Closing the picker commits the range gesture on its original target.
  await deleteTrigger.click();
  await expect.poll(() => savedRangeColor(page)).toBe("#00ff00");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  // Delete is an active target switch: end the old gesture on its target and
  // discard the block's drafts before the block is removed. The toolbar's
  // delete button is the same deleteSelected() entry as the shortcut.
  await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();
  await page
    .getByRole("button", { name: "删除文字块", exact: true })
    .first()
    .click();
  await expect(page.locator("[data-text-block]")).toHaveCount(0);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.locator("[data-text-block]")).toHaveCount(1);
  // The restored range keeps the last valid colour #00ff00; the whole-block
  // default was never touched by a range gesture, so it stays #284632.
  await expect.poll(() => savedRangeColor(page)).toBe("#00ff00");
  await expect.poll(() => savedColor(page)).toBe("#284632");
});

test("applies gradients to selection groups", async ({ page }) => {
  await openPoster(page, "gradient");
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = await selectScenery(page);

  // Switch the selected words to a linear gradient via the shared color panel.
  await page.getByLabel("渐变填充", { exact: true }).click();
  await page.getByRole("option", { name: "线性渐变", exact: true }).click();
  await page.getByLabel("文字颜色", { exact: true }).click();
  await page.getByLabel("渐变预设").selectOption("冷海 · 横向");
  await expect(
    input.locator('span[data-gradient-range][style*="linear-gradient"]'),
  ).toHaveCount(1);
  await page.getByLabel("关闭颜色面板").click();
  await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();

  const block = page.locator("[data-text-block]").first();
  const gradientSpan = block.locator("span[data-gradient-range]");
  await expect(gradientSpan).toHaveCount(1);
  await expect(gradientSpan).toHaveText("风景");
  // color:transparent lets the clipped gradient paint inside the glyphs.
  await expect(gradientSpan).toHaveCSS("color", "rgba(0, 0, 0, 0)");
  // background-clip keeps the gradient inside glyphs; no rectangle leaks.
  await expect(gradientSpan).toHaveCSS("-webkit-background-clip", "text");
  await expect(block.getByText("你好", { exact: true })).toHaveCSS(
    "background-image",
    "none",
  );

  // Adding the gradient and picking a preset are two gestures, hence two undo
  // steps. Undo/redo happen before reload because a reload resets history.
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(
    page
      .locator("[data-text-block]")
      .first()
      .locator("span[data-gradient-range]"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "重做", exact: true }).click();
  await page.getByRole("button", { name: "重做", exact: true }).click();
  await expect(gradientSpan).toHaveCount(1);

  // The first gradient write upgrades the document to v2 so it saves cleanly,
  // and the reloaded v2 document renders the same shared-coordinate gradient.
  await page.getByRole("button", { name: "保存作品", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator("[data-text-block]")
      .first()
      .locator("span[data-gradient-range]"),
  ).toHaveCount(1);

  // The independent export renderer paints the same gradient; verify the PNG
  // is a real 1200x1600 image and keep a sample for pixel inspection.
  const png = await exportPng(page);
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(1600);
  const outDir = process.env.FP_GRADIENT_EXPORT_OUT;
  if (outDir) await writeFile(path.join(outDir, "gradient-export.png"), png);
});

test("pasted gradient text gets a fresh range id", async ({ page }) => {
  await openPoster(page, "gpaste");
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = await selectScenery(page);
  await page.getByLabel("渐变填充", { exact: true }).click();
  await page.getByRole("option", { name: "线性渐变", exact: true }).click();
  await expect(input.locator("span[data-gradient-range]")).toHaveCount(1);

  const sourceId = await input
    .locator("span[data-gradient-range]")
    .first()
    .getAttribute("data-gradient-range");
  expect(sourceId).toBeTruthy();

  // Paste markup carrying the very same gradient payload. Reparsing must
  // allocate a fresh rangeId, otherwise the pasted fragment would join the
  // source coordinate system.
  const ids = await page.evaluate(() => {
    const editable = document.querySelector(
      '[contenteditable="true"]',
    ) as HTMLElement | null;
    const source = editable?.querySelector("span[data-gradient]");
    if (!editable || !source) throw new Error("gradient span not found");

    const transfer = new DataTransfer();
    transfer.setData("text/html", (source as HTMLElement).outerHTML);
    transfer.setData("text/plain", "风景");
    editable.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true,
      }),
    );
    return Array.from(
      editable.querySelectorAll("span[data-gradient-range]"),
    ).map((node) => node.getAttribute("data-gradient-range"));
  });

  expect(ids).toHaveLength(1);
  expect(ids[0]).toMatch(/^pasted-/);
  expect(ids[0]).not.toBe(sourceId);
});
