import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { routes, type UserDTO } from "@fastposter/api-client";
import { Button, Dialog, Status } from "@fastposter/ui";
import { request, errorMessage } from "../api";
function Empty() {
  return <p className="admin-empty">暂无记录</p>;
}
export function Overview() {
  const q = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => request(routes.AdminOverview, {}),
    retry: false,
  });
  if (q.error) return <Status tone="error">{errorMessage(q.error)}</Status>;
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
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const cache = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "users", page, keyword],
    queryFn: () => request(routes.AdminUsers, { page, pageSize: 24, keyword }),
    retry: false,
  });
  async function confirm() {
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      const r = await request(routes.AdminUser, {
        id: target.user.id,
        action: target.action,
      });
      if (r.resetToken) setToken(r.resetToken);
      else setTarget(null);
      await cache.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>
        用户管理<span>.</span>
      </h1>
      <p className="admin-subtitle">
        禁用即时撤销会话；恢复账号后仍须重新登录。
      </p>
      <input
        className="admin-search"
        aria-label="搜索用户"
        placeholder="搜索用户名"
        value={keyword}
        onChange={(e) => {
          setKeyword(e.target.value);
          setPage(1);
        }}
      />
      {q.error && <Status tone="error">{errorMessage(q.error)}</Status>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>用户名</th>
              <th>角色</th>
              <th>状态</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.users.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.username}
                  <small>{u.id}</small>
                </td>
                <td>{u.role === "admin" ? "管理员" : "用户"}</td>
                <td>
                  <span className={u.disabled ? "badge muted-badge" : "badge"}>
                    {u.disabled ? "已禁用" : "正常"}
                  </span>
                </td>
                <td>{date(u.createdAt)}</td>
                <td>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setToken("");
                      setTarget({
                        user: u,
                        action: u.disabled ? "enable" : "disable",
                      });
                    }}
                  >
                    {u.disabled ? "恢复账号" : "禁用账号"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setToken("");
                      setTarget({ user: u, action: "reset-password" });
                    }}
                  >
                    重置密码
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {q.data?.users.length === 0 && <Empty />}
      </div>
      <Pager page={page} total={q.data?.total ?? 0} onPage={setPage} />
      {target && (
        <Dialog
          title={
            token
              ? "一次性密码重置"
              : target.action === "reset-password"
                ? "重置用户密码"
                : "修改账号状态"
          }
          onClose={() => {
            setTarget(null);
            setToken("");
          }}
        >
          {token ? (
            <>
              <p>
                已撤销旧密码和所有会话。将以下令牌交给本人，在 30 分钟内前往{" "}
                <code>/password?reset=1</code> 设置新密码。令牌只显示本次。
              </p>
              <textarea
                readOnly
                aria-label="一次性重置令牌"
                className="reset-token"
                value={token}
              />
            </>
          ) : (
            <>
              <p>确认对“{target.user.username}”执行此操作？</p>
              {error && <Status tone="error">{error}</Status>}
              <div className="dialog-actions">
                <Button onClick={() => setTarget(null)}>取消</Button>
                <Button
                  variant="primary"
                  busy={busy}
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
export function ProjectsPage() {
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState("");
  const q = useQuery({
    queryKey: ["admin", "projects", page, keyword],
    queryFn: () =>
      request(routes.AdminProjects, { page, pageSize: 24, keyword }),
    retry: false,
  });
  return (
    <>
      <h1>
        作品元数据<span>.</span>
      </h1>
      <p className="admin-subtitle">
        仅显示名称、归属、尺寸与版本。海报正文和私有图片不向管理员开放。
      </p>
      <input
        className="admin-search"
        aria-label="搜索作品元数据"
        placeholder="搜索作品名称"
        value={keyword}
        onChange={(e) => {
          setKeyword(e.target.value);
          setPage(1);
        }}
      />
      {q.error && <Status tone="error">{errorMessage(q.error)}</Status>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>作品</th>
              <th>用户 ID</th>
              <th>尺寸</th>
              <th>版本</th>
              <th>状态</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.projects.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.title}
                  <small>{p.id}</small>
                </td>
                <td className="mono">{p.ownerId}</td>
                <td>
                  {p.width} × {p.height}
                </td>
                <td>{p.revision}</td>
                <td>{p.deletedAt ? "回收站" : "正常"}</td>
                <td>{date(p.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {q.data?.projects.length === 0 && <Empty />}
      </div>
      <Pager page={page} total={q.data?.total ?? 0} onPage={setPage} />
    </>
  );
}
export function JobsPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["admin", "jobs", page],
    queryFn: () => request(routes.AdminJobs, { page, pageSize: 24 }),
    retry: false,
    refetchInterval: 5000,
  });
  return (
    <>
      <h1>
        导出任务<span>.</span>
      </h1>
      <p className="admin-subtitle">
        查看队列状态与错误类型。结果图片和正文详情仅作品所有者可读取。
      </p>
      {q.error && <Status tone="error">{errorMessage(q.error)}</Status>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>任务 ID</th>
              <th>作品 ID</th>
              <th>版本</th>
              <th>状态</th>
              <th>错误类型</th>
              <th>创建时间</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.jobs.map((j) => (
              <tr key={j.id}>
                <td className="mono">{j.id}</td>
                <td className="mono">{j.projectId}</td>
                <td>{j.revision}</td>
                <td>
                  {(
                    {
                      queued: "排队中",
                      running: "运行中",
                      succeeded: "成功",
                      failed: "失败",
                    } as Record<string, string>
                  )[j.status] ?? j.status}
                </td>
                <td>{j.errorMessage ?? "—"}</td>
                <td>{date(j.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {q.data?.jobs.length === 0 && <Empty />}
      </div>
      <Pager page={page} total={q.data?.total ?? 0} onPage={setPage} />
    </>
  );
}
export function AuditPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["admin", "audit", page],
    queryFn: () => request(routes.AdminAudit, { page, pageSize: 24 }),
    retry: false,
  });
  return (
    <>
      <h1>
        操作记录<span>.</span>
      </h1>
      <p className="admin-subtitle">
        记录操作者、动作和目标 ID；不记录密码、会话或私有文案。
      </p>
      {q.error && <Status tone="error">{errorMessage(q.error)}</Status>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>动作</th>
              <th>操作者</th>
              <th>目标 ID</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.audit.map((a) => (
              <tr key={a.id}>
                <td>{a.action}</td>
                <td className="mono">{a.actorId}</td>
                <td className="mono">{a.targetId}</td>
                <td>{date(a.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {q.data?.audit.length === 0 && <Empty />}
      </div>
      <Pager page={page} total={q.data?.total ?? 0} onPage={setPage} />
    </>
  );
}
export function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return total > 24 ? (
    <div className="pagination">
      <Button disabled={page === 1} onClick={() => onPage(page - 1)}>
        上一页
      </Button>
      <span>
        第 {page} 页 · 共 {total} 项
      </span>
      <Button disabled={page * 24 >= total} onClick={() => onPage(page + 1)}>
        下一页
      </Button>
    </div>
  ) : null;
}
function date(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}
function formatBytes(raw: string) {
  const bytes = Number(raw);
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + " MB";
  return (bytes / 1024 ** 3).toFixed(2) + " GB";
}
