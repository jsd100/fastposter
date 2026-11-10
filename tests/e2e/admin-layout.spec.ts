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
/* Ruling 132: trace/screenshot must be off so a failing reset case cannot
   persist the synthetic token in a DOM snapshot or trace. Playwright only
   permits these two options at file scope (a describe-level use forces a new
   worker and is rejected), so this covers the whole spec file, including the
   four reset cases in the describe below. */
test.use({ actionTimeout: 8_000, trace: "off", screenshot: "off" });

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
    const trigger = phone.getByRole("button", {
      name: "导航菜单",
      exact: true,
    });
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

/**
 * A01 fix round 1 / FP-04. The full-screen template workbench isolates the
 * app root with `inert`. The admin phone nav is an antd Drawer that portals to
 * document.body by default, which would sit outside that root and keep its
 * links focusable behind the workbench. Verify that root-level isolation
 * covers the drawer's own links, that the drawer is portalled inside the
 * isolated root, that reverse Tab stays inside the workbench, and that focus
 * returns to the opener on the explicit close.
 */
test("admin workbench isolates side nav and phone drawer from tab focus", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: PHONE, hasTouch: true });
  const admin = await context.newPage();
  try {
    await login(admin);
    const trigger = admin.getByRole("button", {
      name: "导航菜单",
      exact: true,
    });
    await trigger.click();
    const drawer = admin.getByRole("dialog");
    const drawerNav = drawer.getByRole("navigation", { name: "管理导航" });
    await expect(drawerNav).toBeVisible();

    // Reproduce the workbench's `#root.inert` isolation and check the phone
    // drawer's own nav links cannot be focused through it. A body-level portal
    // escapes the inert root and stays keyboard-reachable behind the workbench.
    const leaked = await drawer.evaluate((panel) => {
      const root = document.getElementById("root")!;
      const link = panel.querySelector<HTMLElement>("a[href]");
      root.inert = true;
      link?.focus();
      const result = !!link && document.activeElement === link;
      root.inert = false;
      return result;
    });
    expect(
      leaked,
      "root-level inert must block focus on the phone drawer's nav links",
    ).toBe(false);
    const insideRoot = await drawer.evaluate((panel) => {
      const root = document.getElementById("root");
      return !!root && (root === panel || root.contains(panel));
    });
    expect(
      insideRoot,
      "phone drawer must be portalled inside #root, not document.body",
    ).toBe(true);

    // Reach the templates list through the drawer (a real navigation tap).
    await drawerNav.getByRole("link", { name: "模板", exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(admin).toHaveURL(/\/admin\/templates$/);

    const opener = admin.getByRole("button", { name: "新建模板", exact: true });
    await opener.click();
    const workbench = admin.getByRole("dialog", { name: "模板编辑器" });
    await expect(workbench).toBeVisible();
    expect(
      await admin.evaluate(() => document.getElementById("root")?.inert),
      "the workbench must isolate the whole app root",
    ).toBe(true);

    // Reverse Tab must never leak into the side nav or the drawer behind it.
    for (let i = 0; i < 12; i++) {
      await admin.keyboard.press("Shift+Tab");
      await expect
        .poll(() =>
          admin.evaluate(() => {
            const wb = document.querySelector(".workbench");
            return !!wb && wb.contains(document.activeElement);
          }),
        )
        .toBe(true);
    }

    await workbench.getByRole("button", { name: "关闭", exact: true }).click();
    await expect(workbench).toHaveCount(0);
    await expect(opener).toBeFocused();
  } finally {
    await context.close();
  }
});

/* FP-10 / A09.1 / Ruling 132. A password reset is an authorized, in-memory
   session. SYNTHETIC is NOT a secret: the real reset endpoint never issues it,
   it is never logged, and trace/screenshots are disabled for this describe so
   a failure cannot persist it. Token values use boolean comparisons only. */
const SYNTHETIC = "FP-A09-SYNTHETIC-TOKEN-NOT-A-SECRET";
const RESET_POST = /\/api\/v1\/admin\/users\/[^/?]+$/;
const USERS_GET = /\/api\/v1\/admin\/users\?/;

const RESET_USER = {
  id: "e2e-reset-user",
  username: "reset-target",
  role: "user",
  disabled: false,
  mustChangePassword: false,
  createdAt: "2026-11-05T08:00:00.000Z",
};

function stubUsers(page: Page) {
  return page.route(USERS_GET, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "e2e-reset-users",
        users: [RESET_USER],
        total: 1,
      }),
    }),
  );
}

function resetReply(token?: string) {
  return JSON.stringify({
    requestId: "e2e-reset",
    user: RESET_USER,
    ...(token ? { resetToken: token } : {}),
  });
}

async function openResetConfirm(page: Page) {
  await page
    .getByRole("button", { name: "重置密码", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "确认操作", exact: true }),
  ).toBeVisible();
  return dialog;
}

async function gotoUsers(page: Page) {
  await login(page);
  await stubUsers(page);
  await openSection(page, false, "用户管理");
  await expect(page).toHaveURL(/\/admin\/users$/);
}

test.describe("FP-10 admin reset authorization session", () => {
  test("reset token remains visible after delayed success", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await gotoUsers(page);
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    let postCount = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(RESET_POST, async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      postCount += 1;
      await gate;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: resetReply(SYNTHETIC),
      });
    });
    const dialog = await openResetConfirm(page);
    await dialog.getByRole("button", { name: "确认操作", exact: true }).click();
    await expect.poll(() => postCount).toBe(1);

    // (1) cancel: gone or disabled while the POST is running.
    const cancel = dialog.getByRole("button", { name: "取消", exact: true });
    if ((await cancel.count()) > 0 && (await cancel.isEnabled()))
      await cancel.click();
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/users$/);

    // (2) mask click in the far corner, away from the centered panel.
    await page.mouse.click(6, 6);
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/users$/);

    // (3) Escape.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/users$/);

    // (4) in-app navigation through the shell menu. The modal mask covers the
    // shell, so activate the link through its own DOM click event; the Link
    // onClick guard (Ruling 128) still runs and can preventDefault().
    await page
      .getByRole("navigation", { name: "管理导航" })
      .getByRole("link", { name: "模板", exact: true })
      .evaluate((el) => (el as HTMLElement).click());
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(dialog).toBeVisible();
    await expect(page.getByText(/请先完成/)).toBeVisible();

    release();
    const token = page.getByLabel("一次性重置令牌");
    await expect(token).toBeVisible();
    expect(postCount).toBe(1); // one POST, no duplicate confirm, no resend
    expect((await token.inputValue()) === SYNTHETIC).toBe(true);

    await dialog.getByRole("button", { name: "复制", exact: true }).click();
    await expect(dialog.getByText("已复制", { exact: true })).toBeVisible();

    // Done is the only action that releases the navigation lock.
    await dialog.getByRole("button", { name: "完成", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "管理导航" })
      .getByRole("link", { name: "模板", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/templates$/);
  });

  test("known reset failure stays retryable without auto-resend", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await gotoUsers(page);
    let postCount = 0;
    let fail = true;
    await page.route(RESET_POST, async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      postCount += 1;
      if (fail)
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            code: "INVALID_INPUT",
            message: "重置被拒绝",
            requestId: "e2e-reset",
          }),
        });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: resetReply(SYNTHETIC),
      });
    });
    const dialog = await openResetConfirm(page);
    await dialog.getByRole("button", { name: "确认操作", exact: true }).click();
    await expect(page.getByText("重置被拒绝", { exact: true })).toBeVisible();
    expect(postCount).toBe(1);
    // A known business rejection is not an unconfirmed outcome.
    await expect(page.getByText(/结果未确认|旧凭据/)).toHaveCount(0);
    await page.waitForTimeout(400);
    expect(postCount).toBe(1); // no automatic resend
    // The operator explicitly retries through the same confirm action.
    fail = false;
    await dialog.getByRole("button", { name: "确认操作", exact: true }).click();
    const token = page.getByLabel("一次性重置令牌");
    await expect(token).toBeVisible();
    expect(postCount).toBe(2);
    expect((await token.inputValue()) === SYNTHETIC).toBe(true);
  });

  test("unknown reset result from 5xx warns about revoked credentials without auto-resend", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await gotoUsers(page);
    let postCount = 0;
    let fail = true;
    await page.route(RESET_POST, async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      postCount += 1;
      if (fail)
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "UPSTREAM_UNAVAILABLE",
            message: "服务暂不可用",
            requestId: "e2e-reset",
          }),
        });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: resetReply(SYNTHETIC),
      });
    });
    const dialog = await openResetConfirm(page);
    await dialog.getByRole("button", { name: "确认操作", exact: true }).click();
    await expect(dialog.getByText(/结果未确认/)).toBeVisible();
    await expect(dialog.getByText(/旧凭据可能已被撤销/)).toBeVisible();
    expect(postCount).toBe(1);
    await page.waitForTimeout(400);
    expect(postCount).toBe(1); // no automatic resend
    // Read-only re-check closes the flow without any new write.
    await dialog
      .getByRole("button", { name: "重新核对账号", exact: true })
      .click();
    expect(postCount).toBe(1);
    await expect(dialog).toHaveCount(0);
    // Only a new explicit issuance through the existing entry creates a POST.
    fail = false;
    const again = await openResetConfirm(page);
    await again.getByRole("button", { name: "确认操作", exact: true }).click();
    const token = page.getByLabel("一次性重置令牌");
    await expect(token).toBeVisible();
    expect(postCount).toBe(2);
    expect((await token.inputValue()) === SYNTHETIC).toBe(true);
  });

  test("unknown reset result from dropped connection and non-JSON avoids auto-resend", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await gotoUsers(page);
    let postCount = 0;
    let mode: "abort" | "non-json" = "abort";
    await page.route(RESET_POST, async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      postCount += 1;
      if (mode === "abort") return route.abort("internetdisconnected");
      return route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: "not-json",
      });
    });
    // (1) dropped connection (network TypeError).
    let dialog = await openResetConfirm(page);
    await dialog.getByRole("button", { name: "确认操作", exact: true }).click();
    await expect(dialog.getByText(/结果未确认/)).toBeVisible();
    expect(postCount).toBe(1);
    await page.waitForTimeout(300);
    expect(postCount).toBe(1);
    await dialog
      .getByRole("button", { name: "重新核对账号", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    // (2) non-JSON 200 decodes as INVALID_RESPONSE: still unconfirmed.
    mode = "non-json";
    dialog = await openResetConfirm(page);
    await dialog.getByRole("button", { name: "确认操作", exact: true }).click();
    await expect(dialog.getByText(/结果未确认/)).toBeVisible();
    expect(postCount).toBe(2);
    await page.waitForTimeout(300);
    expect(postCount).toBe(2);
    await expect(
      dialog.getByRole("button", { name: "重新核对账号", exact: true }),
    ).toBeVisible();
  });
});
