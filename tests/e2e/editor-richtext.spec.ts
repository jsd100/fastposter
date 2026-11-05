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
  const scenery = input.locator('span[data-font-id="builtin-noto-serif-sc-400"]');
  await expect(scenery).toHaveCount(1);
  await expect(scenery).toHaveText("风景");
  await expect(scenery).toHaveCSS("font-family", /fp_builtin-noto-serif-sc-400/);
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
