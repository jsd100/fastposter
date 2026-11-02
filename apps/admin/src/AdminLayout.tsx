import { IconButton, Tooltip } from "@fastposter/ui";
import type { ReactNode } from "react";
import type { UserDTO } from "@fastposter/api-client";
import {
  LayoutDashboard,
  Users,
  Files,
  Image,
  Type,
  LayoutTemplate,
  Quote,
  Activity,
  ScrollText,
  LogOut,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "./router";
const items = [
  ["overview", "概览", LayoutDashboard],
  ["users", "用户管理", Users],
  ["projects", "作品元数据", Files],
  ["backgrounds", "背景库", Image],
  ["templates", "模板", LayoutTemplate],
  ["copy", "文案库", Quote],
  ["fonts", "字体库", Type],
  ["jobs", "导出任务", Activity],
  ["audit", "操作记录", ScrollText],
] as const;
export function AdminLayout({
  user,
  path,
  logout,
  children,
}: {
  user: UserDTO;
  path: string;
  logout: () => void;
  children: ReactNode;
}) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand" href="/admin/overview">
          <span className="brand-mark">Fp</span>FastPoster<small>管理</small>
        </Link>
        <div className="sidebar-caption">内容与运行</div>
        <nav>
          {items.map(([route, label, Icon]) => (
            <Link
              key={route}
              href={"/admin/" + route}
              className={
                path === "/admin/" + route ? "admin-nav active" : "admin-nav"
              }
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>
        <a
          className="admin-web-link"
          href={
            import.meta.env.DEV
              ? (import.meta.env.VITE_WEB_ORIGIN ?? "http://127.0.0.1:5173") +
                "/projects"
              : "/projects"
          }
          target="_blank"
          rel="noreferrer"
        >
          打开创作空间
          <ArrowUpRight size={14} />
        </a>
        <div className="admin-account">
          <span>
            {user.username}
            <small>管理员</small>
          </span>
          <Tooltip label="退出登录">
            <IconButton aria-label="退出登录" onClick={logout}>
              <LogOut size={17} />
            </IconButton>
          </Tooltip>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <span>
            管理后台 /{" "}
            {items.find(([route]) => path === "/admin/" + route)?.[1] ??
              "内容管理"}
          </span>
          <span className="admin-role-badge">ADMIN</span>
        </header>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
