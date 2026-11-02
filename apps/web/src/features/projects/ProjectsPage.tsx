import { useEffect, useRef, useState, type DragEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiClientError,
  apiClient,
  routes,
  type AssetReply,
  type ProjectDTO,
} from "@fastposter/api-client";
import {
  Button,
  Dialog,
  FormField,
  IconButton,
  Status,
  TextInput,
  Tooltip,
} from "@fastposter/ui";
import {
  FolderOpen,
  ImagePlus,
  LogOut,
  Search,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Settings2,
  Plus,
  LayoutTemplate,
} from "lucide-react";
import { errorMessage, request } from "../../api";
import { Link, navigate } from "../../router";
import { useSession } from "../auth/Session";
import { ProjectListView, type ProjectAction } from "./ProjectList";
import { TemplatePicker } from "../templates/TemplatePicker";
export function ProjectsPage() {
  const { user, logout } = useSession();
  const cache = useQueryClient();
  const [trash, setTrash] = useState(false),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [keyword, setKeyword] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [uploadError, setUploadError] = useState(""),
    [pendingFile, setPendingFile] = useState<File | null>(null),
    [dialog, setDialog] = useState<{
      action: "rename" | "delete";
      project: ProjectDTO;
    } | null>(null),
    [name, setName] = useState(""),
    [dragging, setDragging] = useState(false),
    [templatesOpen, setTemplatesOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      setKeyword(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);
  const key = ["projects", user!.id, trash, page, keyword];
  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      request(routes.ListProjects, { page, pageSize: 24, trash, keyword }),
    retry: false,
    staleTime: 15_000,
  });
  const refresh = () =>
    cache.invalidateQueries({ queryKey: ["projects", user!.id] });
  async function upload(file: File) {
    if (uploading) return;
    setUploadError("");
    setPendingFile(file);
    if (file.size > 40 * 1024 * 1024) {
      setUploadError("图片不能超过 40 MiB");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { asset } = await apiClient.upload<AssetReply>(
        "/api/v1/assets/images",
        form,
      );
      const document = {
        schemaVersion: 1,
        canvas: { width: asset.width, height: asset.height },
        background: { assetId: asset.id, version: asset.version },
        fonts: [],
        textBlocks: [],
      };
      const result = await request(routes.CreateProject, {
        title: file.name.replace(/\.[^.]+$/, "") || "未命名海报",
        document: JSON.stringify(document),
      });
      setPendingFile(null);
      await refresh();
      navigate(`/projects/${result.project.id}/edit`);
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "AUTH_REQUIRED")
        window.dispatchEvent(new Event("session-expired"));
      setUploadError(errorMessage(e));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  async function act(action: ProjectAction, project: ProjectDTO) {
    setError("");
    if (action === "rename" || action === "delete") {
      setName(project.title);
      setDialog({ action, project });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await request(
        action === "clone" ? routes.CloneProject : routes.RestoreProject,
        { id: project.id },
      );
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!dialog || busy) return;
    setBusy(true);
    setError("");
    try {
      if (dialog.action === "rename") {
        await request(routes.SaveProject, {
          id: dialog.project.id,
          expectedRevision: dialog.project.revision,
          title: name,
          document: dialog.project.document,
        });
      } else {
        await request(routes.DeleteProject, { id: dialog.project.id });
      }
      setDialog(null);
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiClientError && e.code === "REVISION_CONFLICT")
        await refresh();
    } finally {
      setBusy(false);
    }
  }
  const select = (next: boolean) => {
    setTrash(next);
    setPage(1);
    setSearch("");
    setKeyword("");
    setError("");
  };
  function drop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void upload(file);
  }
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link href="/projects" className="brand">
          <span className="brand-mark">
            F<span>p</span>
          </span>
          FastPoster
        </Link>
        <div className="sidebar-caption">创作空间</div>
        <nav aria-label="作品导航">
          <button
            aria-label="我的作品"
            className={!trash ? "nav-item active" : "nav-item"}
            onClick={() => select(false)}
          >
            <FolderOpen size={18} />
            我的作品<span>{!trash ? query.data?.total : undefined}</span>
          </button>
          <button
            className={trash ? "nav-item active" : "nav-item"}
            onClick={() => select(true)}
          >
            <Trash2 size={18} />
            回收站
          </button>
        </nav>
        <div className="sidebar-tip">
          <span className="tip-star">✳</span>
          <h3>让灵感，有处安放。</h3>
          <p>
            原图画布，自由文字。
            <br />
            从简单的排版开始创作。
          </p>
        </div>
        <div className="sidebar-account">
          <span className="avatar">
            {user!.username.slice(0, 1).toUpperCase()}
          </span>
          <span className="account-name">
            {user!.username}
            <small>个人空间</small>
          </span>
          <Tooltip label="退出登录">
            <IconButton
              aria-label="退出登录"
              onClick={() =>
                void logout().catch((e) => setError(errorMessage(e)))
              }
            >
              <LogOut size={17} />
            </IconButton>
          </Tooltip>
        </div>
        <Link className="password-link" href="/password">
          <Settings2 size={13} />
          修改密码
        </Link>
      </aside>
      <main
        className={`workspace-main ${dragging ? "drop-active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={drop}
      >
        <header className="workspace-topbar">
          <div className="breadcrumb">
            个人空间 <span>/</span>{" "}
            <strong>{trash ? "回收站" : "我的作品"}</strong>
          </div>
          <span className="workspace-badge">
            <i />
            云端保存
          </span>
          <Tooltip label="退出登录">
            <IconButton
              className="mobile-logout"
              aria-label="退出登录"
              onClick={() =>
                void logout().catch((e) => setError(errorMessage(e)))
              }
            >
              <LogOut size={18} />
            </IconButton>
          </Tooltip>
        </header>
        <div className="workspace-content">
          <div className="workspace-title-row">
            <div>
              <span className="eyebrow">
                {trash ? "A SECOND CHANCE" : "YOUR POSTER COLLECTION"}
              </span>
              <h1>
                {trash ? "回收站" : "我的作品"}
                <span className="title-dot">.</span>
              </h1>
              <p>
                {trash
                  ? "作品暂存 30 天，随时找回你的灵感。"
                  : "每一张画面，都从一个想法开始。"}
              </p>
            </div>
            <div className="workspace-title-actions">
              <Button onClick={() => setTemplatesOpen(true)}>
                <LayoutTemplate size={17} />
                模板库
              </Button>
              <Button
                variant="primary"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                <Plus size={18} />
                新建海报
              </Button>
            </div>
          </div>
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="导入背景图文件"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <div className="workspace-filter-row">
            <span>
              {trash ? "已移入回收站" : "全部海报"}
              <span className="count-badge">{query.data?.total ?? "—"}</span>
            </span>
            <div className="search-input">
              <Search size={16} />
              <TextInput
                variant="bare"
                aria-label="搜索作品"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索作品名称"
              />
            </div>
          </div>
          {uploading && (
            <Status>
              <span className="spinner" /> 正在导入并保存原图，请稍候…
            </Status>
          )}
          {uploadError && (
            <Status tone="error">
              {uploadError}
              {pendingFile && (
                <Button
                  variant="ghost"
                  onClick={() => void upload(pendingFile)}
                >
                  重试导入
                </Button>
              )}
            </Status>
          )}
          {error && <Status tone="error">{error}</Status>}
          {query.error ? (
            <Status tone="error">
              {errorMessage(query.error)}
              <Button variant="ghost" onClick={() => void query.refetch()}>
                重新加载
              </Button>
            </Status>
          ) : (
            <ProjectListView
              projects={query.data?.projects ?? []}
              loading={query.isPending}
              trash={trash}
              onAction={(action, p) => void act(action, p)}
              onUpload={() => fileInput.current?.click()}
            />
          )}
          {(query.data?.total ?? 0) > 24 && (
            <div className="pagination">
              <Button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ArrowLeft size={16} />
                上一页
              </Button>
              <span>第 {page} 页</span>
              <Button
                disabled={page * 24 >= (query.data?.total ?? 0)}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
                <ArrowRight size={16} />
              </Button>
            </div>
          )}
          <footer className="workspace-footer">
            <span>为灵感留白，为文字定格。</span>
            <span>FastPoster</span>
          </footer>
        </div>
        {dragging && (
          <div className="drop-overlay">
            <ImagePlus size={40} />
            <h2>松开以导入背景图</h2>
          </div>
        )}
      </main>
      {dialog && (
        <Dialog
          title={dialog.action === "rename" ? "重命名作品" : "移到回收站"}
          onClose={() => {
            if (!busy) setDialog(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            {dialog.action === "rename" ? (
              <FormField
                label="作品名称"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
                autoFocus
              />
            ) : (
              <p>“{dialog.project.title}”将移入回收站，可在 30 天内恢复。</p>
            )}
            {error && <Status tone="error">{error}</Status>}
            <div className="dialog-actions">
              <Button
                type="button"
                onClick={() => setDialog(null)}
                disabled={busy}
              >
                取消
              </Button>
              <Button
                type="submit"
                busy={busy}
                variant={dialog.action === "delete" ? "danger" : "primary"}
              >
                {dialog.action === "rename" ? "保存名称" : "确认移入回收站"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
      {templatesOpen && (
        <TemplatePicker
          onClose={() => setTemplatesOpen(false)}
          onApplied={(id) => {
            setTemplatesOpen(false);
            void refresh();
            navigate(`/projects/${id}/edit`);
          }}
        />
      )}
    </div>
  );
}
