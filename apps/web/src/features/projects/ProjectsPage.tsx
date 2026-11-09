import { BrandIcon } from "@fastposter/ui";
import { Pagination } from "antd";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type RefObject,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiClientError,
  apiClient,
  routes,
  type AssetDTO,
  type AssetReply,
  type ProjectDTO,
  type ResourceDTO,
} from "@fastposter/api-client";
import {
  Button,
  Dialog,
  FormField,
  IconButton,
  ProjectDeletionConfirm,
  Status,
  TextInput,
  Tooltip,
  useErrorNotice,
} from "@fastposter/ui";
import {
  FolderOpen,
  ImagePlus,
  LayoutTemplate,
  LogOut,
  Plus,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { errorMessage, request } from "../../api";
import { Link, navigate } from "../../router";
import { useSession } from "../auth/Session";
import { ProjectListView, type ProjectAction } from "./ProjectList";
import { ProjectDeletionQueue } from "./ProjectDeletionQueue";
import { DELETION_PAGE_SIZE, useProjectDeletion } from "./useProjectDeletion";
import { TemplatePicker } from "../templates/TemplatePicker";
import { BackgroundPicker } from "../catalog/BackgroundPicker";
import {
  lastValidPage,
  readPosition,
  type CollectionPosition,
} from "./collection-position";
import {
  buildProjectFromBackground,
  classifyCreationFailure,
  normalizeTitle,
  useCreationScope,
  type CreationOperation,
  type ProjectBackground,
} from "./project-creation";

/** UI-04: the gallery always asks the server for 24 works per page. */
const PAGE_SIZE = 24;

/** An uploaded asset held for one local create operation (FP-06 stage 3). */
type HeldAsset = { asset: ProjectBackground; title: string };

export function ProjectsPage({
  position,
}: {
  position: RefObject<CollectionPosition | null>;
}) {
  const { user, logout } = useSession();
  const cache = useQueryClient();
  const userId = user!.id;
  /* FP-06: every create reply is bound to this account, one operation id and
     the lifetime of this page. A late reply from another account cannot act. */
  const scope = useCreationScope(user?.id ?? "");
  /* A position saved by this account during this App session. Anything else
     — another account, a new session — starts from the first page. */
  const saved = readPosition(position.current, userId);
  const [trash, setTrash] = useState(saved?.trash ?? false);
  const [page, setPage] = useState(saved?.page ?? 1);
  const [search, setSearch] = useState(saved?.search ?? "");
  const [keyword, setKeyword] = useState(saved?.keyword ?? "");
  const [deletionPage, setDeletionPage] = useState(saved?.deletionPage ?? 1);
  const editedSearch = useRef(false);
  const pendingScroll = useRef<number | null>(saved?.scrollTop ?? null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [creating, setCreating] = useState(false),
    [uploadError, setUploadError] = useState(""),
    [createError, setCreateError] = useState(""),
    [unknownError, setUnknownError] = useState(""),
    [held, setHeld] = useState<HeldAsset | null>(null),
    [pendingFile, setPendingFile] = useState<File | null>(null),
    [deletionProject, setDeletionProject] = useState<ProjectDTO | null>(null),
    [deletionError, setDeletionError] = useState(""),
    [dialog, setDialog] = useState<{
      action: "rename" | "delete";
      project: ProjectDTO;
    } | null>(null),
    [name, setName] = useState(""),
    [dragging, setDragging] = useState(false),
    [templatesOpen, setTemplatesOpen] = useState(false),
    /* FP-05: the shared source selection for the top bar and the empty state.
       "menu" → source options; "library" → the published background library. */
    [createStep, setCreateStep] = useState<"menu" | "library" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const createEntryRef = useRef<HTMLButtonElement>(null);
  const retry = useRef<(() => void) | null>(null);
  const confirmRef = useRef<(() => Promise<void>) | null>(null);
  /* Only a keystroke may reset the page. A restored search value arrives
     through the same state, and re-running the debounce would throw away the
     very page that position was saved with. */
  useEffect(() => {
    if (!editedSearch.current) return;
    const id = setTimeout(() => {
      editedSearch.current = false;
      setKeyword(search);
      setPage(1);
      setDeletionPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);
  const query = useQuery({
    queryKey: ["projects", userId, trash, page, keyword],
    queryFn: () =>
      request(routes.ListProjects, {
        page,
        pageSize: PAGE_SIZE,
        trash,
        keyword,
      }),
    retry: false,
    staleTime: 15_000,
  });
  const total = query.data?.total ?? 0;
  const refresh = () =>
    cache.invalidateQueries({ queryKey: ["projects", userId] });
  const projectDeletion = useProjectDeletion(userId, {
    enabled: trash,
    page: deletionPage,
    keyword,
  });
  /* Save where this session is standing, so that returning from the editor
     can re-open the same page of the same filtered list at the same scroll. */
  useEffect(() => {
    const store = () => {
      position.current = {
        userId,
        trash,
        search,
        keyword,
        page,
        deletionPage,
        scrollTop: window.scrollY,
      };
    };
    store();
    window.addEventListener("scroll", store, { passive: true });
    return () => window.removeEventListener("scroll", store);
  }, [position, userId, trash, search, keyword, page, deletionPage]);
  /* A page the server no longer has — because a filter or a deletion shrank
     the list — falls back to the last page that really has rows. Loading
     never counts: while rows are in flight there is nothing to judge by. */
  useEffect(() => {
    if (query.isPending || query.isFetching) return;
    const next = lastValidPage({
      page,
      rows: query.data?.projects.length ?? 0,
      total,
      pageSize: PAGE_SIZE,
    });
    if (next !== page) setPage(next);
  }, [page, query.data, query.isFetching, query.isPending, total]);
  useEffect(() => {
    if (projectDeletion.isLoading) return;
    const next = lastValidPage({
      page: deletionPage,
      rows: projectDeletion.pending.length,
      total: projectDeletion.total,
      pageSize: DELETION_PAGE_SIZE,
    });
    if (next !== deletionPage) setDeletionPage(next);
  }, [
    deletionPage,
    projectDeletion.isLoading,
    projectDeletion.pending.length,
    projectDeletion.total,
  ]);
  /* The scroll position comes back once the restored page is on screen. */
  useEffect(() => {
    if (pendingScroll.current === null) return;
    if (query.isPending || query.isFetching || query.error) return;
    const target = pendingScroll.current;
    pendingScroll.current = null;
    if ((query.data?.projects.length ?? 0) === 0) return;
    requestAnimationFrame(() => window.scrollTo(0, target));
  }, [query.data, query.error, query.isFetching, query.isPending]);
  useErrorNotice("projects:action", error || null, {
    action: { label: "重试", onClick: () => retry.current?.() },
  });
  useErrorNotice("projects:deletion", deletionError || null);
  useErrorNotice(
    "projects:deletions-list",
    projectDeletion.error ? errorMessage(projectDeletion.error) : null,
    {
      persistent: true,
      action: {
        label: "重新加载",
        onClick: () => projectDeletion.refetch(),
      },
    },
  );
  useErrorNotice("projects:upload", uploadError || null, {
    action: pendingFile
      ? { label: "重试导入", onClick: () => void upload(pendingFile) }
      : undefined,
  });
  /* A known, uncommitted create rejection may retry the create with the held
     asset; it never re-uploads the file. Ruling 49. */
  useErrorNotice("projects:create", createError || null, {
    action: held
      ? { label: "重试", onClick: () => void retryCreate() }
      : undefined,
  });
  /* An unconfirmed outcome offers only a read-only list reload. No create
     retry and no editor navigation. Rulings 47/49. */
  useErrorNotice("projects:unknown", unknownError || null, {
    persistent: true,
    action: {
      label: "重新加载作品列表",
      onClick: () => {
        setUnknownError("");
        void refresh();
      },
    },
  });
  useErrorNotice(
    "projects:list",
    query.error ? errorMessage(query.error) : null,
    {
      persistent: true,
      action: { label: "重新加载", onClick: () => void query.refetch() },
    },
  );
  /* Stage 4/5: submit the create and classify its outcome. The same entry is
     used by the first create and by a create-only retry, so both reference the
     very same held asset (Rulings 48/49). */
  async function createAndFinish(op: CreationOperation, source: HeldAsset) {
    setCreating(true);
    try {
      const input = buildProjectFromBackground(source.title, source.asset);
      const result = await request(routes.CreateProject, input);
      // Late reply: no navigation, no stale notice, no cache update.
      if (!scope.isValid(op)) return;
      setHeld(null);
      setCreateError("");
      setUnknownError("");
      await refresh();
      navigate(`/projects/${result.project.id}/edit`);
    } catch (e) {
      if (!scope.isValid(op)) return;
      const kind = classifyCreationFailure(e);
      if (kind === "auth-required") {
        window.dispatchEvent(new Event("session-expired"));
        return;
      }
      if (kind === "unknown-outcome") {
        // The server may have committed; never resubmit automatically.
        setHeld(null);
        setCreateError("");
        setUnknownError("结果未确认：请重新加载作品列表确认，未自动重新提交。");
        return;
      }
      // Known uncommitted rejection: keep the held asset for retryCreate().
      setCreateError(errorMessage(e));
    } finally {
      if (scope.isValid(op)) setCreating(false);
    }
  }
  /* A06 / Ruling 64. The confirmed gallery asset is a published catalog
     reference, so there is no local upload: feed its fresh metadata and the
     resource title straight into A05's shared create path (buildProjectFrom-
     Background / classifyCreationFailure / useCreationScope), including the
     「结果未确认」 rule and the late-reply / account-scope guards. */
  async function handleGalleryCreate(asset: AssetDTO, resource: ResourceDTO) {
    const op = scope.claim();
    if (!op) return;
    const source: HeldAsset = {
      asset: {
        id: asset.id,
        version: asset.version,
        width: asset.width,
        height: asset.height,
      },
      title: resource.title,
    };
    setHeld(source);
    setCreateError("");
    setUnknownError("");
    setCreateStep(null);
    try {
      await createAndFinish(op, source);
    } finally {
      scope.release(op);
    }
  }

  /* The only retry path. It claims a fresh operation and reuses the asset that
     was already uploaded, so no second upload POST is issued. */
  async function retryCreate() {
    if (!held) return;
    const op = scope.claim();
    if (!op) return;
    setCreateError("");
    try {
      await createAndFinish(op, held);
    } finally {
      scope.release(op);
    }
  }
  /* FP-06 five stages: 选择 → 上传 → 已有素材 → 创建 → 结果. The synchronous
     claim() is the shared submit lock for button, card, file select, drop and
     retry: only one write may be in flight. */
  async function upload(file: File) {
    const op = scope.claim();
    if (!op) return;
    setUploadError("");
    setCreateError("");
    setUnknownError("");
    setHeld(null);
    setPendingFile(file);
    if (file.size > 40 * 1024 * 1024) {
      setUploadError("图片不能超过 40 MiB");
      scope.release(op);
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
      if (!scope.isValid(op)) return;
      // Stage 3: hold the asset id, version and dimensions for this account.
      const source: HeldAsset = {
        asset: {
          id: asset.id,
          version: asset.version,
          width: asset.width,
          height: asset.height,
        },
        title: normalizeTitle(file.name),
      };
      setHeld(source);
      setPendingFile(null);
      setUploading(false);
      await createAndFinish(op, source);
    } catch (e) {
      if (!scope.isValid(op)) return;
      // An upload failure happens before any asset exists, so the existing
      // re-upload retry is safe (no project could have been committed).
      if (classifyCreationFailure(e) === "auth-required") {
        window.dispatchEvent(new Event("session-expired"));
      } else {
        setUploadError(errorMessage(e));
      }
    } finally {
      if (scope.isValid(op)) {
        setUploading(false);
        setCreating(false);
        if (fileInput.current) fileInput.current.value = "";
      }
      scope.release(op);
    }
  }
  async function act(action: ProjectAction, project: ProjectDTO) {
    setError("");
    retry.current = null;
    if (action === "rename" || action === "delete") {
      setName(project.title);
      setDialog({ action, project });
      return;
    }
    if (action === "permanent-delete") {
      setDeletionError("");
      setDeletionProject(project);
      return;
    }
    if (busy) return;
    setBusy(true);
    retry.current = () => void act(action, project);
    try {
      await request(
        action === "clone" ? routes.CloneProject : routes.RestoreProject,
        { id: project.id },
      );
      retry.current = null;
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function confirmPermanentDelete() {
    if (!deletionProject) return;
    setDeletionError("");
    try {
      await projectDeletion.accept(deletionProject.id);
      setDeletionProject(null);
    } catch (e) {
      setDeletionError(errorMessage(e));
    }
  }
  async function retryDeletion(taskId: string) {
    setDeletionError("");
    try {
      await projectDeletion.retry(taskId);
    } catch (e) {
      setDeletionError(errorMessage(e));
    }
  }
  async function confirm() {
    if (!dialog || busy) return;
    setBusy(true);
    setError("");
    retry.current = () => void confirmRef.current?.();
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
      retry.current = null;
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
  confirmRef.current = confirm;
  function closeDialog() {
    setDialog(null);
    setError("");
    retry.current = null;
  }
  /* The collection and the trash answer different questions, so switching
     starts a fresh position instead of carrying one across. */
  function select(next: boolean) {
    setTrash(next);
    setPage(1);
    setDeletionPage(1);
    setSearch("");
    setKeyword("");
    setError("");
    setDeletionError("");
    editedSearch.current = false;
    pendingScroll.current = null;
    position.current = null;
    window.scrollTo(0, 0);
  }
  function searchThrough(next: string) {
    editedSearch.current = true;
    setSearch(next);
  }
  function drop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void upload(file);
  }
  return (
    <div className="gallery-shell">
      <header className="gallery-topbar">
        <Link href="/projects" className="brand">
          <BrandIcon />
          FastPoster
        </Link>
        <nav aria-label="作品导航" className="gallery-nav">
          <button
            type="button"
            aria-pressed={!trash}
            className="gallery-nav-item"
            onClick={() => select(false)}
          >
            <FolderOpen size={16} />
            我的作品
          </button>
          <button
            type="button"
            aria-pressed={trash}
            className="gallery-nav-item"
            onClick={() => select(true)}
          >
            <Trash2 size={16} />
            回收站
          </button>
        </nav>
        <div className="gallery-account">
          <Link className="password-link" href="/password">
            <Settings2 size={14} />
            修改密码
          </Link>
          <span className="account-name">
            <span className="avatar">
              {user!.username.slice(0, 1).toUpperCase()}
            </span>
            {user!.username}
          </span>
          <Tooltip label="退出登录">
            <IconButton
              aria-label="退出登录"
              density="compact"
              onClick={() =>
                void logout().catch((e) => setError(errorMessage(e)))
              }
            >
              <LogOut size={17} />
            </IconButton>
          </Tooltip>
        </div>
      </header>
      <main
        className={`gallery-main ${dragging ? "drop-active" : ""}`}
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
        <div className="gallery-content">
          <div className="gallery-title-row">
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
            <div className="gallery-title-actions">
              <Button onClick={() => setTemplatesOpen(true)}>
                <LayoutTemplate size={17} />
                模板库
              </Button>
              <Button
                variant="primary"
                ref={createEntryRef}
                onClick={() => setCreateStep("menu")}
                disabled={uploading || creating}
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
          <div className="gallery-filter-row">
            <div className="search-input">
              <Search size={16} />
              <TextInput
                variant="bare"
                aria-label="搜索作品"
                value={search}
                onChange={(e) => searchThrough(e.target.value)}
                placeholder="搜索作品名称"
              />
            </div>
            <span className="gallery-count">
              {keyword ? "匹配的作品" : trash ? "已移入回收站" : "全部海报"}
              <span className="count-badge">{total}</span>
            </span>
          </div>
          {uploading && (
            <Status>
              <span className="spinner" /> 正在导入并保存原图，请稍候…
            </Status>
          )}
          {creating && (
            <Status>
              <span className="spinner" /> 正在创建作品，请稍候…
            </Status>
          )}
          {trash && (
            <ProjectDeletionQueue
              tasks={projectDeletion.pending}
              total={projectDeletion.total}
              page={deletionPage}
              onPage={setDeletionPage}
              onRetry={(taskId) => void retryDeletion(taskId)}
              busy={projectDeletion.isBusy}
            />
          )}
          {query.error ? (
            <div className="gallery-error">
              <Status tone="error">作品列表加载失败，当前筛选已保留。</Status>
              <Button onClick={() => void query.refetch()}>重新加载</Button>
            </div>
          ) : (
            <ProjectListView
              projects={query.data?.projects ?? []}
              loading={query.isPending}
              trash={trash}
              filtered={keyword !== ""}
              searchTerm={keyword}
              pendingDeletions={projectDeletion.total}
              onAction={(action, p) => void act(action, p)}
              onUpload={() => setCreateStep("menu")}
              onBrowseTemplates={() => setTemplatesOpen(true)}
              onClearSearch={() => searchThrough("")}
            />
          )}
          {!query.error && total > PAGE_SIZE && (
            <nav className="gallery-pager" aria-label="作品分页">
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={total}
                showSizeChanger={false}
                onChange={setPage}
              />
            </nav>
          )}
          <footer className="gallery-footer">
            <span>为灵感留白，为文字定格。</span>
            <span>云端保存 · FastPoster</span>
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
            if (!busy) closeDialog();
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
            <div className="dialog-actions">
              <Button type="button" onClick={closeDialog} disabled={busy}>
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
      {deletionProject && (
        <ProjectDeletionConfirm
          project={{ id: deletionProject.id, title: deletionProject.title }}
          busy={projectDeletion.isBusy}
          onConfirm={() => void confirmPermanentDelete()}
          onClose={() => {
            if (projectDeletion.isBusy) return;
            setDeletionProject(null);
            setDeletionError("");
          }}
        />
      )}
      {templatesOpen && (
        <TemplatePicker
          onClose={() => setTemplatesOpen(false)}
          onApplied={(id) => {
            setTemplatesOpen(false);
            setUnknownError("");
            void refresh();
            navigate(`/projects/${id}/edit`);
          }}
          onUnknownOutcome={() => {
            // Return to the works list; the persistent notice only offers a
            // read-only reload, never a resubmission or editor navigation.
            setTemplatesOpen(false);
            setUnknownError(
              "结果未确认：请重新加载作品列表确认，未自动重新提交。",
            );
          }}
        />
      )}
      {createStep === "menu" && (
        <Dialog
          title="新建海报"
          onClose={() => setCreateStep(null)}
          restoreFocusTo={() => createEntryRef.current}
        >
          <p>选择海报图片的来源：上传本地图片，或从已发布的背景库挑选。</p>
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <Button
              variant="primary"
              style={{ width: "100%" }}
              onClick={() => {
                // Open the native picker inside the click's user activation.
                // The always-mounted hidden input keeps its upload() path.
                fileInput.current?.click();
                setCreateStep(null);
              }}
            >
              上传本地图片
            </Button>
            <Button
              style={{ width: "100%" }}
              onClick={() => setCreateStep("library")}
            >
              从背景库选择
            </Button>
            <Button
              style={{ width: "100%" }}
              onClick={() => setCreateStep(null)}
            >
              取消
            </Button>
          </div>
        </Dialog>
      )}
      {createStep === "library" && (
        <BackgroundPicker
          mode="create"
          restoreFocusTo={() => createEntryRef.current}
          onBack={() => setCreateStep("menu")}
          onClose={() => setCreateStep(null)}
          onChoose={handleGalleryCreate}
        />
      )}
    </div>
  );
}
