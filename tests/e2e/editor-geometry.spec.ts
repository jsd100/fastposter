import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { inspectorOption, chooseOption, selectValue } from "./helpers";

async function exportPng(page: Page): Promise<Buffer> {
  await page.getByRole("button", { name: "导出 PNG", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "导出海报" });
  await expect(dialog).toBeVisible();
  const link = dialog.getByRole("link", {
    name: "下载原尺寸 PNG",
    exact: true,
  });
  await expect(link).toBeVisible({ timeout: 20_000 });
  const response = await page.request.get((await link.getAttribute("href"))!);
  const body = await response.body();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  return body;
}
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
  await inspectorOption(page, "位置").click();
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

async function enterEditorAs(page: Page, name: string) {
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

test("nine-grid follows the canvas without writing", async ({ page }) => {
  await editor(page);
  const gridSwitch = page.getByRole("switch", { name: "九宫格", exact: true });
  const lines = page.locator("[data-nine-grid-line]");
  await expect(gridSwitch).toBeVisible();
  await expect(gridSwitch).toHaveAttribute("aria-checked", "false");
  await expect(lines).toHaveCount(0);

  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "PUT" &&
      /\/api\/v1\/projects\//.test(request.url())
    )
      writes.push(request.url());
  });
  await gridSwitch.click();
  await expect(gridSwitch).toHaveAttribute("aria-checked", "true");
  await expect(lines).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "撤销", exact: true }),
  ).toBeDisabled();
  expect(writes).toHaveLength(0);

  const frame = page.locator("[data-poster-frame]");
  const assertAtThirds = async () => {
    const f = (await frame.boundingBox())!;
    for (const [name, ratio] of [
      ["v1", 1 / 3],
      ["v2", 2 / 3],
    ] as const) {
      const b = (await page
        .locator(`[data-nine-grid-line="${name}"]`)
        .boundingBox())!;
      expect(
        Math.abs(b.x + b.width / 2 - (f.x + f.width * ratio)),
      ).toBeLessThanOrEqual(1);
    }
    for (const [name, ratio] of [
      ["h1", 1 / 3],
      ["h2", 2 / 3],
    ] as const) {
      const b = (await page
        .locator(`[data-nine-grid-line="${name}"]`)
        .boundingBox())!;
      expect(
        Math.abs(b.y + b.height / 2 - (f.y + f.height * ratio)),
      ).toBeLessThanOrEqual(1);
    }
  };
  await assertAtThirds();

  await chooseOption(page, "预览缩放", "100%");
  await assertAtThirds();
  const stage = (await page.locator("[data-editor-stage]").boundingBox())!;
  await page.mouse.move(stage.x + 40, stage.y + 40);
  await page.mouse.down();
  await page.mouse.move(stage.x + 90, stage.y + 70, { steps: 5 });
  await page.mouse.up();
  await assertAtThirds();

  await page.getByRole("button", { name: "添加文字", exact: true }).click();
  const block = page.locator("[data-text-block]").first();
  const before = (await block.boundingBox())!;
  await page.mouse.move(before.x + 20, before.y + 20);
  await page.mouse.down();
  await page.mouse.move(before.x + 90, before.y + 60, { steps: 5 });
  await page.mouse.up();
  const moved = (await block.boundingBox())!;
  expect(moved.x - before.x).toBeGreaterThan(40);

  await gridSwitch.click();
  await expect(lines).toHaveCount(0);
  expect(writes).toHaveLength(0);
});

test("nine-grid preference is account scoped", async ({ page }) => {
  const first = "grid_scope_a_" + Date.now().toString(36);
  await enterEditorAs(page, first);
  const gridSwitch = page.getByRole("switch", { name: "九宫格", exact: true });
  await expect(gridSwitch).toHaveAttribute("aria-checked", "false");
  await gridSwitch.click();
  await expect(gridSwitch).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(
    page.getByRole("switch", { name: "九宫格", exact: true }),
  ).toHaveAttribute("aria-checked", "true");

  await page.getByRole("link", { name: "返回作品", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  const second = "grid_scope_b_" + Date.now().toString(36);
  await enterEditorAs(page, second);
  await expect(
    page.getByRole("switch", { name: "九宫格", exact: true }),
  ).toHaveAttribute("aria-checked", "false");

  await page.evaluate(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("storage blocked");
        },
        setItem: () => {
          throw new Error("storage blocked");
        },
        removeItem: () => {
          throw new Error("storage blocked");
        },
        clear: () => {
          throw new Error("storage blocked");
        },
        key: () => {
          throw new Error("storage blocked");
        },
        get length() {
          throw new Error("storage blocked");
        },
      },
    });
  });
  const fallbackSwitch = page.getByRole("switch", {
    name: "九宫格",
    exact: true,
  });
  await fallbackSwitch.click();
  await expect(fallbackSwitch).toHaveAttribute("aria-checked", "true");
});

test("nine-grid does not change exported pixels", async ({ page }) => {
  await editor(page);
  await page.getByRole("button", { name: "添加文字", exact: true }).click();
  await page.getByRole("button", { name: "保存作品", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();

  const gridSwitch = page.getByRole("switch", { name: "九宫格", exact: true });
  await expect(gridSwitch).toHaveAttribute("aria-checked", "false");
  const off = await exportPng(page);
  await gridSwitch.click();
  await expect(gridSwitch).toHaveAttribute("aria-checked", "true");
  const on = await exportPng(page);

  const outDir = process.env.FP_GRID_EXPORT_OUT;
  if (outDir) {
    await writeFile(path.join(outDir, "grid-off.png"), off);
    await writeFile(path.join(outDir, "grid-on.png"), on);
  }
  expect(off.equals(on)).toBe(true);
});
