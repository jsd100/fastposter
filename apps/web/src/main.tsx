import { BrandIcon } from "@fastposter/ui";
import React, { lazy, Suspense, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationsProvider, Status, UIProvider } from "@fastposter/ui";
import { navigate, usePath } from "./router";
import { SessionProvider, useSession } from "./features/auth/Session";
import { AuthPage } from "./features/auth/AuthPage";
import { PasswordPage } from "./features/auth/PasswordPage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import "@fastposter/ui/styles.css";
import "./styles.css";

const ProjectWorkspace = lazy(() =>
  import("./features/projects/ProjectWorkspace").then((module) => ({
    default: module.ProjectWorkspace,
  })),
);
const cache = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, true), [to]);
  return null;
}
function App() {
  const path = usePath();
  const { user } = useSession();
  if (user === undefined)
    return (
      <main className="app-loading">
        <BrandIcon />
        <Status>正在打开创作空间…</Status>
      </main>
    );
  if (
    path === "/password" &&
    new URLSearchParams(location.search).get("reset") === "1"
  )
    return <PasswordPage />;
  if (!user) {
    if (path === "/register") return <AuthPage key="register" register />;
    if (path === "/login") return <AuthPage key="login" />;
    return <Redirect to="/login" />;
  }
  if (user.mustChangePassword && path !== "/password")
    return <Redirect to="/password" />;
  if (path === "/password") return <PasswordPage />;
  const editor = path.match(/^\/projects\/([a-zA-Z0-9_-]+)\/edit$/);
  if (editor)
    return (
      <Suspense
        fallback={
          <main className="app-loading">
            <Status>正在打开编辑工作台…</Status>
          </main>
        }
      >
        <ProjectWorkspace key={user.id + editor[1]} projectId={editor[1]} />
      </Suspense>
    );
  if (path === "/projects") return <ProjectsPage key={user.id} />;
  return <Redirect to="/projects" />;
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={cache}>
    <UIProvider>
      <NotificationsProvider>
        <SessionProvider>
          <App />
        </SessionProvider>
      </NotificationsProvider>
    </UIProvider>
  </QueryClientProvider>,
);
