import { test, expect } from "@playwright/test";
import { chooseOption, openPoster, selectScenery, setColor } from "./helpers";
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
});
