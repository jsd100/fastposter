import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFile } from "node:fs/promises";

test("a genuine PNG uploaded as .jpg keeps its real format in the editor, admin catalog and export", async ({
  browser,
  page,
}) => {
  test.setTimeout(90_000);
  const spoofed = {
    name: "portrait.jpg",
    mimeType: "image/jpeg",
    buffer: await readFile(path.resolve("tests/fixtures/images/rgba.png")),
  };

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await admin.goto("http://127.0.0.1:15174/admin/login");
  await admin.getByLabel("用户名", { exact: true }).fill("admin-e2e");
  await admin
    .getByLabel("密码", { exact: true })
    .fill("fastposter-test-only-password");
  await admin
    .getByRole("button", { name: "登录管理后台", exact: true })
    .click();
  await expect(admin).toHaveURL(/\/admin\/overview$/);
  await admin.getByRole("link", { name: "背景库", exact: true }).click();
  await admin.getByRole("button", { name: "添加背景", exact: true }).click();
  await admin.getByLabel("素材名称", { exact: true }).fill("错名风景");
  await admin
    .getByLabel("背景图片文件", { exact: true })
    .setInputFiles(spoofed);
  await admin.getByLabel("立即发布", { exact: true }).check();
  await admin.getByRole("button", { name: "保存素材", exact: true }).click();
  const card = admin
    .getByTestId("resource-card")
    .filter({ hasText: "错名风景" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("4 × 3 px");
  await adminContext.close();

  const name = "spoof_" + Date.now().toString(36);
  await page.goto("/register");
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByLabel("导入背景图文件").setInputFiles(spoofed);
  await expect(page).toHaveURL(/\/projects\/[^/]+\/edit$/);
  const frame = page.locator("[data-poster-frame]");
  await expect(frame).toHaveAttribute("data-width", "4");
  await expect(frame).toHaveAttribute("data-height", "3");
  const background = page.locator(".poster-background");
  const source = await background.getAttribute("src");
  const asset = await page.request.get(source!);
  expect(asset.headers()["content-type"]).toBe("image/png");
  const assetBody = await asset.body();
  expect(assetBody.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");

  await page.getByRole("button", { name: "导出 PNG", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "下载原尺寸 PNG", exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  const href = await page
    .getByRole("link", { name: "下载原尺寸 PNG", exact: true })
    .getAttribute("href");
  const exported = await page.request.get(href!);
  expect(exported.headers()["content-type"]).toBe("image/png");
  const body = await exported.body();
  expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(body.readUInt32BE(16)).toBe(4);
  expect(body.readUInt32BE(20)).toBe(3);
});

/**
 * FP-06 / A05.1. A create that is explicitly rejected (4xx + business code)
 * is a known, uncommitted failure: the retry must re-use the asset that was
 * already uploaded for this operation instead of uploading the file again.
 * Two file selections in the same tick must also leave only one in-flight
 * write, so the submit lock is observed, not just declared.
 */
test("retrying known create rejection reuses uploaded asset", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const username = "a05_retry_" + Date.now().toString(36);
  const registered = await request.post("/api/v1/auth/register", {
    data: { username, password: "a secure test password" },
  });
  expect(registered.ok()).toBeTruthy();
  await page.goto("/login");
  await page.getByLabel("用户名", { exact: true }).fill(username);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);

  const uploadPosts: string[] = [];
  const createPosts: { assetId: string; version: string }[] = [];
  page.on("request", (req) => {
    if (req.method() !== "POST") return;
    const url = req.url();
    if (/\/api\/v1\/assets\/images(\?|$)/.test(url)) uploadPosts.push(url);
    if (/\/api\/v1\/projects(\?|$)/.test(url)) {
      const body = req.postDataJSON() as { document: string };
      const doc = JSON.parse(body.document);
      createPosts.push({
        assetId: doc.background.assetId,
        version: doc.background.version,
      });
    }
  });

  let creates = 0;
  await page.route(/\/api\/v1\/projects(\?|$)/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    creates += 1;
    if (creates === 1)
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          code: "CREATE_REJECTED",
          message: "创建被明确拒绝",
          requestId: "e2e-reject",
        }),
      });
    return route.fallback();
  });

  const png = (
    await readFile(path.resolve("tests/fixtures/images/rgba.png"))
  ).toString("base64");
  // Fire two change events in one synchronous tick. A state-based lock lets
  // both through; only a synchronous claim keeps one in-flight write.
  await page.evaluate((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="导入背景图文件"]',
    )!;
    const fire = (name: string) => {
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], name, { type: "image/png" }));
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    fire("first.png");
    fire("second.png");
  }, png);

  // Known rejection: exactly one upload, one create, a retry notice, no editor.
  await expect.poll(() => uploadPosts.length).toBe(1);
  await expect.poll(() => createPosts.length).toBe(1);
  const notice = page
    .getByTestId("notice")
    .filter({ hasText: "创建被明确拒绝" });
  await expect(notice).toHaveCount(1);
  await expect(notice.getByTestId("notice-action")).toHaveText("重试");
  await expect(page).toHaveURL(/\/projects$/);

  await notice.getByTestId("notice-action").click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/edit$/, {
    timeout: 20_000,
  });
  expect(uploadPosts).toHaveLength(1);
  expect(createPosts).toHaveLength(2);
  // The retry re-uses the very same asset reference from the first upload.
  expect(createPosts[1]).toEqual(createPosts[0]);
});
