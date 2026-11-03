import { BackgroundPicker } from "../catalog/BackgroundPicker";
import { CopyPicker } from "../catalog/CopyPicker";
import { ExportControls } from "../export/ExportDialog";
import { useProjectAutosave } from "../editor/useProjectAutosave";
import { SaveStatus } from "../editor/SaveStatus";
import { ConflictDialog } from "../editor/ConflictDialog";
import { drafts } from "../editor/drafts";
import { Dialog } from "@fastposter/ui";
import { replaceBackground } from "@fastposter/poster-editor";
import { navigate } from "../../router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, routes, type AssetReply } from "@fastposter/api-client";
import { loadFonts, type FontSource } from "@fastposter/poster-renderer";
import { parseDocument, type PosterDocument } from "@fastposter/poster-schema";
import { Editor, type BackgroundAsset } from "@fastposter/poster-editor";
import { Status, Button, useErrorNotice } from "@fastposter/ui";
import { ArrowLeft, Save, Package } from "lucide-react";
import { request, errorMessage, download } from "../../api";
import { Link } from "../../router";
import { useSession } from "../auth/Session";
export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ["project", user!.id, projectId],
    queryFn: () => request(routes.GetProject, { id: projectId }),
    retry: false,
  });
  useErrorNotice(
    "project:load",
    query.error ? errorMessage(query.error) : null,
    {
      persistent: true,
      action: { label: "重新加载", onClick: () => void query.refetch() },
    },
  );
  if (query.error)
    return (
      <main className="simple-page">
        <Link href="/projects">返回作品</Link>
      </main>
    );
  if (!query.data || query.isFetching)
    return (
      <main className="simple-page">
        <Status>正在打开作品…</Status>
      </main>
    );
  return <Workspace key={projectId} initial={query.data.project} />;
}
import type { ProjectDTO } from "@fastposter/api-client";
function Workspace({ initial }: { initial: ProjectDTO }) {
  const { user } = useSession();
  const cache = useQueryClient();
  const auto = useProjectAutosave(user!.id, initial);
  const doc = auto.state.document;
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [packBusy, setPackBusy] = useState(false),
    [overflow, setOverflow] = useState(false),
    [readyFonts, setReadyFonts] = useState<FontSource[]>([]);
  const [fontsBusy, setFontsBusy] = useState(false),
    [glyphError, setGlyphError] = useState("");
  const files = useRef<HTMLInputElement>(null);
  const resolver = useRef<
    ((value: BackgroundAsset | undefined) => void) | null
  >(null);
  const copyResolver = useRef<((value: string | undefined) => void) | null>(
    null,
  );
  const fontQuery = useQuery({
    queryKey: ["fonts", user!.id],
    queryFn: () => request(routes.ListFonts, {}),
    retry: false,
    staleTime: 60_000,
  });
  useErrorNotice("workspace:operation", error || null);
  useErrorNotice(
    "workspace:fonts",
    fontQuery.error ? errorMessage(fontQuery.error) : null,
    {
      persistent: true,
      action: { label: "重新加载", onClick: () => void fontQuery.refetch() },
    },
  );
  useErrorNotice("workspace:glyphs", glyphError || null, { persistent: true });
  useErrorNotice("workspace:drafts", auto.draftError || null);
  const fontSignature = JSON.stringify(doc.fonts);
  const initialFonts = useMemo(() => doc.fonts, [fontSignature]);
  useEffect(() => {
    if (!fontQuery.data) return;
    let active = true;
    const sources: FontSource[] = fontQuery.data.fonts.map((f) => {
      if (f.style !== "normal" && f.style !== "italic")
        throw Error("字体样式无效");
      return { ...f, style: f.style };
    });
    for (const f of initialFonts)
      if (
        !sources.some((s) => s.assetId === f.assetId && s.version === f.version)
      )
        sources.push({
          ...f,
          url: `/api/v1/assets/${f.assetId}/versions/${f.version}`,
        });
    const needed = initialFonts.length
      ? sources.filter((f) =>
          initialFonts.some(
            (ref) => ref.assetId === f.assetId && ref.version === f.version,
          ),
        )
      : sources.filter((f) => f.family === "Noto Sans SC");
    setFontsBusy(true);
    loadFonts(needed)
      .then(() => {
        if (active) {
          setReadyFonts(sources);
          setFontsBusy(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(errorMessage(e));
          setFontsBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, [fontQuery.data, initialFonts]);
  const documentValue = JSON.stringify(doc);
  useEffect(() => {
    if (!auto.ready || !doc.textBlocks.length) {
      setGlyphError("");
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      request(routes.CheckFonts, { document: documentValue })
        .then(() => {
          if (active) setGlyphError("");
        })
        .catch((e) => {
          if (active) setGlyphError(errorMessage(e));
        });
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [documentValue, auto.ready]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (auto.state.status !== "saved") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [auto.state.status]);
  async function save() {
    setError("");
    try {
      await auto.flush();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function exportPackage() {
    if (packBusy) return;
    setPackBusy(true);
    setError("");
    try {
      await auto.flush();
      await download(
        `/api/v1/projects/${initial.id}/template`,
        `${auto.title || "FastPoster"}.zip`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPackBusy(false);
    }
  }
  async function copyLocal() {
    setBusy(true);
    setError("");
    try {
      const r = await request(routes.CreateProject, {
        title: auto.title.slice(0, 110) + " 本地副本",
        document: JSON.stringify(doc),
      });
      await drafts.delete(user!.id, initial.id);
      await cache.invalidateQueries({ queryKey: ["projects", user!.id] });
      navigate(`/projects/${r.project.id}/edit`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const el = files.current;
    if (!el) return;
    const cancel = () => {
      resolver.current?.(undefined);
      resolver.current = null;
    };
    el.addEventListener("cancel", cancel);
    return () => el.removeEventListener("cancel", cancel);
  }, []);
  function background() {
    return new Promise<BackgroundAsset | undefined>((resolve) => {
      resolver.current = resolve;
      files.current?.click();
    });
  }
  function library() {
    return new Promise<BackgroundAsset | undefined>((resolve) => {
      resolver.current = resolve;
      setLibraryOpen(true);
    });
  }
  function copyLibrary() {
    return new Promise<string | undefined>((resolve) => {
      copyResolver.current = resolve;
      setCopyOpen(true);
    });
  }
  async function importFile(file: File | undefined) {
    if (!file) {
      resolver.current?.(undefined);
      resolver.current = null;
      return;
    }
    auto.setUploading(true, [{ name: file.name, file }]);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await apiClient.upload<AssetReply>(
        "/api/v1/assets/images",
        form,
      );
      if (resolver.current) {
        resolver.current(r.asset);
        resolver.current = null;
      } else {
        auto.controller.update(
          replaceBackground(auto.controller.getState().document, r.asset),
        );
      }
      auto.setUploading(false, []);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      if (files.current) files.current.value = "";
    }
  }
  if (!auto.ready)
    return (
      <main className="simple-page">
        <Link href="/projects">返回作品</Link>
        {auto.recovery ? (
          <Dialog title="发现本地草稿" onClose={() => {}}>
            <p>
              本机有尚未确认的修改。恢复后若云端版本更新，会继续保留为冲突草稿。
            </p>
            <div className="dialog-actions">
              <Button
                onClick={() =>
                  void auto.discard().catch((e) => setError(errorMessage(e)))
                }
              >
                使用云端版本
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  void auto.restore().catch((e) => setError(errorMessage(e)))
                }
              >
                恢复本地草稿
              </Button>
            </div>
          </Dialog>
        ) : (
          <Status>正在检查本地草稿…</Status>
        )}
      </main>
    );
  return (
    <main className="editor-workspace">
      <header className="editor-header">
        <Link href="/projects" className="return-link">
          <ArrowLeft size={18} />
          返回作品
        </Link>
        <h1>{auto.title}</h1>
        <SaveStatus status={auto.state.status} />
        <Button
          aria-label="保存作品"
          disabled={
            auto.state.status === "saved" || auto.state.status === "blocked"
          }
          busy={busy || auto.state.status === "saving"}
          onClick={() => void save()}
        >
          <Save size={15} />
          保存
        </Button>
        <Button
          aria-label="导出模板包"
          busy={packBusy}
          disabled={
            auto.state.status === "blocked" || auto.state.status === "conflict"
          }
          onClick={() => void exportPackage()}
        >
          <Package size={15} />
          模板包
        </Button>
        <ExportControls
          projectId={initial.id}
          userId={user!.id}
          flush={auto.flush}
          overflow={overflow || !!glyphError}
          blocked={
            auto.state.status === "blocked" ||
            auto.state.status === "conflict" ||
            !readyFonts.length ||
            fontsBusy
          }
        />
      </header>
      {!readyFonts.length && !error && !fontQuery.error && (
        <Status>正在载入字体…</Status>
      )}
      {auto.state.status === "error" && Boolean(auto.state.error) && (
        <Status tone="error">{errorMessage(auto.state.error)}</Status>
      )}
      {glyphError && <Status tone="error">{glyphError}</Status>}
      {auto.state.status === "offline" && (
        <Status>连接恢复后可点击保存重试。</Status>
      )}
      {auto.pendingFiles.current.length > 0 && (
        <Status>
          有未完成的背景图导入
          <Button
            onClick={() => void importFile(auto.pendingFiles.current[0].file)}
          >
            重试导入
          </Button>
          <Button
            onClick={() => {
              resolver.current?.(undefined);
              resolver.current = null;
              auto.setUploading(false, []);
            }}
          >
            取消本次导入
          </Button>
        </Status>
      )}
      {auto.state.status === "conflict" && (
        <ConflictDialog
          busy={busy}
          onCopy={() => void copyLocal()}
          onCloud={() =>
            void auto.loadCloud().catch((e) => setError(errorMessage(e)))
          }
        />
      )}
      <Editor
        document={doc}
        onChange={(next) => auto.controller.update(next)}
        onInteractionChange={auto.setInteraction}
        availableFonts={readyFonts}
        onAssetRequest={background}
        onBackgroundLibraryRequest={library}
        onCopyRequest={copyLibrary}
        onOverflowChange={setOverflow}
      />
      {libraryOpen && (
        <BackgroundPicker
          onClose={() => {
            resolver.current?.(undefined);
            resolver.current = null;
            setLibraryOpen(false);
          }}
          onChoose={(asset) => {
            resolver.current?.(asset);
            resolver.current = null;
            setLibraryOpen(false);
          }}
        />
      )}
      {copyOpen && (
        <CopyPicker
          onClose={() => {
            copyResolver.current?.(undefined);
            copyResolver.current = null;
            setCopyOpen(false);
          }}
          onChoose={(text) => {
            copyResolver.current?.(text);
            copyResolver.current = null;
            setCopyOpen(false);
          }}
        />
      )}
      <input
        ref={files}
        type="file"
        className="visually-hidden"
        accept="image/png,image/jpeg,image/webp"
        aria-label="更换背景图文件"
        onChange={(e) => void importFile(e.target.files?.[0])}
      />
    </main>
  );
}
