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
import { Status, Button } from "@fastposter/ui";
import { ArrowLeft, Save } from "lucide-react";
import { request, errorMessage } from "../../api";
import { Link } from "../../router";
import { useSession } from "../auth/Session";
export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ["project", user!.id, projectId],
    queryFn: () => request(routes.GetProject, { id: projectId }),
    retry: false,
  });
  if (query.error)
    return (
      <main className="simple-page">
        <Link href="/projects">返回作品</Link>
        <Status tone="error">{errorMessage(query.error)}</Status>
      </main>
    );
  if (!query.data)
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
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [overflow, setOverflow] = useState(false),
    [readyFonts, setReadyFonts] = useState<FontSource[]>([]);
  const files = useRef<HTMLInputElement>(null);
  const resolver = useRef<
    ((value: BackgroundAsset | undefined) => void) | null
  >(null);
  const fontQuery = useQuery({
    queryKey: ["fonts", user!.id],
    queryFn: () => request(routes.ListFonts, {}),
    retry: false,
    staleTime: 60_000,
  });
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
    loadFonts(sources)
      .then(() => {
        if (active) setReadyFonts(sources);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [fontQuery.data, initialFonts]);
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
            {error && <Status tone="error">{error}</Status>}
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
      </header>
      {(error || fontQuery.error) && (
        <Status tone="error">{error || errorMessage(fontQuery.error)}</Status>
      )}
      {!readyFonts.length && !error && !fontQuery.error && (
        <Status>正在载入字体…</Status>
      )}
      {auto.state.status === "error" && Boolean(auto.state.error) && (
        <Status tone="error">{errorMessage(auto.state.error)}</Status>
      )}
      {auto.draftError && <Status tone="error">{auto.draftError}</Status>}
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
          error={error}
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
        onOverflowChange={setOverflow}
      />
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
