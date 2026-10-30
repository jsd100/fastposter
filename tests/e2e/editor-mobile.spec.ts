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
