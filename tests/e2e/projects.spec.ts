import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { chooseCardAction } from "./helpers";
async function account(page: Page, name: string) {
  await page.goto("/register");
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
}
test("register, create, rename, copy, delete, restore, isolate next account", async ({
  page,
}) => {
  const suffix = Date.now().toString(36);
  await account(page, "poster_" + suffix);
  await page
    .getByLabel("导入背景图文件")
    .setInputFiles(path.resolve("tests/fixtures/images/rgba.png"));
  await expect(page).toHaveURL(/\/projects\/[^/]+\/edit/);
  await page.getByRole("link", { name: "返回作品", exact: true }).click();
  await expect(page.getByTestId("project-card")).toHaveCount(1);
  await chooseCardAction(page, page.getByLabel("rgba 的操作"), "重命名");
  await page.getByLabel("作品名称").fill("旅行日记");
  await page.getByRole("button", { name: "保存名称", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "旅行日记", exact: true }),
  ).toBeVisible();
  await chooseCardAction(page, page.getByLabel("旅行日记 的操作"), "复制作品");
  await expect(page.getByTestId("project-card")).toHaveCount(2);
  await chooseCardAction(
    page,
    page.getByLabel("旅行日记 的操作", { exact: true }),
    "移到回收站",
  );
  await page.getByRole("button", { name: "确认移入回收站" }).click();
  await expect(page.getByTestId("project-card")).toHaveCount(1);
  await page.getByRole("button", { name: "回收站", exact: true }).click();
  await expect(page.getByTestId("project-card")).toHaveCount(1);
  await page.getByRole("button", { name: "恢复作品" }).click();
  await expect(page.getByTestId("project-card")).toHaveCount(0);
  await page.getByRole("button", { name: "我的作品", exact: true }).click();
  await expect(page.getByTestId("project-card")).toHaveCount(2);
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await account(page, "second_" + suffix);
  await expect(page.getByTestId("project-card")).toHaveCount(0);
  await expect(page.getByText("旅行日记", { exact: true })).toHaveCount(0);
});
test("360px viewport keeps critical controls within screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await account(page, "mobile_" + Date.now().toString(36));
  await expect(
    page.getByRole("button", { name: "新建海报", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  for (const name of ["新建海报", "我的作品", "回收站"]) {
    const box = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  }
});
/**
 * Imports one poster so the session holds a document the server accepts, then
 * clones it under `${title} 01..NN`. Leaves the browser in the editor and
 * returns the document every seeded project shares.
 */
async function seedGallery(page: Page, title: string, count: number) {
  await page
    .getByLabel("导入背景图文件")
    .setInputFiles(path.resolve("tests/fixtures/images/rgba.png"));
  await expect(page).toHaveURL(/\/edit$/);
  const id = new URL(page.url()).pathname.split("/")[2];
  const detail = await (await page.request.get(`/api/v1/projects/${id}`)).json();
  for (let index = 1; index <= count; index++) {
    const created = await page.request.post("/api/v1/projects", {
      data: {
        title: `${title} ${String(index).padStart(2, "0")}`,
        document: detail.project.document,
      },
    });
    expect(created.ok()).toBeTruthy();
  }
  return detail.project.document as string;
}
test("return to filtered gallery restores page and scroll for the same account", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const suffix = Date.now().toString(36);
  const search = page.getByLabel("搜索作品", { exact: true });
  const pager = page.getByRole("navigation", { name: "作品分页" });
  const pagerPage = (index: number) =>
    expect(
      pager.getByRole("button", { name: `页 ${index}`, exact: true }),
    ).toHaveAttribute("aria-current", "page");

  await account(page, "gallery_" + suffix);
  const documentJson = await seedGallery(page, "画廊作品", 32);
  // One newest work the keyword cannot match: while the keyword is still
  // debounced it sits at the top of the first page, so its absence is the
  // signal that the filtered result is the one on screen.
  const sentinel = "不落入选 99";
  expect(
    (
      await page.request.post("/api/v1/projects", {
        data: { title: sentinel, document: documentJson },
      })
    ).ok(),
  ).toBeTruthy();

  // A filtered gallery that really has a second page to scroll through.
  await page.goto("/projects");
  await search.fill("画廊作品");
  await expect(
    page.getByTestId("project-card").filter({ hasText: sentinel }),
  ).toHaveCount(0);
  await pagerPage(1);
  await expect(page.getByTestId("project-card")).toHaveCount(24);
  await pager.getByRole("button", { name: "下一页", exact: true }).click();
  await pagerPage(2);
  await expect(page.getByTestId("project-card")).toHaveCount(8);

  await page.evaluate(() => window.scrollTo(0, 240));
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(0);
  // The card on screen when the work is opened is the one on screen again
  // on the way back.
  const topTitle = await page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>("[data-testid='project-card']"),
    );
    const visible = cards.find((card) => {
      const box = card.getBoundingClientRect();
      return box.bottom > 0 && box.top < window.innerHeight;
    });
    return visible?.querySelector("h3")?.textContent ?? "";
  });
  expect(topTitle).not.toBe("");

  await page
    .getByRole("link", { name: `编辑 ${topTitle}`, exact: true })
    .click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/edit$/);
  await expect(
    page.getByRole("button", { name: "添加文字", exact: true }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "返回作品", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);

  await expect(search).toHaveValue("画廊作品");
  await pagerPage(2);
  await expect(page.getByTestId("project-card")).toHaveCount(8);
  await expect(
    page.getByTestId("project-card").locator("h3").first(),
  ).toHaveText(topTitle);
  await expect
    .poll(async () =>
      Math.abs((await page.evaluate(() => window.scrollY)) - scrolled),
    )
    .toBeLessThanOrEqual(8);

  // A different account starts clean in the same App session: the previous
  // account's keyword and page are not carried over.
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await account(page, "second_" + suffix);
  await seedGallery(page, "另一空间", 25);
  await page.getByRole("link", { name: "返回作品", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(search).toHaveValue("");
  // The works above arrive through the API, not through this app instance, so
  // the gallery needs a fresh request to list them.
  await page.goto("/projects");
  await pagerPage(1);
  await expect(page.getByTestId("project-card")).toHaveCount(24);
  const titles = await page
    .getByTestId("project-card")
    .locator("h3")
    .allTextContents();
  expect(titles[0]).toContain("另一空间");
  expect(titles.some((title) => title.includes("画廊作品"))).toBe(false);
});
