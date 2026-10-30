import { test, expect } from "@playwright/test";
import { openPoster, selectScenery } from "./helpers";
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
  await page.getByLabel("文字颜色", { exact: true }).fill("#ff0000");
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
  await page.getByLabel("文字颜色", { exact: true }).fill("#ff0000");
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
