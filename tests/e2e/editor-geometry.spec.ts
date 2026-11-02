import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { chooseOption, selectValue } from "./helpers";
async function editor(page: Page) {
  const name = "geometry_" + Date.now().toString(36);
  await page.goto("/register");
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page
    .getByLabel("导入背景图文件")
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await expect(page).toHaveURL(/\/edit$/);
  await expect(
    page.getByRole("button", { name: "添加文字", exact: true }),
  ).toBeEnabled();
}
test("drag, width wrap, natural height and one-step geometry history", async ({
  page,
}) => {
  await editor(page);
  await page.getByRole("button", { name: "添加文字", exact: true }).click();
  const block = page.locator("[data-text-block]").first();
  const first = await block.boundingBox();
  expect(first).toBeTruthy();
  await expect(selectValue(page, "预览缩放")).toHaveText(/% · 适应$/);
  await chooseOption(page, "预览缩放", "100%");
  const before = await block.boundingBox();
  await page.mouse.move(before!.x + 20, before!.y + 20);
  await page.mouse.down();
  await page.mouse.move(before!.x + 120, before!.y + 70, { steps: 5 });
  await page.mouse.up();
  const moved = await block.boundingBox();
  expect(moved!.x - before!.x).toBeCloseTo(100, 0);
  expect(moved!.y - before!.y).toBeCloseTo(50, 0);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  const undo = await block.boundingBox();
  expect(undo!.x).toBeCloseTo(before!.x, 0);
  await page.getByRole("button", { name: "重做", exact: true }).click();
  const fullBox = await block.boundingBox();
  const widthField = page.getByLabel("文本框宽度", { exact: true });
  const documentWidth = await widthField.inputValue();
  const caption = (await page.locator(".stage-caption").textContent())!;
  await chooseOption(page, "预览缩放", "50%");
  const halfBox = await block.boundingBox();
  expect(halfBox!.width).toBeCloseTo(fullBox!.width / 2, 0);
  await expect(page.locator(".stage-caption")).toHaveText(caption);
  await expect(widthField).toHaveValue(documentWidth);
  const size = await block.evaluate((el) => getComputedStyle(el).fontSize);
  const oldHeight = await block.evaluate(
    (el) => el.getBoundingClientRect().height,
  );
  const handle = page.getByRole("button", { name: "调整右侧宽度" });
  const h = await handle.boundingBox();
  await page.mouse.move(h!.x + h!.width / 2, h!.y + h!.height / 2);
  await page.mouse.down();
  await page.mouse.move(h!.x + h!.width / 2 - 200, h!.y + h!.height / 2, {
    steps: 6,
  });
  await page.mouse.up();
  expect(await block.evaluate((el) => getComputedStyle(el).fontSize)).toBe(
    size,
  );
  expect(
    await block.evaluate((el) => el.getBoundingClientRect().height),
  ).toBeGreaterThan(oldHeight);
  await page.getByRole("button", { name: "复制文字块", exact: true }).click();
  await expect(page.locator("[data-text-block]")).toHaveCount(2);
  await page.getByRole("button", { name: "文字块后移一层" }).click();
  await page.getByRole("button", { name: "删除文字块", exact: true }).click();
  await expect(page.locator("[data-text-block]")).toHaveCount(1);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.locator("[data-text-block]")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "调整左侧宽度" })).toHaveCount(
    1,
  );
  await expect(page.locator("[data-corner-handle]")).toHaveCount(0);
  await page.getByRole("button", { name: "保存作品", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-text-block]")).toHaveCount(2);
});
