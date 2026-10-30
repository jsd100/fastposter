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
  const [doc, setDoc] = useState(() =>
      parseDocument(JSON.parse(initial.document)),
    ),
    [revision, setRevision] = useState(initial.revision),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [readyFonts, setReadyFonts] = useState<FontSource[]>([]),
    [overflow, setOverflow] = useState(false);
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
  const initialFonts = useMemo(
    () => parseDocument(JSON.parse(initial.document)).fonts,
    [initial.document],
  );
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
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty]);
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    const current = doc;
    try {
      const r = await request(routes.SaveProject, {
        id: initial.id,
        title: initial.title,
        document: JSON.stringify(current),
        expectedRevision: revision,
      });
      setRevision(r.project.revision);
      if (current === doc) setDirty(false);
      await cache.invalidateQueries({ queryKey: ["projects", user!.id] });
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
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await apiClient.upload<AssetReply>(
        "/api/v1/assets/images",
        form,
      );
      resolver.current?.(r.asset);
    } catch (e) {
      setError(errorMessage(e));
      resolver.current?.(undefined);
    } finally {
      resolver.current = null;
      if (files.current) files.current.value = "";
    }
  }
  return (
    <main className="editor-workspace">
      <header className="editor-header">
        <Link href="/projects" className="return-link">
          <ArrowLeft size={18} />
          返回作品
        </Link>
        <h1>{initial.title}</h1>
        <span className="saved-label">
          {busy ? "保存中…" : dirty ? "未保存" : "已保存"}
        </span>
        <Button
          aria-label="保存作品"
          disabled={!dirty}
          busy={busy}
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
      <Editor
        document={doc}
        onChange={(next) => {
          setDoc(next);
          setDirty(true);
        }}
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
