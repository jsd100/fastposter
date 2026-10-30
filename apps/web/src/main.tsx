import React, { useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Status } from "@fastposter/ui";
import { navigate, usePath } from "./router";
import { SessionProvider, useSession } from "./features/auth/Session";
import { AuthPage } from "./features/auth/AuthPage";
import { PasswordPage } from "./features/auth/PasswordPage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { ProjectWorkspace } from "./features/projects/ProjectWorkspace";
import "./styles.css";
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
        <span className="brand-mark">Fp</span>
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
    return <ProjectWorkspace key={user.id + editor[1]} projectId={editor[1]} />;
  if (path === "/projects") return <ProjectsPage key={user.id} />;
  return <Redirect to="/projects" />;
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={cache}>
    <SessionProvider>
      <App />
    </SessionProvider>
  </QueryClientProvider>,
);
