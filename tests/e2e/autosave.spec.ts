import { test, expect } from "@playwright/test";
import { openPoster } from "./helpers";
test("autosaves and preserves a second-window conflict as a separate project", async ({
  page,
  context,
}) => {
  await openPoster(page, "autosave");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const url = page.url();
  const other = await context.newPage();
  await other.goto(url);
  await expect(other.locator("[data-text-block]")).toHaveCount(1);
  await page.getByLabel("文本框宽度", { exact: true }).fill("650");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await other.locator("[data-text-block]").first().click();
  await other.getByLabel("文本框宽度", { exact: true }).fill("550");
  await expect(
    other.getByRole("dialog", { name: "作品版本冲突" }),
  ).toBeVisible();
  await other
    .getByRole("button", { name: "将本地另存为作品", exact: true })
    .click();
  await expect(other).not.toHaveURL(url);
  await expect(other.locator("[data-text-block]")).toHaveCSS("width", "550px");
  await page.reload();
  await expect(page.locator("[data-text-block]")).toHaveCSS("width", "650px");
  const third = await context.newPage();
  await third.goto(url);
  await expect(third.locator("[data-text-block]")).toHaveCount(1);
  const current = (
    await (
      await page.request.get("/api/v1/projects/" + url.split("/").at(-2))
    ).json()
  ).project;
  const renamed = await page.request.put("/api/v1/projects/" + current.id, {
    data: {
      title: "云端改名",
      document: current.document,
      expectedRevision: current.revision,
    },
  });
  expect(renamed.ok()).toBeTruthy();
  await third.locator("[data-text-block]").click();
  await third.getByLabel("文本框宽度", { exact: true }).fill("600");
  await expect(
    third.getByRole("dialog", { name: "作品版本冲突" }),
  ).toBeVisible();
  await third
    .getByRole("button", { name: "加载云端版本", exact: true })
    .click();
  await expect(
    third.getByRole("heading", { name: "云端改名", exact: true }),
  ).toBeVisible();
  await third.locator("[data-text-block]").click();
  await third.getByLabel("文本框宽度", { exact: true }).fill("610");
  await expect(third.getByText("已保存", { exact: true })).toBeVisible();
  expect(
    (await (await page.request.get("/api/v1/projects/" + current.id)).json())
      .project.title,
  ).toBe("云端改名");
});
test("offline edits survive reload after reconnection and require a recovery choice", async ({
  page,
}) => {
  await openPoster(page, "offline");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await page.route("**/api/v1/projects/**", (route) =>
    route.request().method() === "PUT"
      ? route.abort("internetdisconnected")
      : route.continue(),
  );
  await page.getByLabel("文本框宽度", { exact: true }).fill("420");
  await expect(
    page.getByText("离线 · 草稿已保留", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/v1/projects/**");
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "发现本地草稿" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "恢复本地草稿", exact: true }).click();
  await expect(page.locator("[data-text-block]")).toHaveCSS("width", "420px");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
});
test("logoutClearsOnlyOwnDraft", async ({ page }) => {
  await openPoster(page, "logoutdraft");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const me = await (await page.request.get("/api/v1/auth/me")).json();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open("fastposter_drafts", 1);
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction("drafts", "readwrite");
        tx.objectStore("drafts").put({
          userId: "other-test-user",
          projectId: "survivor",
          title: "other",
          baseRevision: "1",
          updatedAt: Date.now(),
          pendingFiles: [],
          document: {},
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.getByRole("link", { name: "返回作品", exact: true }).click();
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  const users = await page.evaluate(
    async () =>
      new Promise<string[]>((resolve, reject) => {
        const r = indexedDB.open("fastposter_drafts", 1);
        r.onsuccess = () => {
          const db = r.result,
            q = db.transaction("drafts").objectStore("drafts").getAll();
          q.onsuccess = () => {
            resolve(q.result.map((x) => x.userId));
            db.close();
          };
          q.onerror = () => reject(q.error);
        };
      }),
  );
  expect(users).not.toContain(me.user.id);
  expect(users).toContain("other-test-user");
});
