import { expect, type Page } from "@playwright/test";
import path from "node:path";
export async function openPoster(page: Page, prefix = "rich") {
  const name = prefix + "_" + Date.now().toString(36);
  await page.goto("/register");
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill("a secure test password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page
    .getByLabel("导入背景图文件")
    .setInputFiles(path.resolve("tests/fixtures/images/editor.png"));
  await expect(page).toHaveURL(/\/edit$/);
  await expect(
    page.getByRole("button", { name: "添加文字", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "添加文字", exact: true }).click();
}
export async function selectScenery(page: Page) {
  const input = page.getByRole("textbox", { name: "海报文字编辑" });
  await input.fill("你好风景世界");
  for (let i = 0; i < 4; i++) await input.press("ArrowLeft");
  await input.press("Shift+ArrowRight");
  await input.press("Shift+ArrowRight");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("风景");
  return input;
}
export function selectTrigger(page: Page, label: string) {
  return page.getByLabel(label, { exact: true });
}
export function selectRoot(page: Page, label: string) {
  return selectTrigger(page, label).locator(
    'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " ant-select ")][1]',
  );
}
export function selectValue(page: Page, label: string) {
  return selectRoot(page, label).locator("[data-fp-select-value]");
}
export async function chooseOption(
  page: Page,
  label: string,
  optionLabel: string,
) {
  const trigger = selectTrigger(page, label);
  await expect(trigger).toBeEnabled();
  const searchable = await trigger.evaluate(
    (el) => el instanceof HTMLInputElement && !el.readOnly,
  );
  await trigger.click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  if (searchable) {
    await trigger.fill(optionLabel);
    await expect(
      listbox.getByRole("option", { name: optionLabel, exact: true }),
    ).toBeVisible();
  }
  await listbox.getByRole("option", { name: optionLabel, exact: true }).click();
  await expect(listbox).toHaveCount(0);
  await expect(selectValue(page, label)).toHaveText(optionLabel);
}
/**
 * Picks a color through the shared color panel. The hex field accepts six or
 * eight digits, so callers can exercise both opaque and translucent colors.
 */
export async function setColor(page: Page, label: string, hex: string) {
  const trigger = page.getByLabel(label, { exact: true });
  await trigger.click();
  const input = page.locator(".ant-color-picker-hex-input input");
  await expect(input).toBeVisible();
  await input.fill(hex.replace(/^#/, ""));
  // The popover is a click toggle, not an Escape layer like the selects.
  await trigger.click();
  await expect(page.locator(".ant-color-picker-hex-input")).toHaveCount(0);
}
export async function showOpenOptions(page: Page, label: string) {
  const trigger = selectTrigger(page, label);
  await trigger.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  return page.getByRole("listbox");
}
