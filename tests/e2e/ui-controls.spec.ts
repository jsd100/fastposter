import { test, expect, type Page } from "@playwright/test";

const password = "a secure test password";

async function account(page: Page, name: string) {
  await page.goto("/register");
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
}

test("password form submits explicitly and secondary actions do not submit", async ({
  page,
}) => {
  const name = "ui_controls_" + Date.now().toString(36);
  let passwordRequests = 0;
  await page.route("**/api/v1/auth/password", async (route) => {
    passwordRequests += 1;
    await route.continue();
  });
  await account(page, name);

  await page.goto("/password");
  await expect(page.getByRole("heading", { name: "修改密码" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "更新密码", exact: true }),
  ).toHaveAttribute("type", "submit");

  await page.getByRole("link", { name: "返回作品" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  expect(passwordRequests).toBe(0);

  await page.goto("/password");
  await page
    .getByLabel("当前密码", { exact: true })
    .fill("not the current password");
  await page
    .getByLabel("新密码", { exact: true })
    .fill("a brand new test password");
  await page.getByRole("button", { name: "更新密码", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("当前密码不正确");
  await expect(page).toHaveURL(/\/password$/);
  expect(passwordRequests).toBe(1);

  await page.getByLabel("当前密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "更新密码", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(passwordRequests).toBe(2);

  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page
    .getByLabel("密码", { exact: true })
    .fill("a brand new test password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
});
