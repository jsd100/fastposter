import { BrandIcon } from "@fastposter/ui";
import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient, routes, type UserDTO } from "@fastposter/api-client";
import {
  Button,
  FormField,
  LoadingState,
  NotificationsProvider,
  Status,
  UIProvider,
  useErrorNotice,
  useNotificationScope,
  useNotify,
} from "@fastposter/ui";
import { AdminLayout } from "./AdminLayout";
import { navigate, usePath } from "./router";
import { errorMessage } from "./api";
import "@fastposter/ui/styles.css";
import "./styles.css";

const Overview = lazy(() =>
  import("./features/Metadata").then((module) => ({
    default: module.Overview,
  })),
);
const UsersPage = lazy(() =>
  import("./features/Metadata").then((module) => ({
    default: module.UsersPage,
  })),
);
const ProjectsPage = lazy(() =>
  import("./features/Metadata").then((module) => ({
    default: module.ProjectsPage,
  })),
);
const JobsPage = lazy(() =>
  import("./features/ExportJobs").then((module) => ({
    default: module.JobsPage,
  })),
);
const AuditPage = lazy(() =>
  import("./features/Metadata").then((module) => ({
    default: module.AuditPage,
  })),
);
const ResourcesPage = lazy(() =>
  import("./features/Resources").then((module) => ({
    default: module.ResourcesPage,
  })),
);
const TemplatesPage = lazy(() =>
  import("./features/templates/TemplateList").then((module) => ({
    default: module.TemplatesPage,
  })),
);
const CopyPage = lazy(() =>
  import("./features/copy/CopyPage").then((module) => ({
    default: module.CopyPage,
  })),
);
const cache = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

/* FP-10 / Ruling 126. The authorized reset session lives only in this app's
   memory: a phase plus a one-time token that is never persisted. Defining the
   provider, context and exported hook here (no new file) lets UsersPage and
   the admin shell consume the very same instance across in-app navigation. */
type ResetPhase = "idle" | "running" | "result" | "unknown";
type ResetSession = {
  phase: ResetPhase;
  token: string;
  start: () => void;
  succeed: (token: string) => void;
  fail: () => void;
  finish: () => void;
  clear: () => void;
};
const ResetSessionContext = createContext<ResetSession | null>(null);

export function ResetSessionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<ResetPhase>("idle");
  const [token, setToken] = useState("");
  const start = useCallback(() => {
    setToken("");
    setPhase("running");
  }, []);
  const succeed = useCallback((value: string) => {
    setToken(value);
    setPhase("result");
  }, []);
  /* An unconfirmed outcome (5xx / network / non-JSON) is NOT a retryable
     business rejection: old credentials may already be revoked. */
  const fail = useCallback(() => {
    setToken("");
    setPhase("unknown");
  }, []);
  const clear = useCallback(() => {
    setToken("");
    setPhase("idle");
  }, []);
  /* "完成" is the only user action that releases the navigation lock. */
  const finish = useCallback(() => {
    setToken("");
    setPhase("idle");
  }, []);
  const value = useMemo<ResetSession>(
    () => ({ phase, token, start, succeed, fail, finish, clear }),
    [phase, token, start, succeed, fail, finish, clear],
  );
  return (
    <ResetSessionContext.Provider value={value}>
      {children}
    </ResetSessionContext.Provider>
  );
}

export function useResetSession(): ResetSession {
  const session = useContext(ResetSessionContext);
  if (!session)
    throw new Error("useResetSession requires ResetSessionProvider");
  return session;
}

function AdminApp() {
  const path = usePath();
  const client = useQueryClient();
  const [user, setUser] = useState<UserDTO | null>();
  const notify = useNotify();
  const { clear, phase } = useResetSession();
  /* FP-10 / Ruling 142. An active reset flow must keep UsersPage (and its
     token Dialog) mounted regardless of `path`. This structurally covers the
     brand link, popstate/history and any internal navigate() that bypasses the
     Link onClick guard, so in-app navigation cannot lose the running result. */
  const resetActive =
    phase === "running" || phase === "result" || phase === "unknown";
  useNotificationScope(user ? user.id : "anonymous");
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
      clear();
      client.clear();
      setUser(null);
      navigate("/admin/login", true);
    };
    window.addEventListener("session-expired", expire);
    return () => {
      active = false;
      window.removeEventListener("session-expired", expire);
    };
  }, [client, clear]);
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
        <LoadingState label="正在打开管理后台…" />
      </main>
    );
  if (!user)
    return (
      <Login
        onUser={(u) => {
          clear();
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
              clear();
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
            clear();
            client.clear();
            setUser(null);
            navigate("/admin/login");
          })
          .catch((e) => notify.show({ tone: "error", title: errorMessage(e) }))
      }
    >
      <Suspense fallback={<LoadingState label="正在加载页面…" />}>
        {resetActive || path === "/admin/users" ? (
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
      </Suspense>
    </AdminLayout>
  );
}
function Login({ onUser }: { onUser: (user: UserDTO) => void }) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useErrorNotice("admin:login", error || null);
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
        <BrandIcon />
        FastPoster<small>管理后台</small>
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
        <Button variant="primary" busy={busy} type="submit">
          {" "}
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
    <UIProvider>
      <NotificationsProvider>
        <ResetSessionProvider>
          <AdminApp />
        </ResetSessionProvider>
      </NotificationsProvider>
    </UIProvider>
  </QueryClientProvider>,
);
