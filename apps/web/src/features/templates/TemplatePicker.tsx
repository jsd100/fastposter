import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pagination } from "antd";
import {
  apiClient,
  routes,
  type ProjectReply,
  type ResourceDTO,
} from "@fastposter/api-client";
import {
  Button,
  Dialog,
  LoadingState,
  Select,
  Status,
  TextInput,
  useErrorNotice,
} from "@fastposter/ui";
import {
  loadFonts,
  PosterThumbnail,
  type FontSource,
} from "@fastposter/poster-renderer";
import { parseDocument, type PosterDocument } from "@fastposter/poster-schema";
import { request, errorMessage } from "../../api";
import { useSession } from "../auth/Session";
import {
  classifyCreationFailure,
  useCreationScope,
} from "../projects/project-creation";

const PAGE_SIZE = 24;

export function TemplatePicker({
  onClose,
  onApplied,
  onUnknownOutcome,
}: {
  onClose: () => void;
  onApplied: (projectId: string) => void;
  onUnknownOutcome: () => void;
}) {
  const { user } = useSession();
  /* FP-06 / Ruling 50: apply and import may create a work too, so their
     replies are bound to the current account, one operation and this picker's
     lifetime. A late reply must not navigate or raise a stale notice. */
  const scope = useCreationScope(user?.id ?? "");
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState(""),
    [category, setCategory] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const q = useQuery({
    queryKey: ["templates", user!.id, page, keyword, category],
    queryFn: () =>
      request(routes.ListCatalog, {
        kind: "template",
        page,
        pageSize: PAGE_SIZE,
        keyword,
        categoryId: category || undefined,
      }),
    retry: false,
    staleTime: 0,
  });
  const categories = useQuery({
    queryKey: ["template-categories", user!.id],
    queryFn: () =>
      request(routes.ListCatalog, {
        kind: "template-category",
        page: 1,
        pageSize: 100,
      }),
    retry: false,
  });
  const fonts = useQuery({
    queryKey: ["fonts", user!.id],
    queryFn: () => request(routes.ListFonts, {}),
    retry: false,
    staleTime: 60_000,
  });
  useErrorNotice("template:action", error || null);
  useErrorNotice("template:list", q.error ? errorMessage(q.error) : null, {
    persistent: true,
    action: { label: "重新加载", onClick: () => void q.refetch() },
  });
  useErrorNotice(
    "template:categories",
    categories.error ? errorMessage(categories.error) : null,
    {
      persistent: true,
      action: { label: "重新加载", onClick: () => void categories.refetch() },
    },
  );
  const documents = useMemo(() => {
    const map = new Map<string, PosterDocument>();
    for (const resource of q.data?.resources ?? []) {
      if (!resource.document) continue;
      try {
        map.set(resource.id, parseDocument(JSON.parse(resource.document)));
      } catch {
        continue;
      }
    }
    return map;
  }, [q.data]);
  const signature = useMemo(
    () =>
      JSON.stringify(
        [...documents.values()].flatMap((d) => d.fonts.map((f) => f.assetId)),
      ),
    [documents],
  );
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    if (!fonts.data) return;
    const sources: FontSource[] = fonts.data.fonts.map((f) => ({
      ...f,
      style: f.style === "italic" ? "italic" : "normal",
    }));
    const needed = new Map<string, FontSource>();
    for (const d of documents.values())
      for (const ref of d.fonts) {
        const source = sources.find(
          (f) => f.assetId === ref.assetId && f.version === ref.version,
        );
        if (source) needed.set(source.assetId, source);
      }
    if (!needed.size) {
      setFontsReady(true);
      return;
    }
    let active = true;
    loadFonts([...needed.values()])
      .catch(() => undefined)
      .finally(() => {
        if (active) setFontsReady(true);
      });
    return () => {
      active = false;
    };
  }, [fonts.data, signature, documents]);
  /* FP-06: known rejections stay on the original error path; an unconfirmed
     outcome hands control back to the works list with a reload-only notice. */
  function handleFailure(e: unknown) {
    const kind = classifyCreationFailure(e);
    if (kind === "unknown-outcome") {
      setError("");
      onUnknownOutcome();
      return;
    }
    setError(errorMessage(e));
  }
  async function apply(resource: ResourceDTO) {
    const op = scope.claim();
    if (!op) return;
    setBusy(resource.id);
    setError("");
    try {
      const result = await request(routes.ApplyTemplate, {
        id: resource.id,
        version: resource.version,
      });
      // Late reply from a logged-out/switched account: never navigate.
      if (!scope.isValid(op)) return;
      onApplied(result.project.id);
    } catch (e) {
      if (!scope.isValid(op)) return;
      handleFailure(e);
    } finally {
      if (scope.isValid(op)) setBusy("");
      scope.release(op);
    }
  }
  async function importPackage(selected: File | undefined) {
    if (!selected) return;
    const op = scope.claim();
    if (!op) return;
    if (selected.size > 80 * 1024 * 1024) {
      setError("模板包不能超过 80 MiB");
      scope.release(op);
      return;
    }
    setBusy("import");
    setError("");
    try {
      const form = new FormData();
      form.append("file", selected);
      const result = await apiClient.upload<ProjectReply>(
        "/api/v1/templates/import",
        form,
      );
      if (!scope.isValid(op)) return;
      onApplied(result.project.id);
    } catch (e) {
      if (!scope.isValid(op)) return;
      // apiClient.upload() bypasses request(), so AUTH_REQUIRED needs the
      // session-expired event dispatched explicitly here.
      if (classifyCreationFailure(e) === "auth-required")
        window.dispatchEvent(new Event("session-expired"));
      handleFailure(e);
    } finally {
      if (scope.isValid(op)) setBusy("");
      if (file.current) file.current.value = "";
      scope.release(op);
    }
  }
  return (
    <Dialog title="模板库" className="template-picker" onClose={onClose}>
      <p>选择模板会创建一个独立作品，保留画布、背景与文字排版。</p>
      <div className="picker-filters">
        <TextInput
          variant="bare"
          aria-label="搜索模板"
          placeholder="搜索模板"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
        />
        <Select
          aria-label="模板分类"
          value={category}
          onValueChange={(value) => {
            setCategory(value);
            setPage(1);
          }}
          options={[
            { value: "", label: "全部分类" },
            ...(categories.data?.resources.map((r) => ({
              value: r.id,
              label: r.title,
            })) ?? []),
          ]}
        />
        <Button
          disabled={busy !== ""}
          onClick={() => file.current?.click()}
          busy={busy === "import"}
        >
          导入模板包
        </Button>
        <input
          ref={file}
          className="visually-hidden"
          type="file"
          accept="application/zip,.zip"
          aria-label="导入模板包文件"
          onChange={(e) => void importPackage(e.target.files?.[0])}
        />
      </div>
      <div className="template-picker-grid">
        {q.data?.resources.map((resource) => {
          const document = documents.get(resource.id);
          return (
            <article key={resource.id} className="template-card">
              {document ? (
                <PosterThumbnail
                  document={document}
                  backgroundUrl={resource.asset?.previewUrl}
                  alt={`${resource.title} 预览`}
                />
              ) : (
                <div className="template-preview-fallback" aria-hidden="true" />
              )}
              <div>
                <h3>{resource.title}</h3>
                <small>
                  {document
                    ? `${document.canvas.width} × ${document.canvas.height} px`
                    : "预览不可用"}
                  {fontsReady ? "" : " · 正在载入字体"}
                </small>
                <Button
                  variant="primary"
                  busy={busy === resource.id}
                  disabled={busy !== "" || !document}
                  onClick={() => void apply(resource)}
                >
                  使用模板
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {q.isPending && <LoadingState label="正在加载模板…" />}
      {q.error && (
        <div className="picker-failed">
          <Status tone="error">模板加载失败，当前筛选已保留。</Status>
          <Button onClick={() => void q.refetch()}>重新加载</Button>
        </div>
      )}
      {q.data?.resources.length === 0 && (
        <p className="picker-empty">暂无已发布的模板。</p>
      )}
      {(q.data?.total ?? 0) > PAGE_SIZE && (
        <nav className="picker-pager" aria-label="模板分页">
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={q.data?.total ?? 0}
            showSizeChanger={false}
            onChange={setPage}
          />
        </nav>
      )}
    </Dialog>
  );
}
