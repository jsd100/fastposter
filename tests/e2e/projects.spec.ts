import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
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
  await page.getByLabel("rgba 的操作").click();
  await page.getByRole("button", { name: "重命名", exact: true }).click();
  await page.getByLabel("作品名称").fill("旅行日记");
  await page.getByRole("button", { name: "保存名称", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "旅行日记", exact: true }),
  ).toBeVisible();
  await page.getByLabel("旅行日记 的操作").click();
  await page.getByRole("button", { name: "复制作品", exact: true }).click();
  await expect(page.getByTestId("project-card")).toHaveCount(2);
  await page.getByLabel("旅行日记 的操作", { exact: true }).click();
  await page
    .getByTestId("project-card")
    .filter({
      has: page.getByRole("heading", { name: "旅行日记", exact: true }),
    })
    .getByRole("button", { name: "移到回收站" })
    .click();
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
