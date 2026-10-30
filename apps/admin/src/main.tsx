import { useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient, routes, type UserDTO } from "@fastposter/api-client";
import { Button, FormField, Status } from "@fastposter/ui";
import { AdminLayout } from "./AdminLayout";
import {
  Overview,
  UsersPage,
  ProjectsPage,
  JobsPage,
  AuditPage,
} from "./features/Metadata";
import { ResourcesPage } from "./features/Resources";
import { TemplatesPage } from "./features/templates/TemplateList";
import { CopyPage } from "./features/copy/CopyPage";
import { navigate, usePath } from "./router";
import { errorMessage } from "./api";
import "./styles.css";
const cache = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
function AdminApp() {
  const path = usePath();
  const client = useQueryClient();
  const [user, setUser] = useState<UserDTO | null>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiClient
      .request(routes.Me, {})
      .then((r) => {
        if (active) setUser(r.user);
      })
      .catch(() => {
        if (active) setUser(null);
      });
    const expire = () => {
      client.clear();
      setUser(null);
      navigate("/admin/login", true);
    };
    window.addEventListener("session-expired", expire);
    return () => {
      active = false;
      window.removeEventListener("session-expired", expire);
    };
  }, [client]);
  useEffect(() => {
    if (user === null && path !== "/admin/login")
      navigate("/admin/login", true);
    if (
      user?.role === "admin" &&
      ["/admin/login", "/admin", "/admin/"].includes(path)
    )
      navigate("/admin/overview", true);
  }, [user, path]);
  if (user === undefined)
    return (
      <main className="app-loading">
        <Status>正在打开管理后台…</Status>
      </main>
    );
  if (!user)
    return (
      <Login
        onUser={(u) => {
          client.clear();
          setUser(u);
          navigate("/admin/overview");
        }}
      />
    );
  if (user.role !== "admin")
    return (
      <main className="simple-page">
        <Status tone="error">此账号没有管理权限</Status>
        <Button
          onClick={() =>
            void apiClient.request(routes.Logout, {}).then(() => {
              client.clear();
              setUser(null);
            })
          }
        >
          退出登录
        </Button>
      </main>
    );
  return (
    <AdminLayout
      user={user}
      path={path}
      logout={() =>
        void apiClient
          .request(routes.Logout, {})
          .then(() => {
            client.clear();
            setUser(null);
            navigate("/admin/login");
          })
          .catch((e) => setError(errorMessage(e)))
      }
    >
      {error && <Status tone="error">{error}</Status>}
      {path === "/admin/users" ? (
        <UsersPage />
      ) : path === "/admin/projects" ? (
        <ProjectsPage />
      ) : path === "/admin/backgrounds" ? (
        <ResourcesPage key="background" kind="background" />
      ) : path === "/admin/templates" ? (
        <TemplatesPage />
      ) : path === "/admin/copy" ? (
        <CopyPage />
      ) : path === "/admin/fonts" ? (
        <ResourcesPage key="font" kind="font" />
      ) : path === "/admin/jobs" ? (
        <JobsPage />
      ) : path === "/admin/audit" ? (
        <AuditPage />
      ) : (
        <Overview />
      )}
    </AdminLayout>
  );
}
function Login({ onUser }: { onUser: (user: UserDTO) => void }) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await apiClient.request(routes.Login, { username, password });
      if (r.user.role !== "admin") throw Error("此账号没有管理权限");
      onUser(r.user);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-login">
      <div className="brand">
        <span className="brand-mark">Fp</span>FastPoster<small>管理后台</small>
      </div>
      <form className="panel" onSubmit={submit}>
        <span className="eyebrow">CONTENT & OPERATIONS</span>
        <h1>管理你的创作资源。</h1>
        <p>使用管理员账号登录。</p>
        <FormField
          label="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          autoFocus
        />
        <FormField
          label="密码"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && <Status tone="error">{error}</Status>}
        <Button variant="primary" busy={busy} type="submit">
          登录管理后台
        </Button>
      </form>
      <p className="admin-login-note">
        管理员账号由本机命令行创建，不开放后台注册。
      </p>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={cache}>
    <AdminApp />
  </QueryClientProvider>,
);
