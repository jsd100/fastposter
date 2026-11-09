import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiClient,
  routes,
  type ResourceDTO,
  type ResourceReply,
} from "@fastposter/api-client";
import {
  Button,
  Dialog,
  FileField,
  FormField,
  LoadingState,
  Select,
  TextInput,
  useErrorNotice,
} from "@fastposter/ui";
import {
  loadFonts,
  PosterThumbnail,
  type FontSource,
} from "@fastposter/poster-renderer";
import { parseDocument, type PosterDocument } from "@fastposter/poster-schema";
import { Download, LayoutTemplate, Plus, Upload } from "lucide-react";
import { download, errorMessage, request } from "../../api";
import { PAGE_SIZE, RecordPager } from "../records";

const TemplateEditor = lazy(() =>
  import("./TemplateEditor").then((module) => ({
    default: module.TemplateEditor,
  })),
);

export function TemplatesPage() {
  const cache = useQueryClient();
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState(""),
    [category, setCategory] = useState(""),
    [editing, setEditing] = useState<ResourceDTO | "new" | null>(null),
    [preview, setPreview] = useState<ResourceDTO | null>(null),
    [newCategory, setNewCategory] = useState(false),
    [categoryTitle, setCategoryTitle] = useState(""),
    [importFile, setImportFile] = useState<File | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const q = useQuery({
    queryKey: ["admin", "resources", "template", page, keyword, category],
    queryFn: () =>
      request(routes.AdminResources, {
        kind: "template",
        page,
        pageSize: PAGE_SIZE,
        keyword,
        categoryId: category || undefined,
      }),
    retry: false,
  });
  const categories = useQuery({
    queryKey: ["admin", "categories", "template"],
    queryFn: () =>
      request(routes.AdminResources, {
        kind: "template-category",
        page: 1,
        pageSize: 100,
      }),
    retry: false,
  });
  const fonts = useQuery({
    queryKey: ["font-catalog"],
    queryFn: () => request(routes.ListFonts, {}),
    retry: false,
    staleTime: 60_000,
  });
  useErrorNotice("admin:templates", q.error ? errorMessage(q.error) : null, {
    persistent: true,
    action: { label: "重新加载", onClick: () => void q.refetch() },
  });
  useErrorNotice("admin:template-action", error || null);
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
  useEffect(() => {
    if (!fonts.data || typeof document === "undefined") return;
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
    if (needed.size)
      void loadFonts([...needed.values()]).catch(() => undefined);
  }, [fonts.data, signature, documents]);
  const refresh = () =>
    cache.invalidateQueries({ queryKey: ["admin", "resources", "template"] });
  async function toggle(resource: ResourceDTO) {
    setBusy(resource.id);
    setError("");
    try {
      await request(routes.AdminSaveResource, {
        id: resource.id,
        kind: "template",
        title: resource.title,
        categoryId: resource.categoryId,
        sortOrder: resource.sortOrder,
        published: !resource.published,
        document: resource.document,
      });
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
    }
  }
  async function remove(resource: ResourceDTO) {
    setBusy(resource.id);
    setError("");
    try {
      await request(routes.AdminDeleteResource, { id: resource.id });
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
    }
  }
  async function exportPackage(resource: ResourceDTO) {
    setError("");
    try {
      await download(
        `/api/v1/admin/templates/${resource.id}/package`,
        `${resource.title}.zip`,
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function importPackage(file: File | null) {
    setImportFile(file);
    if (!file) return;
    if (file.size > 80 * 1024 * 1024) {
      setError("模板包不能超过 80 MiB");
      setImportFile(null);
      return;
    }
    setBusy("import");
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      await apiClient.upload<ResourceReply>(
        "/api/v1/admin/templates/import",
        form,
      );
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
      // The pick is spent once the request has been answered, so the same
      // package can be selected again without a stale chip in the way.
      setImportFile(null);
    }
  }
  return (
    <>
      <div className="admin-title-row">
        <div>
          <span className="eyebrow">PORTABLE POSTER TEMPLATES</span>
          <h1>
            模板<span>.</span>
          </h1>
          <p className="admin-subtitle">
            使用共享编辑器维护模板草稿；FastPoster 模板包不嵌入字体或脚本。
          </p>
        </div>
        <div className="admin-title-actions">
          <FileField
            aria-label="导入管理员模板包"
            label={busy === "import" ? "正在导入…" : "导入模板包"}
            icon={<Upload size={15} />}
            accept="application/zip,.zip"
            disabled={busy !== ""}
            value={importFile}
            onChange={(file) => void importPackage(file)}
          />
          <Button
            variant="primary"
            data-fp-list-entry=""
            onClick={() => setEditing("new")}
          >
            <Plus size={15} />
            新建模板
          </Button>
        </div>
      </div>
      <div className="admin-filters">
        <TextInput
          variant="bare"
          className="admin-search"
          aria-label="搜索模板"
          placeholder="搜索模板名称"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
        />
        <Select
          aria-label="筛选模板分类"
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
        <Button onClick={() => setNewCategory(true)}>添加分类</Button>
      </div>
      <div className="admin-resource-grid">
        {q.data?.resources.map((resource) => {
          const document = documents.get(resource.id);
          return (
            <article
              className="admin-resource-card"
              data-testid="template-card"
              key={resource.id}
            >
              <div className="admin-resource-preview template-preview">
                {document ? (
                  <PosterThumbnail
                    document={document}
                    backgroundUrl={resource.asset?.previewUrl}
                    alt={`${resource.title} 预览`}
                  />
                ) : (
                  <div className="template-preview-fallback" />
                )}
                <span
                  className={
                    resource.published
                      ? "resource-state published"
                      : "resource-state"
                  }
                >
                  {resource.published ? "已发布" : "已下架"}
                </span>
              </div>
              <div className="resource-card-details">
                <h2>{resource.title}</h2>
                <p>
                  版本 {resource.version}
                  {document
                    ? ` · ${document.canvas.width} × ${document.canvas.height} px`
                    : ""}
                </p>
                <div className="resource-actions">
                  <Button variant="ghost" onClick={() => setEditing(resource)}>
                    编辑
                  </Button>
                  <Button variant="ghost" onClick={() => setPreview(resource)}>
                    预览
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy !== ""}
                    onClick={() => void toggle(resource)}
                  >
                    {resource.published ? "下架" : "发布"}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy !== ""}
                    onClick={() => void exportPackage(resource)}
                  >
                    <Download size={13} />
                    导出
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy !== ""}
                    onClick={() => void remove(resource)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {q.data?.resources.length === 0 && (
        <div className="admin-empty">
          <LayoutTemplate size={30} />
          <h2>还没有模板</h2>
          <p>用共享编辑器创建，或导入 FastPoster 模板包。</p>
        </div>
      )}
      <RecordPager
        page={page}
        total={q.data?.total ?? 0}
        onPage={setPage}
        label="模板分页"
      />
      {editing && (
        <Suspense fallback={<LoadingState label="正在打开模板编辑器…" />}>
          <TemplateEditor
            resource={editing === "new" ? undefined : editing}
            restoreFocusTo={() =>
              document.querySelector<HTMLElement>("[data-fp-list-entry]")
            }
            close={() => setEditing(null)}
            saved={async () => {
              setEditing(null);
              await refresh();
            }}
          />
        </Suspense>
      )}
      {preview && (
        <TemplatePreviewDialog
          resource={preview}
          close={() => setPreview(null)}
        />
      )}
      {newCategory && (
        <Dialog title="添加模板分类" onClose={() => setNewCategory(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy("category");
              setError("");
              try {
                await request(routes.AdminSaveResource, {
                  kind: "template-category",
                  title: categoryTitle,
                  published: true,
                });
                await cache.invalidateQueries({
                  queryKey: ["admin", "categories", "template"],
                });
                setNewCategory(false);
                setCategoryTitle("");
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy("");
              }
            }}
          >
            <FormField
              label="分类名称"
              value={categoryTitle}
              onChange={(e) => setCategoryTitle(e.target.value)}
              maxLength={120}
              required
            />
            <div className="dialog-actions">
              <Button type="button" onClick={() => setNewCategory(false)}>
                取消
              </Button>
              <Button
                variant="primary"
                busy={busy === "category"}
                type="submit"
              >
                保存分类
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

function TemplatePreviewDialog({
  resource,
  close,
}: {
  resource: ResourceDTO;
  close: () => void;
}) {
  const [document, setDocument] = useState<PosterDocument>();
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useErrorNotice("admin:template-preview", error || null);
  const fonts = useQuery({
    queryKey: ["font-catalog"],
    queryFn: () => request(routes.ListFonts, {}),
    retry: false,
    staleTime: 60_000,
  });
  useEffect(() => {
    if (!resource.document) {
      setError("模板文档不存在");
      return;
    }
    let parsed: PosterDocument;
    try {
      parsed = parseDocument(JSON.parse(resource.document));
    } catch {
      setError("模板文档已损坏");
      return;
    }
    setDocument(parsed);
    if (!fonts.data) return;
    const sources: FontSource[] = fonts.data.fonts.map((f) => ({
      ...f,
      style: f.style === "italic" ? "italic" : "normal",
    }));
    const needed: FontSource[] = [];
    for (const ref of parsed.fonts) {
      const source = sources.find(
        (f) => f.assetId === ref.assetId && f.version === ref.version,
      );
      if (source) needed.push(source);
      else
        needed.push({
          ...ref,
          url: `/api/v1/assets/${ref.assetId}/versions/${ref.version}`,
          style: ref.style === "italic" ? "italic" : "normal",
        });
    }
    let active = true;
    loadFonts(needed)
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [resource, fonts.data]);
  return (
    <Dialog
      title={`模板预览 · ${resource.title}`}
      className="template-preview-dialog"
      onClose={close}
    >
      {document && ready ? (
        <PosterThumbnail
          document={document}
          backgroundUrl={resource.asset?.previewUrl}
          alt={`${resource.title} 完整预览`}
        />
      ) : (
        <LoadingState label="正在准备预览…" />
      )}
    </Dialog>
  );
}
