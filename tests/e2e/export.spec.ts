import { test, expect } from "@playwright/test";
import { openPoster } from "./helpers";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
test("flushes latest edits and previews the exact native PNG available for download", async ({
  page,
}) => {
  await openPoster(page, "export");
  await page.getByLabel("文本框宽度", { exact: true }).fill("600");
  await page.getByRole("button", { name: "导出 PNG", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "导出海报" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "下载原尺寸 PNG", exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  const preview = page.getByRole("img", { name: "最终导出图片" });
  await expect(preview).toBeVisible();
  const src = await preview.getAttribute("src"),
    href = await page
      .getByRole("link", { name: "下载原尺寸 PNG", exact: true })
      .getAttribute("href");
  const response = await page.request.get(href!);
  expect(response.headers()["content-type"]).toBe("image/png");
  const body = await response.body();
  expect(body.readUInt32BE(16)).toBe(1200);
  expect(body.readUInt32BE(20)).toBe(1600);
  const previewBody = await (await page.request.get(src!)).body();
  expect(createHash("sha256").update(previewBody).digest("hex")).toBe(
    createHash("sha256").update(body).digest("hex"),
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载原尺寸 PNG", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const path = await download.path();
  expect(
    createHash("sha256")
      .update(await readFile(path!))
      .digest("hex"),
  ).toBe(createHash("sha256").update(body).digest("hex"));
});
