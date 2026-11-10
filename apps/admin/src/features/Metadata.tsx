import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Table } from "antd";
import type { TableProps } from "antd";
import {
  ApiClientError,
  routes,
  type AuditDTO,
  type ProjectMetadataDTO,
  type UserDTO,
} from "@fastposter/api-client";
import {
  Button,
  Dialog,
  ProjectDeletionConfirm,
  Select,
  TextInput,
  Textarea,
  useErrorNotice,
} from "@fastposter/ui";
import { request, errorMessage } from "../api";
import { useResetSession } from "../main";
import {
  canPermanentlyDelete,
  ProjectDeletionQueue,
} from "./projects/ProjectDeletionQueue";
import {
  pageAfterShrink,
  adminPageIdentity,
  canCorrectAdminPage,
} from "./projects/pagination";
import {
  PAGE_SIZE,
  RecordPager,
  RecordSection,
  emptyText,
  formatDate,
} from "./records";
export function Overview() {
  const q = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => request(routes.AdminOverview, {}),
    retry: false,
  });
  useErrorNotice("admin:overview", q.error ? errorMessage(q.error) : null, {
    persistent: true,
    action: { label: "重新加载", onClick: () => void q.refetch() },
  });
  const o = q.data?.overview;
  return (
    <>
      <span className="eyebrow">WORKSPACE AT A GLANCE</span>
      <h1>
        运行概览<span>.</span>
      </h1>
      <p className="admin-subtitle">作品、资源与导出的本机运行情况。</p>
      <div className="metric-grid">
        {[
          ["注册用户", o?.users],
          ["作品数量", o?.projects],
          ["实际存储", o ? formatBytes(o.storageBytes) : "—"],
          ["成功导出", o?.successfulExports],
          ["失败导出", o?.failedExports],
        ].map(([name, value]) => (
          <div className="metric-card" key={name}>
            <span>{name}</span>
            <strong>{value ?? "—"}</strong>
          </div>
        ))}
      </div>
      <div className="admin-note">
        <h2>本地部署</h2>
        <p>
          文件保存在本机共享目录，MySQL
          持久保存作品与导出任务。下架素材会保留已有作品的版本引用。
        </p>
      </div>
    </>
  );
}
export function UsersPage() {
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState(""),
    [target, setTarget] = useState<{ user: UserDTO; action: string } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  const { phase, token, start, succeed, fail, finish, clear } =
    useResetSession();
  const locked = phase === "running" || phase === "result";
  const cache = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "users", page, keyword],
    queryFn: () =>
      request(routes.AdminUsers, { page, pageSize: PAGE_SIZE, keyword }),
    retry: false,
  });
  useErrorNotice("admin:users", q.error ? errorMessage(q.error) : null, {
    persistent: true,
    action: { label: "重新加载", onClick: () => void q.refetch() },
  });
  useErrorNotice("admin:user-action", error || null);

  /* FP-10 / Ruling 130. Local minimal classification: a well-formed 4xx
     business code is a known rejection that may be retried; 5xx,
     INVALID_RESPONSE (non-JSON), network failure and timeout leave the outcome
     unconfirmed and must never be auto-resent. */
  function resetOutcome(e: unknown): "known" | "unknown" {
    if (e instanceof ApiClientError) {
      if (e.code === "INVALID_RESPONSE") return "unknown";
      if (e.status >= 500) return "unknown";
      if (e.status >= 400) return "known";
    }
    return "unknown";
  }

  function openAction(user: UserDTO, action: string) {
    clear();
    setError("");
    setCopied(false);
    setTarget({ user, action });
  }

  async function confirm() {
    if (!target || phase === "running") return; // synchronous double-submit guard
    setError("");
    setCopied(false);
    start();
    try {
      const r = await request(routes.AdminUser, {
        id: target.user.id,
        action: target.action,
      });
      if (r.resetToken) succeed(r.resetToken);
      else {
        clear();
        setTarget(null);
      }
      await cache.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (e) {
      if (resetOutcome(e) === "unknown") fail();
      else {
        clear();
        setError(errorMessage(e));
      }
    }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(token);
    } catch {
      const el = document.createElement("textarea");
      el.value = token;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
  }

  function recheck() {
    /* Read-only list refresh + close the flow; never re-POST the reset. */
    void cache.invalidateQueries({ queryKey: ["admin", "users"] });
    clear();
    setTarget(null);
    setError("");
  }

  function done() {
    finish(); // the only action that releases the navigation lock
    setTarget(null);
    setCopied(false);
    setError("");
  }
  const columns: TableProps<UserDTO>["columns"] = [
    {
      title: "用户名",
      dataIndex: "username",
      render: (_value, user) => (
        <>
          {user.username}
          <small>{user.id}</small>
        </>
      ),
    },
    {
      title: "角色",
      dataIndex: "role",
      render: (role: string) => (role === "admin" ? "管理员" : "用户"),
    },
    {
      title: "状态",
      dataIndex: "disabled",
      render: (disabled: boolean) => (
        <span className={disabled ? "badge muted-badge" : "badge"}>
          {disabled ? "已禁用" : "正常"}
        </span>
      ),
    },
    {
      title: "注册时间",
      dataIndex: "createdAt",
      render: (value: string) => formatDate(value),
    },
    {
      title: "操作",
      key: "action",
      render: (_value, user) => (
        <>
          <Button
            variant="ghost"
            onClick={() =>
              openAction(user, user.disabled ? "enable" : "disable")
            }
          >
            {user.disabled ? "恢复账号" : "禁用账号"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => openAction(user, "reset-password")}
          >
            重置密码
          </Button>
        </>
      ),
    },
  ];
  return (
    <>
      <h1>
        用户管理<span>.</span>
      </h1>
      <p className="admin-subtitle">
        禁用即时撤销会话；恢复账号后仍须重新登录。
      </p>
      <TextInput
        variant="bare"
        className="admin-search"
        aria-label="搜索用户"
        placeholder="搜索用户名"
        value={keyword}
        onChange={(e) => {
          setKeyword(e.target.value);
          setPage(1);
        }}
      />
      <RecordSection name="用户记录">
        <div className="table-wrap">
          <Table<UserDTO>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={q.data?.users ?? []}
            loading={q.isPending}
            pagination={false}
            locale={{ emptyText: emptyText(q.isSuccess) }}
          />
        </div>
        <RecordPager
          page={page}
          total={q.data?.total ?? 0}
          onPage={setPage}
          label="用户分页"
        />
      </RecordSection>
      {target && (
        <Dialog
          title={
            phase === "result"
              ? "一次性密码重置"
              : phase === "unknown"
                ? "请核对账号状态"
                : target.action === "reset-password"
                  ? "重置用户密码"
                  : "修改账号状态"
          }
          closable={!locked}
          onClose={() => {
            if (locked) return; // no-op guard: mask / Escape / corner X
            clear();
            setTarget(null);
            setError("");
          }}
        >
          {phase === "result" ? (
            <>
              <p>
                已撤销旧密码和所有会话。将以下令牌交给本人，在 30 分钟内前往{" "}
                <code>/password?reset=1</code> 设置新密码。令牌只显示本次。
              </p>
              <Textarea
                variant="bare"
                readOnly
                aria-label="一次性重置令牌"
                className="reset-token"
                value={token}
              />
              <div className="dialog-actions">
                <Button onClick={() => void copyToken()}>复制</Button>
                {copied && <span className="reset-copied">已复制</span>}
                <Button variant="primary" onClick={done}>
                  完成
                </Button>
              </div>
            </>
          ) : phase === "unknown" ? (
            <>
              <p>
                结果未确认：无法判断本次重置是否已生效，旧凭据可能已被撤销。
              </p>
              <p>
                请重新核对账号状态；如需再次签发，请通过现有「重置密码」入口重新发起，系统不会自动重发。
              </p>
              <div className="dialog-actions">
                <Button variant="primary" onClick={recheck}>
                  重新核对账号
                </Button>
              </div>
            </>
          ) : (
            <>
              <p>确认对“{target.user.username}”执行此操作？</p>
              <div className="dialog-actions">
                {phase !== "running" && (
                  <Button
                    onClick={() => {
                      clear();
                      setTarget(null);
                    }}
                  >
                    取消
                  </Button>
                )}
                <Button
                  variant="primary"
                  busy={phase === "running"}
                  onClick={() => void confirm()}
                >
                  确认操作
                </Button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
type ProjectStatus = "all" | "normal" | "trash";
export function ProjectsPage() {
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState(""),
    [status, setStatus] = useState<ProjectStatus>("all"),
    [target, setTarget] = useState<ProjectMetadataDTO | null>(null),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  const cache = useQueryClient();
  const viewIdentity = adminPageIdentity([
    "admin-projects",
    page,
    keyword,
    status,
  ]);
  const q = useQuery({
    queryKey: ["admin", "projects", page, keyword, status],
    queryFn: async () => {
      const reply = await request(routes.AdminProjects, {
        page,
        pageSize: PAGE_SIZE,
        keyword,
        status: status === "all" ? undefined : status,
      });
      return { ...reply, __identity: viewIdentity };
    },
    retry: false,
  });
  useErrorNotice("admin:projects", q.error ? errorMessage(q.error) : null, {
    persistent: true,
    action: { label: "重新加载", onClick: () => void q.refetch() },
  });
  useErrorNotice("admin:project-deletion", actionError || null);
  useEffect(() => {
    /* FP-09 / Ruling 108. Only a successful, settled result for the current
       identity may correct the page; a failed refetch keeps the old data. */
    if (
      !q.data ||
      !canCorrectAdminPage({
        isSuccess: q.isSuccess,
        isError: q.isError,
        fetchStatus: q.fetchStatus,
        resultIdentity: q.data.__identity,
        viewIdentity,
      })
    )
      return;
    const next = pageAfterShrink(
      page,
      q.data.total,
      q.data.projects.length,
      PAGE_SIZE,
    );
    if (next !== page) setPage(next);
  }, [page, q.data, q.isSuccess, q.isError, q.fetchStatus, viewIdentity]);
  async function confirmDelete() {
    if (!target) return;
    setBusy(true);
    setActionError("");
    try {
      await request(routes.AdminPermanentlyDeleteProject, { id: target.id });
      setTarget(null);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["admin", "projects"] }),
        cache.invalidateQueries({ queryKey: ["admin", "deletions"] }),
        cache.invalidateQueries({ queryKey: ["admin", "jobs"] }),
        cache.invalidateQueries({ queryKey: ["admin", "overview"] }),
        cache.invalidateQueries({ queryKey: ["admin", "audit"] }),
      ]);
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const columns: TableProps<ProjectMetadataDTO>["columns"] = [
    {
      title: "作品",
      dataIndex: "title",
      render: (_value, project) => (
        <>
          {project.title}
          <small>{project.id}</small>
        </>
      ),
    },
    {
      title: "用户 ID",
      dataIndex: "ownerId",
      render: (ownerId: string) => <span className="mono">{ownerId}</span>,
    },
    {
      title: "尺寸",
      key: "size",
      render: (_value, project) => (
        <>
          {project.width} × {project.height}
        </>
      ),
    },
    { title: "版本", dataIndex: "revision" },
    {
      title: "状态",
      key: "state",
      render: (_value, project) => (project.deletedAt ? "回收站" : "正常"),
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      render: (value: string) => formatDate(value),
    },
    {
      title: "操作",
      key: "action",
      render: (_value, project) =>
        canPermanentlyDelete(project) && (
          <Button
            variant="ghost"
            onClick={() => {
              setActionError("");
              setTarget(project);
            }}
          >
            彻底删除
          </Button>
        ),
    },
  ];
  return (
    <>
      <h1>
        作品元数据<span>.</span>
      </h1>
      <p className="admin-subtitle">
        仅显示名称、归属、尺寸与版本。海报正文和私有图片不向管理员开放。
      </p>
      <ProjectDeletionQueue />
      <div className="admin-filters">
        <TextInput
          variant="bare"
          className="admin-search"
          aria-label="搜索作品元数据"
          placeholder="搜索作品名称"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
        />
        <Select
          aria-label="筛选作品状态"
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={[
            { value: "all", label: "全部状态" },
            { value: "normal", label: "正常" },
            { value: "trash", label: "回收站" },
          ]}
        />
      </div>
      <RecordSection name="作品元数据记录">
        <div className="table-wrap">
          <Table<ProjectMetadataDTO>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={q.data?.projects ?? []}
            loading={q.isPending}
            pagination={false}
            locale={{ emptyText: emptyText(q.isSuccess) }}
          />
        </div>
        <RecordPager
          page={page}
          total={q.data?.total ?? 0}
          onPage={setPage}
          label="作品元数据分页"
        />
      </RecordSection>
      {target && (
        <ProjectDeletionConfirm
          admin
          project={{
            id: target.id,
            title: target.title,
            ownerId: target.ownerId,
          }}
          busy={busy}
          onConfirm={() => void confirmDelete()}
          onClose={() => setTarget(null)}
        />
      )}
    </>
  );
}
export function AuditPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["admin", "audit", page],
    queryFn: () => request(routes.AdminAudit, { page, pageSize: PAGE_SIZE }),
    retry: false,
  });
  useErrorNotice("admin:audit", q.error ? errorMessage(q.error) : null, {
    persistent: true,
    action: { label: "重新加载", onClick: () => void q.refetch() },
  });
  const columns: TableProps<AuditDTO>["columns"] = [
    { title: "动作", dataIndex: "action" },
    {
      title: "操作者",
      dataIndex: "actorId",
      render: (actorId: string) => <span className="mono">{actorId}</span>,
    },
    {
      title: "目标 ID",
      dataIndex: "targetId",
      render: (targetId: string) => <span className="mono">{targetId}</span>,
    },
    {
      title: "时间",
      dataIndex: "createdAt",
      render: (value: string) => formatDate(value),
    },
  ];
  return (
    <>
      <h1>
        操作记录<span>.</span>
      </h1>
      <p className="admin-subtitle">
        记录操作者、动作和目标 ID；不记录密码、会话或私有文案。
      </p>
      <RecordSection name="操作记录">
        <div className="table-wrap">
          <Table<AuditDTO>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={q.data?.audit ?? []}
            loading={q.isPending}
            pagination={false}
            locale={{ emptyText: emptyText(q.isSuccess) }}
          />
        </div>
        <RecordPager
          page={page}
          total={q.data?.total ?? 0}
          onPage={setPage}
          label="操作记录分页"
        />
      </RecordSection>
    </>
  );
}
function formatBytes(raw: string) {
  const bytes = Number(raw);
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + " MB";
  return (bytes / 1024 ** 3).toFixed(2) + " GB";
}
