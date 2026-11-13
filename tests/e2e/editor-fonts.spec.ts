import { test, expect, type Page } from "@playwright/test";
import {
  inspectorOption,
  chooseOption,
  openPoster,
  selectScenery,
  selectValue,
  setColor,
} from "./helpers";

type SavedMark = {
  type: string;
  attrs?: { fontId?: string; fontWeight?: number };
};
type SavedRun = { text?: string; marks?: SavedMark[] };
type SavedDocument = {
  textBlocks: {
    content: { content: { content?: SavedRun[] }[] };
    effects?: { backgroundColor?: string };
  }[];
};

function runsOf(saved: SavedDocument): SavedRun[] {
  return saved.textBlocks[0]?.content.content[0]?.content ?? [];
}

async function savedDocument(page: Page): Promise<SavedDocument> {
  const id = page.url().split("/").at(-2)!;
  const body = await (await page.request.get(`/api/v1/projects/${id}`)).json();
  return JSON.parse(body.project.document) as SavedDocument;
}

async function expectDocumentCovered(page: Page, saved: SavedDocument) {
  const checked = await page.request.post("/api/v1/fonts/check", {
    data: { document: JSON.stringify(saved) },
  });
  expect(checked.status()).toBe(200);
}

async function projectRevision(page: Page) {
  const id = page.url().split("/").at(-2)!;
  const body = await (await page.request.get(`/api/v1/projects/${id}`)).json();
  return body.project.revision as string;
}

async function projectDocument(page: Page) {
  const id = page.url().split("/").at(-2)!;
  const body = await (await page.request.get(`/api/v1/projects/${id}`)).json();
  return JSON.parse(body.project.document) as {
    fonts: { assetId: string; version: string }[];
  };
}

function fontOption(page: Page, label: string) {
  return page
    .getByRole("listbox")
    .getByRole("option", { name: label, exact: true });
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
  // The trigger hides the selected label while searching, so the typed query
  // itself has to stay legible in the input.
  await expect
    .poll(() => font.evaluate((node) => getComputedStyle(node).color))
    .not.toBe("rgba(0, 0, 0, 0)");
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
  await expect(selectValue(page, "文字字体")).toHaveText("思源黑体");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "保存作品", exact: true }),
  ).toBeDisabled();
  expect(await projectRevision(page)).toBe(before);
});

test("Latin-only fonts are disabled for a Chinese selection before a request is sent", async ({
  page,
}) => {
  await openPoster(page, "fontreject");
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  await selectScenery(page);
  await settleSave(page);
  const before = await projectRevision(page);
  let checks = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/v1/fonts/check")) checks++;
  });
  const font = page.getByLabel("文字字体", { exact: true });
  await font.click();
  await expect(fontOption(page, "Inter")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(selectValue(page, "文字字体")).toHaveText("思源黑体");
  expect(checks).toBe(0);
  expect(await projectRevision(page)).toBe(before);
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
  await expect(input.getByText("FastPoster", { exact: true })).toHaveCSS(
    "font-family",
    /fp_builtin-inter-400/,
  );
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
    (font: { assetId: string }) => font.assetId === "builtin-lxgw-wenkai-400",
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
  const response = await page.request.get(
    (await download.getAttribute("href"))!,
  );
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
  await expect(selectValue(page, "文字字体")).toHaveText("思源黑体");

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

test("a cursor font change drops inherited bold the new family cannot render", async ({
  page,
}) => {
  await openPoster(page, "fontcursorbold");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = page.getByRole("textbox", { name: "海报文字编辑" });
  await input.fill("你好");
  await input.press("ControlOrMeta+A");
  await page.getByRole("button", { name: "粗体", exact: true }).click();
  await input.focus();
  await input.press("ArrowRight");
  await chooseOption(page, "文字字体", "霞鹜文楷");
  await expect(page.getByLabel("文字字体", { exact: true })).toBeEnabled();
  await input.focus();
  await input.pressSequentially("风景");
  await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();
  await expect(page.getByText("待保存", { exact: true })).toBeVisible();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const saved = await savedDocument(page);
  const typed = runsOf(saved).find((run) => run.text?.includes("风景"));
  expect(typed).toBeTruthy();
  expect(typed!.marks?.some((mark) => mark.type === "bold")).toBe(false);
  expect(
    typed!.marks?.find((mark) => mark.type === "textStyle")?.attrs,
  ).toMatchObject({ fontId: "builtin-lxgw-wenkai-400", fontWeight: 400 });
  await expectDocumentCovered(page, saved);
});

test("a family without a bold face ignores the bold shortcut", async ({
  page,
}) => {
  await openPoster(page, "fontkeybold");
  await chooseOption(page, "文字字体", "霞鹜文楷");
  await expect(page.getByLabel("文字字体", { exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = page.getByRole("textbox", { name: "海报文字编辑" });
  await input.fill("风景");
  await input.press("ControlOrMeta+A");
  const bold = page.getByRole("button", { name: "粗体", exact: true });
  await expect(bold).toBeDisabled();
  await input.press("ControlOrMeta+B");
  await expect(bold).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();
  await expect(page.getByText("待保存", { exact: true })).toBeVisible();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const saved = await savedDocument(page);
  const run = runsOf(saved).find((item) => item.text?.includes("风景"));
  expect(run!.marks?.some((mark) => mark.type === "bold")).toBe(false);
  await expectDocumentCovered(page, saved);
});

test("a cursor keeps an explicitly chosen weight after a family change", async ({
  page,
}) => {
  await openPoster(page, "fontcursorweight");
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = page.getByRole("textbox", { name: "海报文字编辑" });
  await input.fill("Hello");
  await chooseOption(page, "文字字体", "Inter");
  await expect(page.getByLabel("文字字体", { exact: true })).toBeEnabled();
  await chooseOption(page, "文字字重", "700");
  await expect(selectValue(page, "文字字重")).toHaveText("700");
  await input.focus();
  await input.press("End");
  await input.pressSequentially("!");
  await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();
  await expect(page.getByText("待保存", { exact: true })).toBeVisible();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const saved = await savedDocument(page);
  const typed = runsOf(saved).find((run) => run.text === "!");
  expect(typed).toBeTruthy();
  expect(
    typed!.marks?.find((mark) => mark.type === "textStyle")?.attrs,
  ).toMatchObject({ fontId: "builtin-inter-700", fontWeight: 700 });
});

test("a preset color changes only selected text and survives saving and reload", async ({
  page,
}) => {
  await openPoster(page, "colorpreset");
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = await selectScenery(page);
  await chooseOption(page, "预设文字颜色", "莫兰迪 · 雾粉");
  await expect(input.getByText("风景", { exact: true })).toHaveCSS(
    "color",
    "rgb(181, 143, 145)",
  );
  const outsideColor = await input.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent === "你好")
        return getComputedStyle(node.parentElement!).color;
    }
    throw new Error("Unselected text is missing");
  });
  expect(outsideColor).not.toBe("rgb(181, 143, 145)");
  await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();
  await page.getByRole("button", { name: "保存作品", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.locator("[data-text-block]").getByText("风景", { exact: true }),
  ).toHaveCSS("color", "rgb(181, 143, 145)");
});

test("an effect color keeps its alpha, one undo step and the transparent sentinel", async ({
  page,
}) => {
  await openPoster(page, "coloralpha");
  const block = page.locator("[data-text-block]").first();
  await inspectorOption(page, "效果").click();
  await setColor(page, "文字背景色", "ff000080");
  await expect(block).toHaveCSS("background-color", "rgba(255, 0, 0, 0.5)");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(block).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await page.getByRole("button", { name: "重做", exact: true }).click();
  await expect(block).toHaveCSS("background-color", "rgba(255, 0, 0, 0.5)");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const saved = await savedDocument(page);
  expect(saved.textBlocks[0]?.effects?.backgroundColor).toBe("#ff000080");
  const backgroundField = page
    .locator("label.panel-field")
    .filter({ has: page.getByLabel("文字背景色", { exact: true }) });
  await backgroundField
    .getByRole("button", { name: "设为透明", exact: true })
    .click();
  await expect(block).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const cleared = await savedDocument(page);
  expect(cleared.textBlocks[0]?.effects?.backgroundColor).toBe("#00000000");
});

test("new bundled Chinese families load and the final choice saves, reloads and exports", async ({
  page,
}) => {
  await openPoster(page, "morefonts");
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = await selectScenery(page);
  for (const [label, id] of [
    ["马善政毛笔楷书", "builtin-mashanzheng-400"],
    ["龙藏手书", "builtin-longcang-400"],
    ["站酷庆科黄油体", "builtin-zcool-qingke-400"],
    ["刘建毛草", "builtin-liujianmaocao-400"],
  ]) {
    await chooseOption(page, "文字字体", label!);
    const text = input.locator(`span[data-font-id="${id}"]`);
    await expect(text).toHaveText("风景");
    await expect(text).toHaveCSS("font-family", new RegExp(`fp_${id}`));
    await expect
      .poll(() =>
        page.evaluate(
          (font) => document.fonts.check(`64px "fp_${font}"`, "风景"),
          id,
        ),
      )
      .toBe(true);
  }
  await page.getByRole("button", { name: "完成文字编辑", exact: true }).click();
  await page.getByRole("button", { name: "保存作品", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.locator("[data-text-block]").getByText("风景", { exact: true }),
  ).toHaveCSS("font-family", /fp_builtin-liujianmaocao-400/);
  await page.getByRole("button", { name: "导出 PNG", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "下载原尺寸 PNG", exact: true }),
  ).toBeVisible({ timeout: 30000 });
});
