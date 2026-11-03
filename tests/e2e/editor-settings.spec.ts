import { test, expect, type Locator, type Page } from "@playwright/test";
import { openPoster, selectScenery } from "./helpers";

async function textFontSize(locator: Locator, needle: string) {
  return locator.evaluate((root, needle) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.includes(needle))
        return getComputedStyle(node.parentElement!).fontSize;
    }
    return "";
  }, needle);
}

async function savedDocument(page: Page) {
  await expect(page.getByText("待保存", { exact: true })).toBeVisible();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const id = page.url().split("/").at(-2)!;
  const body = await (
    await page.request.get(`/api/v1/projects/${id}`)
  ).json();
  return JSON.parse(body.project.document) as {
    textBlocks: { effects: { opacity: number; padding: number } }[];
  };
}

test("steppers adjust size, line height, spacing and opacity within their bounds", async ({
  page,
}) => {
  await openPoster(page, "settings");
  const block = page.locator("[data-text-block]").first();
  const size = page.getByLabel("文字字号", { exact: true });
  const sizeUp = page.getByRole("button", {
    name: "增加文字字号",
    exact: true,
  });
  const sizeDown = page.getByRole("button", {
    name: "减少文字字号",
    exact: true,
  });
  await expect(size).toHaveValue("64");
  await sizeUp.click();
  await expect(size).toHaveValue("65");
  await expect(block).toHaveCSS("font-size", "65px");
  await sizeDown.click();
  await expect(size).toHaveValue("64");
  await expect(block).toHaveCSS("font-size", "64px");

  const lineHeight = page.getByLabel("文字行高", { exact: true });
  const lineUp = page.getByRole("button", {
    name: "增加文字行高",
    exact: true,
  });
  await lineUp.click();
  await expect(lineHeight).toHaveValue("1.5");
  await lineUp.click();
  await expect(lineHeight).toHaveValue("1.6");
  await expect
    .poll(() => block.evaluate((el) => (el as HTMLElement).style.lineHeight))
    .toBe("1.6");

  const spacing = page.getByLabel("文字字距", { exact: true });
  const spacingDown = page.getByRole("button", {
    name: "减少文字字距",
    exact: true,
  });
  await spacingDown.click();
  await expect(spacing).toHaveValue("-1");
  await expect(block).toHaveCSS("letter-spacing", "-1px");
  const lineBox = (await lineHeight.boundingBox())!;
  const spacingBox = (await spacing.boundingBox())!;
  expect(spacingBox.y).toBeGreaterThan(lineBox.y + lineBox.height);
  expect((await size.boundingBox())!.width).toBeGreaterThan(80);

  await page.locator("summary", { hasText: "文字效果" }).click();
  const opacity = page.getByLabel("透明度", { exact: true });
  await expect(opacity).toHaveValue("100");
  await opacity.fill("50");
  await opacity.blur();
  await expect(block).toHaveCSS("opacity", "0.5");
  const opacityUp = page.getByRole("button", {
    name: "增加透明度",
    exact: true,
  });
  await opacityUp.click();
  await expect(opacity).toHaveValue("55");
  await expect(block).toHaveCSS("opacity", "0.55");
  const saved = await savedDocument(page);
  expect(saved.textBlocks[0].effects.opacity).toBe(0.55);

  await size.fill("4096");
  await size.blur();
  await expect(sizeUp).toBeDisabled();
  await size.fill("1");
  await size.blur();
  await expect(sizeDown).toBeDisabled();

  const padding = page.getByLabel("内边距", { exact: true });
  const paddingUp = page.getByRole("button", {
    name: "增加内边距",
    exact: true,
  });
  const width = Number(await page.getByLabel("文本框宽度").inputValue());
  const max = Math.max(0, width / 2 - 0.001);
  await padding.fill(String(Math.floor(max) - 1));
  await padding.blur();
  let guard = 0;
  while ((await paddingUp.isEnabled()) && guard++ < 10) await paddingUp.click();
  const finalPadding = Number(await padding.inputValue());
  expect(finalPadding).toBeLessThanOrEqual(max + 1e-9);
  expect(finalPadding).toBeGreaterThan(max - 2);
  await expect(paddingUp).toBeDisabled();
  const rendered = await block.evaluate(
    (el) => Number.parseFloat(getComputedStyle(el).paddingTop),
  );
  expect(Math.abs(rendered - finalPadding)).toBeLessThan(0.01);
});

test("a mixed font-size selection steps from its first character and undoes once", async ({
  page,
}) => {
  await openPoster(page, "mixedstep");
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = await selectScenery(page);
  const size = page.getByLabel("文字字号", { exact: true });
  await size.fill("80");
  await expect(input.getByText("风景", { exact: true })).toHaveCSS(
    "font-size",
    "80px",
  );

  await input.focus();
  await input.press("Home");
  for (let i = 0; i < 4; i++) await input.press("Shift+ArrowRight");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("你好风景");
  await expect(size).toHaveValue("");
  await expect(size).toHaveAttribute("placeholder", "混合");

  await page
    .getByRole("button", { name: "增加文字字号", exact: true })
    .click();
  await expect(size).toHaveValue("65");
  expect(await textFontSize(input, "你")).toBe("65px");
  expect(await textFontSize(input, "风")).toBe("65px");
  expect(await textFontSize(input, "世")).toBe("64px");

  await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();
  const block = page.locator("[data-text-block]").first();
  expect(await textFontSize(block, "风")).toBe("65px");
  expect(await textFontSize(block, "世")).toBe("64px");

  await page.getByRole("button", { name: "撤销", exact: true }).click();
  expect(await textFontSize(block, "你")).toBe("64px");
  expect(await textFontSize(block, "风")).toBe("80px");
  expect(await textFontSize(block, "世")).toBe("64px");
});

test("holding a stepper groups its repeats into one undo entry", async ({
  page,
}) => {
  await openPoster(page, "stepperhold");
  const block = page.locator("[data-text-block]").first();
  const size = page.getByLabel("文字字号", { exact: true });
  const plus = page.getByRole("button", {
    name: "增加文字字号",
    exact: true,
  });
  await expect(size).toHaveValue("64");
  const box = (await plus.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  const held = Number(await size.inputValue());
  expect(held).toBeGreaterThan(67);
  await expect(block).toHaveCSS("font-size", `${held}px`);

  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(size).toHaveValue("64");
  await expect(block).toHaveCSS("font-size", "64px");
});

test.describe("touch steppers", () => {
  test.use({
    viewport: { width: 360, height: 800 },
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  test("a touch step keeps the text selection and stays on screen", async ({
    page,
  }) => {
    await openPoster(page, "touchstep");
    await page.getByRole("button", { name: "编辑文字", exact: true }).click();
    const input = await selectScenery(page);
    await page.getByRole("button", { name: "文字设置", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "文字设置" });
    await expect(sheet).toBeVisible();
    const size = sheet.getByLabel("文字字号", { exact: true });
    const plus = sheet.getByRole("button", {
      name: "增加文字字号",
      exact: true,
    });
    await expect(plus).toHaveAttribute("type", "button");
    const group = sheet.locator("[data-fp-stepper]").first();
    const groupBox = (await group.boundingBox())!;
    expect(groupBox.x).toBeGreaterThanOrEqual(0);
    expect(groupBox.x + groupBox.width).toBeLessThanOrEqual(360);
    expect((await plus.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await plus.tap();
    await expect(size).toHaveValue("65");
    await plus.tap();
    await expect(size).toHaveValue("66");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);

    await page.getByRole("button", { name: "关闭", exact: true }).click();
    expect(await textFontSize(input, "风")).toBe("66px");
    expect(await textFontSize(input, "你")).toBe("64px");
    await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();
    const block = page.locator("[data-text-block]").first();
    expect(await textFontSize(block, "风")).toBe("66px");
    expect(await textFontSize(block, "世")).toBe("64px");
  });
});
