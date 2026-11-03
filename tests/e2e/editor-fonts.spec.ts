import { test, expect, type Page } from "@playwright/test";
import { chooseOption, openPoster, selectScenery } from "./helpers";

async function projectRevision(page: Page) {
  const id = page.url().split("/").at(-2)!;
  const body = await (
    await page.request.get(`/api/v1/projects/${id}`)
  ).json();
  return body.project.revision as string;
}

async function projectDocument(page: Page) {
  const id = page.url().split("/").at(-2)!;
  const body = await (
    await page.request.get(`/api/v1/projects/${id}`)
  ).json();
  return JSON.parse(body.project.document) as {
    fonts: { assetId: string; version: string }[];
  };
}

function fontOption(page: Page, label: string) {
  return page.getByRole("listbox").getByRole("option", { name: label, exact: true });
}

async function settleSave(page: Page) {
  await expect(page.getByText("待保存", { exact: true })).toBeVisible();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
}

test("font search locates Chinese families and previews a highlight without touching the document", async ({
  page,
}) => {
  await openPoster(page, "fontsearch");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = await selectScenery(page);
  await settleSave(page);
  const before = await projectRevision(page);
  const font = page.getByLabel("文字字体", { exact: true });
  await font.click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  await font.fill("宋体");
  await expect(fontOption(page, "思源宋体")).toBeVisible();
  await expect(listbox.getByRole("option")).toHaveCount(1);
  await font.fill("文楷");
  await expect(fontOption(page, "霞鹜文楷")).toBeVisible();
  await expect(listbox.getByRole("option")).toHaveCount(1);
  await fontOption(page, "霞鹜文楷").hover();
  const preview = page.locator("[data-fp-font-preview]");
  await expect(preview).toContainText("霞鹜文楷");
  await expect(preview).toHaveCSS("font-family", /fp_builtin-lxgw-wenkai-400/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.fonts.check('16px "fp_builtin-lxgw-wenkai-400"', "海报"),
      ),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(listbox).toHaveCount(0);
  await expect(
    input.locator('span[data-font-id="builtin-lxgw-wenkai-400"]'),
  ).toHaveCount(0);
  await expect(font).toHaveValue("思源黑体");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "保存作品", exact: true }),
  ).toBeDisabled();
  expect(await projectRevision(page)).toBe(before);
});

test("preflight rejects a Latin family for Chinese text and keeps the original document exportable", async ({
  page,
}) => {
  await openPoster(page, "fontreject");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = await selectScenery(page);
  await settleSave(page);
  const before = await projectRevision(page);
  const font = page.getByLabel("文字字体", { exact: true });
  await font.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await fontOption(page, "Inter").click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(
    page.getByTestId("notice").filter({ hasText: "缺少字形" }),
  ).toBeVisible();
  await expect(
    input.locator('span[data-font-id="builtin-inter-400"]'),
  ).toHaveCount(0);
  await expect(input).toHaveCSS("font-family", /fp_builtin-noto-sc-400/);
  await expect(font).toHaveValue("思源黑体");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  expect(await projectRevision(page)).toBe(before);
  await expect(
    page.getByRole("button", { name: "导出 PNG", exact: true }),
  ).toBeEnabled();
});

test("preflight accepts a Latin family for an English selection", async ({
  page,
}) => {
  await openPoster(page, "fontlatin");
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = page.getByRole("textbox", { name: "海报文字编辑" });
  await input.fill("FastPoster");
  await input.press("ControlOrMeta+A");
  await chooseOption(page, "文字字体", "Inter");
  await expect(
    input.locator('span[data-font-id="builtin-inter-400"]'),
  ).toHaveText("FastPoster");
  await expect(
    input.getByText("FastPoster", { exact: true }),
  ).toHaveCSS("font-family", /fp_builtin-inter-400/);
});

test("a new Chinese family renders, saves, reloads and exports at the same version", async ({
  page,
}) => {
  await openPoster(page, "fontrender");
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = await selectScenery(page);
  await chooseOption(page, "文字字体", "霞鹜文楷");
  const scenery = input.locator('span[data-font-id="builtin-lxgw-wenkai-400"]');
  await expect(scenery).toHaveText("风景");
  await expect(scenery).toHaveCSS("font-family", /fp_builtin-lxgw-wenkai-400/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.fonts.check('64px "fp_builtin-lxgw-wenkai-400"', "风景"),
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();
  await page.getByRole("button", { name: "保存作品", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const saved = await projectDocument(page);
  const ref = saved.fonts.find(
    (font) => font.assetId === "builtin-lxgw-wenkai-400",
  );
  expect(ref).toBeTruthy();
  const catalog = await (await page.request.get("/api/v1/fonts")).json();
  const face = catalog.fonts.find(
    (font: { assetId: string }) =>
      font.assetId === "builtin-lxgw-wenkai-400",
  );
  expect(face.version).toBe(ref!.version);
  await page.reload();
  const restored = page
    .locator("[data-text-block]")
    .getByText("风景", { exact: true });
  await expect(restored).toHaveCSS("font-family", /fp_builtin-lxgw-wenkai-400/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.fonts.check('64px "fp_builtin-lxgw-wenkai-400"', "风景"),
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "导出 PNG", exact: true }).click();
  const download = page.getByRole("link", {
    name: "下载原尺寸 PNG",
    exact: true,
  });
  await expect(download).toBeVisible({ timeout: 20_000 });
  const response = await page.request.get((await download.getAttribute("href"))!);
  expect(response.headers()["content-type"]).toBe("image/png");
});

test("stale font checks neither apply nor toast after the selection or workspace changes", async ({
  page,
}) => {
  await openPoster(page, "fontrace");
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = await selectScenery(page);
  let seen = 0;
  let release: (action: "ok" | "fail") => void = () => {};
  await page.route("**/api/v1/fonts/check", async (route) => {
    const body = route.request().postDataJSON() as { document: string };
    if (!body.document.includes("builtin-zcool-kuaile-400"))
      return route.continue();
    seen += 1;
    const action = await new Promise<"ok" | "fail">((resolve) => {
      release = resolve;
    });
    if (action === "ok")
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    return route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({
        code: "MISSING_GLYPH",
        message: "所选字体缺少字形：风景，请更换字体",
      }),
    });
  });
  const font = page.getByLabel("文字字体", { exact: true });
  async function pickKuaile() {
    await font.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await font.fill("快乐");
    await fontOption(page, "站酷快乐体").click();
    await expect(page.getByRole("listbox")).toHaveCount(0);
  }

  // A finished check for an old selection must not be applied.
  await pickKuaile();
  await expect.poll(() => seen).toBe(1);
  await input.click();
  await input.press("ArrowLeft");
  release("ok");
  await page.waitForTimeout(300);
  await expect(
    input.locator('span[data-font-id="builtin-zcool-kuaile-400"]'),
  ).toHaveCount(0);
  await expect(font).toHaveValue("思源黑体");

  // A finished failing check must not raise a toast either.
  await pickKuaile();
  await expect.poll(() => seen).toBe(2);
  await input.click();
  await input.press("ArrowRight");
  release("fail");
  await page.waitForTimeout(300);
  await expect(
    page.getByTestId("notice").filter({ hasText: "缺少字形" }),
  ).toHaveCount(0);
  await expect(
    input.locator('span[data-font-id="builtin-zcool-kuaile-400"]'),
  ).toHaveCount(0);

  // Leaving the project drops the pending result as well.
  await pickKuaile();
  await expect.poll(() => seen).toBe(3);
  await page.getByRole("link", { name: "返回作品", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  release("fail");
  await page.waitForTimeout(300);
  await expect(
    page.getByTestId("notice").filter({ hasText: "缺少字形" }),
  ).toHaveCount(0);
});

test("a font file that fails once can be retried", async ({ page }) => {
  await openPoster(page, "fontretry");
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = await selectScenery(page);
  let failures = 0;
  await page.route(
    "**/api/v1/assets/builtin-zcool-kuaile-400/versions/*",
    async (route) => {
      if (failures++ === 0)
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            code: "INTERNAL",
            message: "字体文件读取失败",
          }),
        });
      return route.continue();
    },
  );
  const font = page.getByLabel("文字字体", { exact: true });
  await font.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await font.fill("快乐");
  await fontOption(page, "站酷快乐体").click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(
    page.getByTestId("notice").filter({ hasText: "字体加载失败" }),
  ).toBeVisible();
  await expect(
    input.locator('span[data-font-id="builtin-zcool-kuaile-400"]'),
  ).toHaveCount(0);
  await chooseOption(page, "文字字体", "站酷快乐体");
  await expect(
    input.locator('span[data-font-id="builtin-zcool-kuaile-400"]'),
  ).toHaveText("风景");
});
