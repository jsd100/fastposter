import { test, expect } from "@playwright/test";
import { inspectorOption, openPoster } from "./helpers";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
test("flushes latest edits and previews the exact native PNG available for download", async ({
  page,
}) => {
  await openPoster(page, "export");
  await inspectorOption(page, "位置").click();
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
  const baseline = process.env.FP_EXPORT_BASELINE_PATH;
  if (baseline) await writeFile(baseline, await readFile(path!));
});

test("unmodified picker does not block export", async ({ page }) => {
  await openPoster(page, "a03export");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "PUT" &&
      /\/api\/v1\/projects\//.test(request.url())
    )
      writes.push(request.url());
  });
  // An open-but-unedited color picker must not start a transaction: the saved
  // state, the export control and the absence of writes all stay untouched.
  await inspectorOption(page, "效果").click();
  const trigger = page.getByLabel("文字背景色", { exact: true });
  await trigger.click();
  await expect(page.locator(".ant-color-picker-hex-input")).toBeVisible();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "导出 PNG", exact: true }),
  ).toBeEnabled();
  expect(writes).toHaveLength(0);
  await trigger.click();
  await expect(page.locator(".ant-color-picker-hex-input")).toHaveCount(0);
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(0);
  // Closing an unedited picker leaves the stored document untouched.
  const id = page.url().split("/").at(-2)!;
  const body = await (await page.request.get(`/api/v1/projects/${id}`)).json();
  const saved = JSON.parse(body.project.document);
  expect(saved.textBlocks[0].effects.backgroundColor).toBe("#00000000");
});

test("closing the export dialog mid-flight reopens the same job and unlocks the page", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openPoster(page, "export_reopen");
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const polls: string[] = [];
  await page.route("**/api/v1/exports/*", async (route) => {
    if (route.request().method() === "GET") {
      const path = new URL(route.request().url()).pathname;
      const match = path.match(/^\/api\/v1\/exports\/([^/]+)$/);
      if (match) polls.push(match[1]);
      await gate;
    }
    await route.continue();
  });
  const creates: { revision: number }[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/v1/exports"
    )
      creates.push(request.postDataJSON() as { revision: number });
  });
  const opener = page.getByRole("button", { name: "导出 PNG", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "导出海报" });
  await expect(dialog.getByText("正在排队")).toBeVisible();
  await expect.poll(() => creates.length).toBe(1);
  const first = creates[0];
  await expect(dialog.getByText(`作品版本 ${first.revision}`)).toBeVisible();
  await expect.poll(() => polls.length).toBeGreaterThan(0);
  const jobId = polls[0];
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(dialog).toHaveCount(0);

  // Editing after the dialog closed moves the saved revision, but the running
  // task keeps its own version and is reopened rather than recreated.
  await inspectorOption(page, "位置").click();
  await page.getByLabel("文本框宽度", { exact: true }).fill("560");
  await page.getByLabel("文本框宽度", { exact: true }).blur();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const watch = page.getByRole("button", { name: "查看导出", exact: true });
  await expect(watch).toBeVisible();
  await watch.click();
  await expect(dialog.getByText(`作品版本 ${first.revision}`)).toBeVisible();
  expect(creates).toHaveLength(1);
  expect(new Set(polls)).toEqual(new Set([jobId]));

  // A later draft that overflows stops new tasks only. The committed job is
  // still reachable while the current document is invalid.
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  const y = page.getByLabel("文字位置 Y", { exact: true });
  const originalY = await y.inputValue();
  await y.fill("1599");
  await y.blur();
  await expect(page.getByRole("alert")).toContainText("文字超出画布");
  await expect(watch).toBeEnabled();
  await watch.click();
  await expect(dialog.getByText("正在排队")).toBeVisible();
  release();
  await expect(
    page.getByRole("link", { name: "下载原尺寸 PNG", exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflowY))
    .toBe("");

  // A new export submits the latest saved revision, not the finished one.
  await y.fill(originalY);
  await y.blur();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const projectId = page.url().split("/").at(-2)!;
  const body = await (
    await page.request.get(`/api/v1/projects/${projectId}`)
  ).json();
  const revision = body.project.revision as number;
  await page.getByRole("button", { name: "导出 PNG", exact: true }).click();
  await expect(dialog.getByText(`作品版本 ${revision}`)).toBeVisible();
  await expect.poll(() => creates.length).toBe(2);
  expect(creates[1].revision).toBe(revision);
});
