import { BrandIcon, IconButton, Tooltip } from "@fastposter/ui";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Drawer, Menu } from "antd";
import type { MenuProps } from "antd";
import type { UserDTO } from "@fastposter/api-client";
import type { LucideIcon } from "lucide-react";
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
  Menu as MenuIcon,
} from "lucide-react";
import { Link } from "./router";
import { useResetSession } from "./main";

/**
 * Navigation is grouped by what an operator is doing: tending accounts and
 * works, tending the material library, then reading what the machine did.
 */
type NavEntry = { route: string; label: string; icon: LucideIcon };

const groups: { caption: string; entries: NavEntry[] }[] = [
  {
    caption: "账号与作品",
    entries: [
      { route: "overview", label: "概览", icon: LayoutDashboard },
      { route: "users", label: "用户管理", icon: Users },
      { route: "projects", label: "作品元数据", icon: Files },
    ],
  },
  {
    caption: "内容资源",
    entries: [
      { route: "backgrounds", label: "背景库", icon: Image },
      { route: "templates", label: "模板", icon: LayoutTemplate },
      { route: "copy", label: "文案库", icon: Quote },
      { route: "fonts", label: "字体库", icon: Type },
    ],
  },
  {
    caption: "运行记录",
    entries: [
      { route: "jobs", label: "导出任务", icon: Activity },
      { route: "audit", label: "操作记录", icon: ScrollText },
    ],
  },
];

const items = groups.flatMap((group) => group.entries);
const routeOf = (path: string) => path.split("/")[2] ?? "";
/** Keep the phone nav drawer inside #root: the full-screen workbench isolates
 *  that root with `inert`, and a body-level portal would escape the isolation
 *  and stay keyboard-reachable behind it. */
const drawerContainer = () => document.getElementById("root") ?? document.body;

function AdminNav({
  path,
  onNavigate,
}: {
  path: string;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const selected = routeOf(path);
  const entries: MenuProps["items"] = groups.map((group) => ({
    key: group.caption,
    type: "group" as const,
    label: group.caption,
    children: group.entries.map(({ route, label, icon: Icon }) => ({
      key: route,
      label: (
        <Link
          href={"/admin/" + route}
          aria-current={selected === route ? "page" : undefined}
          onClick={onNavigate}
        >
          <Icon size={17} />
          {label}
        </Link>
      ),
    })),
  }));
  return (
    <nav className="admin-nav" aria-label="管理导航">
      <Menu mode="inline" items={entries} selectedKeys={[selected]} />
    </nav>
  );
}

function AdminFooter({
  user,
  logout,
  onNavigate,
}: {
  user: UserDTO;
  logout: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="admin-side-foot">
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
        onClick={onNavigate}
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
    </div>
  );
}

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
  const [drawer, setDrawer] = useState(false);
  const close = () => setDrawer(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  /* Ruling 128. A running or completed-but-unfinished reset must not be
     hidden by a user-initiated menu navigation; internal navigate() calls
     (session-expired, logout, login redirect) are intentionally untouched. */
  const { phase } = useResetSession();
  const [navBlocked, setNavBlocked] = useState(false);
  const handleNav = (event: MouseEvent<HTMLAnchorElement>) => {
    if (phase === "running" || phase === "result") {
      event.preventDefault();
      setNavBlocked(true);
      return;
    }
    setNavBlocked(false);
    setDrawer(false);
  };
  useEffect(() => {
    if (phase !== "running" && phase !== "result") setNavBlocked(false);
  }, [phase]);
  /**
   * Closing the navigation hands focus back to the button that opened it, on
   * every path out of the drawer: a link, the mask, Escape. The drawer library
   * is told not to restore focus itself — a phone tap does not focus the
   * trigger, so what it would restore is `body`, and it fires only after the
   * closing animation. This effect runs once the panel has released its focus
   * lock, which is the earliest moment the trigger can keep focus.
   */
  useEffect(() => {
    if (wasOpen.current && !drawer)
      toggle.current?.focus({ preventScroll: true });
    wasOpen.current = drawer;
  }, [drawer]);
  return (
    <div className="admin-shell">
      {navBlocked && (
        /* FP-10 / Ruling 128. Float above the modal mask so the explanation
           is actually visible while the reset dialog is open. */
        <div
          className="admin-nav-blocked"
          role="alert"
          style={{
            position: "fixed",
            zIndex: 2000,
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#FFFFFF",
            color: "#202C25",
            padding: "10px 16px",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
          }}
        >
          请先完成密码重置流程，再切换页面。
        </div>
      )}
      <aside className="admin-sidebar">
        <Link className="brand" href="/admin/overview" onClick={handleNav}>
          <BrandIcon />
          FastPoster<small>管理</small>
        </Link>
        <AdminNav path={path} onNavigate={handleNav} />
        <AdminFooter user={user} logout={logout} />
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <span className="admin-crumb">
            <IconButton
              className="admin-nav-toggle"
              aria-label="导航菜单"
              ref={toggle}
              onClick={() => setDrawer(true)}
            >
              <MenuIcon size={18} />
            </IconButton>
            管理后台 /{" "}
            {items.find((item) => path === "/admin/" + item.route)?.label ??
              "内容管理"}
          </span>
          <span className="admin-role-badge">ADMIN</span>
        </header>
        <div className="admin-content">{children}</div>
      </main>
      {/* The phone drawer carries the same routes and the same highlight. */}
      <Drawer
        title="管理导航"
        placement="left"
        size={280}
        open={drawer}
        onClose={close}
        destroyOnHidden
        className="admin-nav-drawer"
        getContainer={drawerContainer}
        focusable={{ focusTriggerAfterClose: false }}
        styles={{ body: { padding: "8px 0 16px" } }}
      >
        <AdminNav path={path} onNavigate={handleNav} />
        <AdminFooter user={user} logout={logout} onNavigate={close} />
      </Drawer>
    </div>
  );
}
