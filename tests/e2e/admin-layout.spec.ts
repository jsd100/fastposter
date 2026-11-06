import { expect, test, type Page } from "@playwright/test";

/**
 * The records surface is the operator's only view of an export failure. The
 * poster body, the private image and the download URL belong to the owner, so
 * one `JobDTO` has to be presentable twice — a desktop table and a phone
 * summary — without ever showing what the contract does not expose.
 */
const ADMIN = "http://127.0.0.1:15174";
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const JOBS = /\/api\/v1\/admin\/jobs(\?|$)/;
// A control the page has not grown yet must fail the test, not stall it:
// clicks wait for the action timeout, which is unbounded by default.
test.use({ actionTimeout: 8_000 });

type JobFixture = {
  id: string;
  projectId: string;
  revision: string;
  status: string;
  errorMessage?: string;
  downloadUrl?: string;
  previewUrl?: string;
  createdAt: string;
};

function job(id: string, status: string, patch: Partial<JobFixture> = {}) {
  return {
    id,
    projectId: "project-" + id,
    revision: "rev-" + id,
    status,
    createdAt: "2026-11-05T08:00:00.000Z",
    ...patch,
  };
}

const QUEUED = job("job-1", "queued");
const RUNNING = job("job-2", "running");
const DONE = job("job-3", "succeeded");
const FAILED = job("job-4", "failed", {
  errorMessage: "字体缺失：思源黑体 Bold 无法解析",
  downloadUrl: "https://private.invalid/owner-result.png",
  previewUrl: "https://private.invalid/owner-preview.png",
});
// A status the contract does not name must still be readable as it arrived.
const UNKNOWN = job("job-5", "on_hold");
const ROWS: JobFixture[] = [QUEUED, RUNNING, DONE, FAILED, UNKNOWN];
const jobBody = (jobs: JobFixture[], total = jobs.length) =>
  JSON.stringify({ requestId: "e2e-admin-jobs", jobs, total });

async function login(page: Page) {
  await page.goto(ADMIN + "/admin/login");
  await page.getByLabel("用户名", { exact: true }).fill("admin-e2e");
  await page
    .getByLabel("密码", { exact: true })
    .fill("fastposter-test-only-password");
  await page.getByRole("button", { name: "登录管理后台", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/overview$/);
}

/** Reaches a section through the navigation this viewport actually offers. */
async function openSection(page: Page, mobile: boolean, label: string) {
  if (mobile) {
    const trigger = page.getByRole("button", { name: "导航菜单", exact: true });
    await trigger.click();
    const layer = page.getByRole("dialog");
    await expect(
      layer.getByRole("navigation", { name: "管理导航" }),
    ).toBeVisible();
    await layer.getByRole("link", { name: label, exact: true }).click();
    await expect(layer).toHaveCount(0);
    await expect(trigger).toBeFocused();
  } else {
    await page
      .getByRole("navigation", { name: "管理导航" })
      .getByRole("link", { name: label, exact: true })
      .click();
  }
}

const records = (page: Page) =>
  page.getByRole("region", { name: "导出任务记录" });
const rowOf = (page: Page, id: string) =>
  records(page).locator(`[data-admin-record="${id}"]`);
const statusOf = async (page: Page, id: string, text: string) => {
  // Exact match: the failed row also carries a "查看失败原因" action.
  await expect(rowOf(page, id).getByText(text, { exact: true })).toBeVisible();
};

test("admin job failure opens the same details on desktop and phone", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const opened: Record<string, { id: string; error: string; meta: string[] }> =
    {};
  for (const [name, viewport] of [
    ["desktop", DESKTOP],
    ["phone", PHONE],
  ] as const) {
    const context = await browser.newContext({
      viewport,
      hasTouch: viewport === PHONE,
    });
    const admin = await context.newPage();
    try {
      await login(admin);
      await admin.route(JOBS, (route) =>
        route.fulfill({
          contentType: "application/json",
          body: jobBody(ROWS),
        }),
      );
      await openSection(admin, viewport === PHONE, "导出任务");
      await expect(admin).toHaveURL(/\/admin\/jobs$/);
      await expect(records(admin).locator("[data-admin-record]")).toHaveCount(
        ROWS.length,
      );
      if (viewport === DESKTOP) {
        await expect(
          records(admin).getByRole("columnheader", {
            name: "作品 ID",
            exact: true,
          }),
        ).toBeVisible();
      } else {
        await expect(records(admin).getByRole("table")).toHaveCount(0);
      }
      statusOf(admin, QUEUED.id, "排队中");
      statusOf(admin, RUNNING.id, "运行中");
      statusOf(admin, DONE.id, "成功");
      statusOf(admin, FAILED.id, "失败");
      statusOf(admin, UNKNOWN.id, "on_hold");
      const failure = rowOf(admin, FAILED.id);
      const details = admin.getByRole("dialog", {
        name: "导出任务失败详情",
      });
      await expect(details).toHaveCount(0);
      await failure
        .getByRole("button", { name: "查看失败原因", exact: true })
        .click();
      await expect(details).toBeVisible();
      const error = details.getByTestId("job-error");
      await expect(error).toHaveText(FAILED.errorMessage ?? "");
      const meta = await details.getByTestId("job-meta").innerText();
      expect(meta).toContain(FAILED.id);
      expect(meta).toContain(FAILED.projectId);
      expect(meta).toContain(FAILED.revision);
      opened[name] = {
        id: (await failure.getAttribute("data-admin-record")) ?? "",
        error: await error.innerText(),
        meta: meta.split("\n").filter(Boolean),
      };
      // Owner-only assets are not part of the operator's view.
      await expect(details).not.toContainText("private.invalid");
      await expect(details.getByRole("link")).toHaveCount(0);
      await details.getByRole("button", { name: "关闭", exact: true }).click();
      await expect(details).toHaveCount(0);
      // Closing lands back on the action that opened it.
      await expect(
        failure.getByRole("button", { name: "查看失败原因", exact: true }),
      ).toBeFocused();
    } finally {
      await context.close();
    }
  }
  expect(opened.phone).toEqual(opened.desktop);
});

test("admin job list keeps loading, empty and failed apart", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: DESKTOP });
  const admin = await context.newPage();
  try {
    await login(admin);
    let hold = true;
    await admin.route(JOBS, async (route) => {
      if (hold) await new Promise((resolve) => setTimeout(resolve, 1_500));
      return route.fulfill({
        contentType: "application/json",
        body: jobBody([]),
      });
    });
    await openSection(admin, false, "导出任务");
    const list = records(admin);
    // Loading is announced as loading, never as an empty list.
    await expect(list.locator('[aria-busy="true"]')).toBeVisible();
    await expect(list.getByText("暂无记录", { exact: true })).toHaveCount(0);
    hold = false;
    await expect(list.getByText("暂无记录", { exact: true })).toBeVisible();
    await expect(list.locator("[data-admin-record]")).toHaveCount(0);
    await expect(list.locator('[aria-busy="true"]')).toHaveCount(0);
    // A rejected query is a third, distinguishable state.
    await admin.route(JOBS, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "WORKER_UNAVAILABLE",
          message: "e2e-jobs-unavailable",
          requestId: "e2e-admin-jobs-failed",
        }),
      }),
    );
    await admin.reload();
    await expect(
      admin.getByTestId("notice").filter({ hasText: "e2e-jobs-unavailable" }),
    ).toBeVisible();
    await expect(list.getByText("暂无记录", { exact: true })).toHaveCount(0);
    await expect(list.locator("[data-admin-record]")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("admin navigation groups records and the phone drawer returns focus", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const desktop = await browser.newContext({ viewport: DESKTOP });
  const admin = await desktop.newPage();
  try {
    await login(admin);
    const nav = admin.getByRole("navigation", { name: "管理导航" });
    await expect(nav.getByText(/账号与作品|内容资源|运行记录/)).toHaveText([
      "账号与作品",
      "内容资源",
      "运行记录",
    ]);
    for (const label of [
      "概览",
      "用户管理",
      "作品元数据",
      "背景库",
      "模板",
      "文案库",
      "字体库",
      "导出任务",
      "操作记录",
    ])
      await expect(
        nav.getByRole("link", { name: label, exact: true }),
      ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "概览", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "导出任务", exact: true }).click();
    await expect(admin).toHaveURL(/\/admin\/jobs$/);
    await expect(
      admin.getByRole("link", { name: "导出任务", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  } finally {
    await desktop.close();
  }
  const mobile = await browser.newContext({ viewport: PHONE, hasTouch: true });
  const phone = await mobile.newPage();
  try {
    await login(phone);
    const trigger = phone.getByRole("button", { name: "导航菜单", exact: true });
    await expect(
      phone.getByRole("navigation", { name: "管理导航" }),
    ).toBeHidden();
    await trigger.click();
    const layer = phone.getByRole("dialog");
    const nav = layer.getByRole("navigation", { name: "管理导航" });
    await expect(nav).toBeVisible();
    await expect(nav.getByText(/账号与作品|内容资源|运行记录/)).toHaveText([
      "账号与作品",
      "内容资源",
      "运行记录",
    ]);
    await expect(
      nav.getByRole("link", { name: "概览", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await phone.keyboard.press("Escape");
    await expect(layer).toHaveCount(0);
    await expect(trigger).toBeFocused();
  } finally {
    await mobile.close();
  }
});
