import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chooseCardAction } from "./helpers";

type DeletionDTO = {
  id: string;
  projectId: string;
  ownerId: string;
  state: string;
  createdAt: string;
  title?: string;
  width?: number;
  height?: number;
  deletedAt?: string;
};

const EVIDENCE_DIR = path.resolve(
  "docs/verification/2026-11-04-project-permanent-deletion",
);

async function evidence(page: Page, name: string) {
  if (process.env.FASTPOSTER_CAPTURE_EVIDENCE !== "1") return;
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, name),
    fullPage: true,
  });
}

async function account(page: Page, prefix: string) {
  const name = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const password = "a secure test password";
  await page.goto("/register");
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("用户名", { exact: true }).fill(name);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  return name;
}

async function upload(page: Page, fixture = "editor.png") {
  await page
    .getByLabel("导入背景图文件")
    .setInputFiles(path.resolve("tests/fixtures/images", fixture));
  await expect(page).toHaveURL(/\/projects\/[^/]+\/edit$/);
  await expect(
    page.getByRole("button", { name: "添加文字", exact: true }),
  ).toBeEnabled();
}

function card(page: Page, title: string) {
  return page
    .getByTestId("project-card")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

async function backToProjects(page: Page) {
  await page.getByRole("link", { name: "返回作品", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
}

async function renameProject(page: Page, from: string, to: string) {
  await chooseCardAction(
    page,
    card(page, from).getByLabel(`${from} 的操作`, { exact: true }),
    "重命名",
  );
  await page.getByLabel("作品名称").fill(to);
  await page.getByRole("button", { name: "保存名称", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: to, exact: true }),
  ).toBeVisible();
}

async function moveToTrash(page: Page, title: string) {
  await chooseCardAction(
    page,
    card(page, title).getByLabel(`${title} 的操作`, { exact: true }),
    "移到回收站",
  );
  await page
    .getByRole("button", { name: "确认移入回收站", exact: true })
    .click();
  await expect(card(page, title)).toHaveCount(0);
}

async function openTrash(page: Page) {
  await page.getByRole("button", { name: "回收站", exact: true }).click();
  await expect(
    page.getByText("作品暂存 30 天，随时找回你的灵感。", { exact: true }),
  ).toBeVisible();
}

function deletionDialog(page: Page) {
  return page.getByRole("dialog", { name: "彻底删除作品？" });
}

async function confirmPermanentDelete(page: Page, title: string) {
  await page
    .getByTestId("project-card")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .getByRole("button", { name: `彻底删除 ${title}`, exact: true })
    .click();
  const dialog = deletionDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "彻底删除", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

function projectId(page: Page) {
  return new URL(page.url()).pathname.split("/")[2];
}

async function readDraft(page: Page, userId: string, id: string) {
  return page.evaluate(
    ([owner, target]) =>
      new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open("fastposter_drafts", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const read = db
            .transaction("drafts")
            .objectStore("drafts")
            .get([owner, target]);
          read.onsuccess = () => {
            db.close();
            resolve(read.result ?? null);
          };
          read.onerror = () => {
            db.close();
            reject(read.error);
          };
        };
      }),
    [userId, id],
  );
}

async function adminLogin(browser: import("@playwright/test").Browser) {
  const context = await browser.newContext();
  const admin = await context.newPage();
  await admin.goto("http://127.0.0.1:15174/admin/login");
  await admin.getByLabel("用户名", { exact: true }).fill("admin-e2e");
  await admin
    .getByLabel("密码", { exact: true })
    .fill("fastposter-test-only-password");
  await admin
    .getByRole("button", { name: "登录管理后台", exact: true })
    .click();
  await expect(admin).toHaveURL(/\/admin\/overview$/);
  return { context, admin };
}

async function adminSession(
  browser: import("@playwright/test").Browser,
  target: string,
) {
  const session = await adminLogin(browser);
  await session.admin
    .getByRole("link", { name: "作品元数据", exact: true })
    .click();
  await session.admin.getByLabel("搜索作品元数据").fill(target);
  return session;
}

function deletionTask(
  index: number,
  title = `待清理任务 ${index}`,
  state = "pending",
): DeletionDTO {
  return {
    id: `mock-task-${index}`,
    projectId: `mock-project-${index}`,
    ownerId: "mock-owner",
    state,
    createdAt: "2026-11-05T00:00:00Z",
    title,
    width: 1200,
    height: 1600,
    deletedAt: "2026-11-05T00:00:00Z",
  };
}

function metadataProject(index: number, title = `测试作品 ${index}`) {
  return {
    id: `mock-project-${index}`,
    ownerId: "mock-owner",
    title,
    revision: 1,
    width: 1200,
    height: 1600,
    createdAt: "2026-11-05T00:00:00Z",
    updatedAt: "2026-11-05T00:00:00Z",
    deletedAt: "2026-11-05T00:00:00Z",
  };
}

test("deletion dialog defaults to cancel and keeps the project when dismissed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await account(page, "cancel");
  await upload(page, "rgba.png");
  await backToProjects(page);
  await moveToTrash(page, "rgba");
  await openTrash(page);
  await expect(page.getByTestId("project-card")).toHaveCount(1);

  await page
    .getByTestId("project-card")
    .getByRole("button", { name: "彻底删除 rgba", exact: true })
    .click();
  const dialog = deletionDialog(page);
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "取消", exact: true }),
  ).toBeFocused();
  await evidence(page, "user-confirm.png");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("project-card")).toHaveCount(1);
  await expect(page.getByTestId("deletion-task")).toHaveCount(0);

  await page.reload();
  await openTrash(page);
  await expect(page.getByTestId("project-card")).toHaveCount(1);
});

test("confirmed deletion exposes durable cleanup progress and survives refresh", async ({
  page,
}) => {
  await account(page, "pending");
  await upload(page, "editor.png");
  await backToProjects(page);
  await moveToTrash(page, "editor");
  await openTrash(page);

  let release!: (task: DeletionDTO) => void;
  const captured = new Promise<DeletionDTO>((resolve) => {
    release = resolve;
  });
  let first = true;
  await page.route(/\/api\/v1\/project-deletions\?/, async (route) => {
    if (!first) return route.fallback();
    first = false;
    const task = await captured;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "e2e-pending",
        deletions: [task],
        total: 1,
      }),
    });
  });

  await page
    .getByTestId("project-card")
    .getByRole("button", { name: "彻底删除 editor", exact: true })
    .click();
  const dialog = deletionDialog(page);
  const deleted = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      response.url().includes("/permanent"),
  );
  await dialog.getByRole("button", { name: "彻底删除", exact: true }).click();
  const response = await deleted;
  expect(response.status()).toBe(200);
  release((await response.json()).deletion);

  await expect(page.getByTestId("deletion-task")).toBeVisible();
  await expect(
    page.getByText("正在清理相关文件…", { exact: true }),
  ).toBeVisible();
  await evidence(page, "cleanup-pending.png");

  await expect(
    page.getByText("作品及独占资源已彻底删除，共享资源已保留。", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("deletion-task")).toHaveCount(0);

  await page.reload();
  await openTrash(page);
  await expect(page.getByText("回收站是空的", { exact: true })).toBeVisible();
  await expect(page.getByTestId("deletion-task")).toHaveCount(0);
  await expect(page.getByTestId("project-card")).toHaveCount(0);
});

test("completion feedback survives a queue that never lists the accepted task", async ({
  page,
}) => {
  await account(page, "fast");
  await upload(page, "rgba.png");
  await backToProjects(page);
  await moveToTrash(page, "rgba");
  await page.route(/\/api\/v1\/project-deletions\?/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "e2e-fast-cleanup",
        deletions: [],
        total: 0,
      }),
    }),
  );
  await openTrash(page);
  await confirmPermanentDelete(page, "rgba");
  await expect(page.getByTestId("deletion-task")).toHaveCount(0);
  await expect(
    page.getByText("作品及独占资源已彻底删除，共享资源已保留。", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 20000 });
});

test("cloned projects keep the shared background after the original is permanently deleted", async ({
  page,
}) => {
  await account(page, "share");
  await upload(page, "rgba.png");
  await backToProjects(page);
  await chooseCardAction(
    page,
    card(page, "rgba").getByLabel("rgba 的操作", { exact: true }),
    "复制作品",
  );
  await expect(page.getByTestId("project-card")).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "rgba 副本", exact: true }),
  ).toBeVisible();

  await moveToTrash(page, "rgba");
  await openTrash(page);
  await confirmPermanentDelete(page, "rgba");
  await expect(page.getByTestId("project-card")).toHaveCount(0);

  await page.getByRole("button", { name: "我的作品", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "rgba 副本", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "编辑 rgba 副本", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "添加文字", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "导出 PNG", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "下载原尺寸 PNG", exact: true }),
  ).toBeVisible({ timeout: 20000 });
});

test("administrator can only delete trashed projects after acknowledging ownership", async ({
  browser,
  page,
}) => {
  await account(page, "admin");
  const title = `admin delete ${Date.now().toString(36)}`;
  await upload(page, "rgba.png");
  const id = projectId(page);
  await backToProjects(page);
  await renameProject(page, "rgba", title);

  expect((await page.request.get("/api/v1/admin/projects")).status()).toBe(403);
  expect(
    (
      await page.request.delete(`/api/v1/admin/projects/${id}/permanent`)
    ).status(),
  ).toBe(403);

  const { context, admin } = await adminSession(browser, title);
  try {
    const normalRow = admin.getByRole("row").filter({ hasText: title });
    await expect(normalRow).toHaveCount(1);
    await expect(
      normalRow.getByRole("button", { name: "彻底删除", exact: true }),
    ).toHaveCount(0);

    await moveToTrash(page, title);
    await admin.reload();
    await admin.getByLabel("搜索作品元数据").fill(title);
    await admin.getByLabel("筛选作品状态").selectOption("trash");
    const trashedRow = admin.getByRole("row").filter({ hasText: title });
    await expect(trashedRow).toHaveCount(1);
    await trashedRow
      .getByRole("button", { name: "彻底删除", exact: true })
      .click();
    const dialog = deletionDialog(admin);
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole("button", {
      name: "彻底删除",
      exact: true,
    });
    await expect(confirm).toBeDisabled();
    await evidence(admin, "admin-confirm.png");
    await dialog.getByRole("checkbox").check();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(dialog).toHaveCount(0);
    await expect(admin.getByRole("row").filter({ hasText: title })).toHaveCount(
      0,
    );
  } finally {
    await context.close();
  }

  await page.getByRole("button", { name: "回收站", exact: true }).click();
  await expect(page.getByText("回收站是空的", { exact: true })).toBeVisible();
});

test("admin cleanup queue returns to the previous page when its last row finishes", async ({
  browser,
}) => {
  test.setTimeout(45_000);
  const { context, admin } = await adminLogin(browser);
  try {
    const firstPage = Array.from({ length: 24 }, (_, index) =>
      deletionTask(index + 1),
    );
    let pageTwoCalls = 0;
    let shrunk = false;
    await admin.route(
      /\/api\/v1\/admin\/project-deletions\?/,
      async (route) => {
        const page = new URL(route.request().url()).searchParams.get("page");
        if (page === "2") {
          pageTwoCalls++;
          if (pageTwoCalls === 1)
            return route.fulfill({
              contentType: "application/json",
              body: JSON.stringify({
                requestId: "e2e-admin-queue-25",
                deletions: [deletionTask(25, "第二页任务")],
                total: 25,
              }),
            });
          shrunk = true;
          return route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
              requestId: "e2e-admin-queue-24",
              deletions: [],
              total: 24,
            }),
          });
        }
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            requestId: "e2e-admin-queue-first",
            deletions: firstPage,
            total: shrunk ? 24 : 25,
          }),
        });
      },
    );
    const queue = admin.getByRole("region", { name: "待清理作品" });
    await admin.getByRole("link", { name: "作品元数据", exact: true }).click();
    await expect(queue.locator(".admin-queue-item")).toHaveCount(24);
    await queue.getByRole("button", { name: "下一页", exact: true }).click();
    await expect(
      queue.getByRole("heading", { name: "第二页任务", exact: true }),
    ).toBeVisible();
    await expect(queue.locator(".admin-queue-item")).toHaveCount(24, {
      timeout: 15_000,
    });
    await expect(
      queue.getByRole("heading", { name: "第二页任务", exact: true }),
    ).toHaveCount(0);
    await expect(
      queue.getByRole("button", { name: "下一页", exact: true }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("admin project list returns to the previous page after deleting its last row", async ({
  browser,
}) => {
  test.setTimeout(45_000);
  const { context, admin } = await adminLogin(browser);
  try {
    const firstPage = Array.from({ length: 24 }, (_, index) =>
      metadataProject(index + 1),
    );
    let deleted = false;
    await admin.route(/\/api\/v1\/admin\/projects\?/, async (route) => {
      const page = new URL(route.request().url()).searchParams.get("page");
      const projects =
        page === "2"
          ? deleted
            ? []
            : [metadataProject(25, "末页作品")]
          : firstPage;
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          requestId: `e2e-admin-projects-${page}`,
          projects,
          total: deleted ? 24 : 25,
        }),
      });
    });
    await admin.route(/\/api\/v1\/admin\/project-deletions\?/, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          requestId: "e2e-admin-empty-queue",
          deletions: [],
          total: 0,
        }),
      }),
    );
    await admin.route(
      /\/api\/v1\/admin\/projects\/mock-project-25\/permanent$/,
      (route) => {
        deleted = true;
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            requestId: "e2e-admin-delete-last",
            deletion: {
              ...deletionTask(25, "末页作品", "pending"),
              projectId: "mock-project-25",
            },
          }),
        });
      },
    );

    await admin.getByRole("link", { name: "作品元数据", exact: true }).click();
    await expect(admin.locator("tbody tr")).toHaveCount(24);
    await admin.getByRole("button", { name: "下一页", exact: true }).click();
    const last = admin.getByRole("row").filter({ hasText: "末页作品" });
    await expect(last).toBeVisible();
    await last.getByRole("button", { name: "彻底删除", exact: true }).click();
    const dialog = deletionDialog(admin);
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "彻底删除", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(admin.locator("tbody tr")).toHaveCount(24);
    await expect(
      admin.getByRole("row").filter({ hasText: "末页作品" }),
    ).toHaveCount(0);
    await expect(
      admin.getByRole("button", { name: "下一页", exact: true }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("permanent deletion is rejected while an export is queued or running", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await account(page, "export");
  await upload(page, "editor.png");
  const id = projectId(page);
  const detail = await (
    await page.request.get(`/api/v1/projects/${id}`)
  ).json();
  const revision = detail.project.revision;
  const keys = [`e2e-export-a-${Date.now()}`, `e2e-export-b-${Date.now()}`];
  const jobs: string[] = [];
  for (const idempotencyKey of keys) {
    const created = await page.request.post("/api/v1/exports", {
      data: { projectId: id, revision, idempotencyKey },
    });
    expect(created.ok()).toBeTruthy();
    jobs.push((await created.json()).job.id);
  }

  expect(
    (await page.request.delete(`/api/v1/projects/${id}`)).ok(),
  ).toBeTruthy();
  const rejected = await page.request.delete(
    `/api/v1/projects/${id}/permanent`,
  );
  expect(rejected.status()).toBe(409);
  const body = await rejected.json();
  expect(body.code).toBe("CONFLICT");
  expect(body.message).toContain("导出任务尚未结束");

  await expect
    .poll(
      async () => {
        for (const job of jobs) {
          const reply = await page.request.get(`/api/v1/exports/${job}`);
          const { status } = (await reply.json()).job;
          if (status === "queued" || status === "running") return "active";
        }
        return "settled";
      },
      { timeout: 60000 },
    )
    .toBe("settled");

  await page.goto("/projects");
  await openTrash(page);
  await confirmPermanentDelete(page, "editor");
  await expect(page.getByTestId("project-card")).toHaveCount(0);
});

test("deleting the only item on the last trash page returns to the previous page", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await account(page, "paging");
  await upload(page, "rgba.png");
  const first = projectId(page);
  const detail = await (
    await page.request.get(`/api/v1/projects/${first}`)
  ).json();
  const ids = [first];
  for (let index = 1; index < 25; index++) {
    const created = await page.request.post("/api/v1/projects", {
      data: { title: `分页作品 ${index}`, document: detail.project.document },
    });
    expect(created.ok()).toBeTruthy();
    ids.push((await created.json()).project.id);
  }
  for (const id of ids)
    expect(
      (await page.request.delete(`/api/v1/projects/${id}`)).ok(),
    ).toBeTruthy();

  await page.goto("/projects");
  await openTrash(page);
  const pager = page.getByRole("navigation", { name: "作品分页" });
  const currentPage = (index: number) =>
    expect(
      pager.getByRole("button", { name: `页 ${index}`, exact: true }),
    ).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("project-card")).toHaveCount(24);
  await currentPage(1);
  await pager.getByRole("button", { name: "下一页", exact: true }).click();
  await currentPage(2);
  await expect(page.getByTestId("project-card")).toHaveCount(1);

  const lastCard = page.getByTestId("project-card");
  const title = (await lastCard.locator("h3").textContent())!;
  await lastCard
    .getByRole("button", { name: `彻底删除 ${title}`, exact: true })
    .click();
  const dialog = deletionDialog(page);
  await dialog.getByRole("button", { name: "彻底删除", exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await expect(page.getByTestId("project-card")).toHaveCount(24);
  await expect(pager).toHaveCount(0);
});

test("cleanup tasks stay scoped to the account that deleted the project", async ({
  page,
}) => {
  await account(page, "scope_a");
  await upload(page, "rgba.png");
  await backToProjects(page);
  await moveToTrash(page, "rgba");
  await openTrash(page);
  await confirmPermanentDelete(page, "rgba");
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);

  await account(page, "scope_b");
  await openTrash(page);
  await expect(page.getByText("回收站是空的", { exact: true })).toBeVisible();
  await expect(page.getByTestId("deletion-task")).toHaveCount(0);
  const list = await (
    await page.request.get("/api/v1/project-deletions?page=1&pageSize=24")
  ).json();
  expect(list.total).toBe(0);
});

test("retrying one cleanup task leaves the other queue rows intact", async ({
  page,
}) => {
  await account(page, "retry_pair");
  const first = deletionTask(1, "甲任务", "retry_wait");
  const second = deletionTask(2, "乙任务", "pending");
  let listCalls = 0;
  await page.route(/\/api\/v1\/project-deletions\?/, async (route) => {
    listCalls++;
    if (listCalls > 1) return route.abort();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "e2e-retry-pair",
        deletions: [first, second],
        total: 2,
      }),
    });
  });
  await page.route(
    /\/api\/v1\/project-deletions\/mock-task-1\/retry$/,
    (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          requestId: "e2e-retry-pair-post",
          deletion: { ...first, state: "pending" },
        }),
      }),
  );

  await openTrash(page);
  await expect(page.getByTestId("deletion-task")).toHaveCount(2);
  await expect(page.getByText("乙任务", { exact: true })).toBeVisible();
  const refreshFailed = page.waitForEvent("requestfailed", (request) =>
    request.url().includes("/api/v1/project-deletions?"),
  );
  const retried = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/retry"),
  );
  await page.getByRole("button", { name: "重试清理", exact: true }).click();
  await retried;
  await refreshFailed;
  await expect(page.getByTestId("deletion-task")).toHaveCount(2);
  await expect(page.getByText("乙任务", { exact: true })).toBeVisible();
  await expect(page.getByText("甲任务", { exact: true })).toHaveCount(1);
});

test("cleanup retry state survives refresh and retries through the API", async ({
  page,
}) => {
  await account(page, "retry");
  let state = "retry_wait";
  const task = {
    id: "mock-retry-task",
    projectId: "mock-project",
    ownerId: "mock-owner",
    state,
    createdAt: new Date().toISOString(),
    deletedAt: new Date().toISOString(),
    title: "模拟清理任务",
  };
  await page.route(/\/api\/v1\/project-deletions\?/, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "e2e-retry",
        deletions: [{ ...task, state }],
        total: 1,
      }),
    });
  });
  await page.route(/\/api\/v1\/project-deletions\/[^/]+\/retry$/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "e2e-retry-post",
        deletion: { ...task, state: "pending" },
      }),
    }),
  );

  await openTrash(page);
  await expect(page.getByTestId("deletion-task")).toBeVisible();
  await expect(
    page.getByText("作品已删除，部分文件尚未清理。", { exact: true }),
  ).toBeVisible();
  await evidence(page, "cleanup-retry.png");
  await page.reload();
  await openTrash(page);
  await expect(
    page.getByText("作品已删除，部分文件尚未清理。", { exact: true }),
  ).toBeVisible();

  state = "pending";
  const retried = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().endsWith("/retry"),
  );
  await page.getByRole("button", { name: "重试清理", exact: true }).click();
  await retried;
  await expect(
    page.getByText("正在清理相关文件…", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await openTrash(page);
  await expect(
    page.getByText("正在清理相关文件…", { exact: true }),
  ).toBeVisible();
});

test("two editor tabs stop saving when the project is permanently deleted elsewhere", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  await account(page, "tabs");
  await upload(page, "editor.png");
  const url = page.url();
  const id = projectId(page);
  const me = await (await page.request.get("/api/v1/auth/me")).json();
  const userId = me.user.id;
  const second = await context.newPage();
  await second.goto(url);
  await expect(
    second.getByRole("button", { name: "添加文字", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "添加文字", exact: true }).click();
  await page.getByRole("button", { name: "编辑文字", exact: true }).click();
  const input = page.getByRole("textbox", { name: "海报文字编辑" });
  await expect(input).toBeVisible();

  let releaseSave!: () => void;
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await page.route(new RegExp(`/api/v1/projects/${id}$`), async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    await saveGate;
    await route.continue();
  });
  const saving = page.waitForRequest(
    (request) =>
      request.method() === "PUT" &&
      request.url().endsWith(`/api/v1/projects/${id}`),
  );
  await input.fill("尚未确认的本地草稿");
  await saving;
  await expect.poll(() => readDraft(page, userId, id)).toBeTruthy();

  const trash = await context.newPage();
  expect(
    (await trash.request.delete(`/api/v1/projects/${id}`)).ok(),
  ).toBeTruthy();
  await trash.goto("/projects");
  await openTrash(trash);
  await expect(trash.getByTestId("project-card")).toHaveCount(1);
  await confirmPermanentDelete(trash, "editor");

  await expect(
    page.getByText(/作品已被彻底删除，无法继续保存到原作品/),
  ).toBeVisible();
  await expect(
    second.getByText(/作品已被彻底删除，无法继续保存到原作品/),
  ).toBeVisible();
  await expect(
    second.getByText("作品已删除 · 保存已停止", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => readDraft(page, userId, id)).toBeNull();

  const late = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.url().endsWith(`/api/v1/projects/${id}`),
  );
  releaseSave();
  expect((await late).status()).toBe(404);

  await input.fill("删除后输入不应复活草稿");
  await page.waitForTimeout(1500);
  await expect.poll(() => readDraft(page, userId, id)).toBeNull();
  await expect(
    page.getByText("作品已删除 · 保存已停止", { exact: true }),
  ).toBeVisible();
});
