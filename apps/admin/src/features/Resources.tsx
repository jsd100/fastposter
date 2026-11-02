import { FontPreview } from "./FontPreview";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiClient,
  routes,
  type AssetReply,
  type ResourceDTO,
} from "@fastposter/api-client";
import { Button, Dialog, FormField, Status } from "@fastposter/ui";
import { Plus, ImagePlus, Type } from "lucide-react";
import { request, errorMessage } from "../api";
import { Pager } from "./Metadata";
export function ResourcesPage({ kind }: { kind: "background" | "font" }) {
  const cache = useQueryClient();
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState(""),
    [category, setCategory] = useState(""),
    [editing, setEditing] = useState<ResourceDTO | "new" | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [newCategory, setNewCategory] = useState(false),
    [categoryTitle, setCategoryTitle] = useState("");
  const q = useQuery({
    queryKey: ["admin", "resources", kind, page, keyword, category],
    queryFn: () =>
      request(routes.AdminResources, {
        kind,
        page,
        pageSize: 24,
        keyword,
        categoryId: category || undefined,
      }),
    retry: false,
  });
  const categories = useQuery({
    queryKey: ["admin", "categories", kind],
    queryFn: () =>
      request(routes.AdminResources, {
        kind: kind + "-category",
        page: 1,
        pageSize: 100,
      }),
    retry: false,
  });
  const refresh = () =>
    cache.invalidateQueries({ queryKey: ["admin", "resources", kind] });
  async function publish(resource: ResourceDTO) {
    setBusy(true);
    setError("");
    try {
      await request(routes.AdminSaveResource, {
        id: resource.id,
        kind,
        title: resource.title,
        assetId: resource.asset?.id,
        categoryId: resource.categoryId,
        sortOrder: resource.sortOrder,
        published: !resource.published,
        license: resource.license,
      });
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(resource: ResourceDTO) {
    setBusy(true);
    setError("");
    try {
      await request(routes.AdminDeleteResource, { id: resource.id });
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-title-row">
        <div>
          <span className="eyebrow">SHARED CREATIVE RESOURCES</span>
          <h1>
            {kind === "background" ? "背景库" : "字体库"}
            <span>.</span>
          </h1>
          <p className="admin-subtitle">
            {kind === "background"
              ? "上传并发布预设背景，保留已有作品的不可变引用。"
              : "只使用文件实际提供的字重与样式，授权说明随资源版本保留。"}
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditing("new")}>
          <Plus size={15} />
          {kind === "background" ? "添加背景" : "添加字体"}
        </Button>
      </div>
      <div className="admin-filters">
        <input
          className="admin-search"
          aria-label="搜索素材"
          placeholder="搜索素材名称"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="筛选素材分类"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">全部分类</option>
          {categories.data?.resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
        <Button onClick={() => setNewCategory(true)}>添加分类</Button>
      </div>
      {(error || q.error) && (
        <Status tone="error">{error || errorMessage(q.error)}</Status>
      )}
      <div className="admin-resource-grid">
        {q.data?.resources.map((r) => (
          <article
            className="admin-resource-card"
            data-testid="resource-card"
            key={r.id}
          >
            <div className="admin-resource-preview">
              {kind === "background" ? (
                <img src={r.asset?.previewUrl} alt="" />
              ) : (
                <FontPreview resource={r} />
              )}
              <span
                className={
                  r.published ? "resource-state published" : "resource-state"
                }
              >
                {r.published ? "已发布" : "已下架"}
              </span>
            </div>
            <div className="resource-card-details">
              <h2>{r.title}</h2>
              <p>
                版本 {r.version}
                {r.asset && kind === "background"
                  ? ` · ${r.asset.width} × ${r.asset.height} px`
                  : ""}
              </p>
              {r.license && <small>{r.license}</small>}
              <div className="resource-actions">
                <Button variant="ghost" onClick={() => setEditing(r)}>
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void publish(r)}
                >
                  {r.published ? "下架" : "发布"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void remove(r)}
                >
                  删除
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {q.data?.resources.length === 0 && (
        <div className="admin-empty">
          <ImagePlus size={30} />
          <h2>还没有{kind === "background" ? "共享背景" : "上传字体"}</h2>
          <p>添加素材并发布后，用户即可在创作空间选用。</p>
        </div>
      )}
      <Pager page={page} total={q.data?.total ?? 0} onPage={setPage} />
      {editing && (
        <ResourceForm
          kind={kind}
          resource={editing === "new" ? undefined : editing}
          categories={categories.data?.resources ?? []}
          close={() => setEditing(null)}
          saved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
      {newCategory && (
        <Dialog title="添加分类" onClose={() => setNewCategory(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await request(routes.AdminSaveResource, {
                  kind: kind + "-category",
                  title: categoryTitle,
                  published: true,
                });
                await cache.invalidateQueries({
                  queryKey: ["admin", "categories", kind],
                });
                setNewCategory(false);
                setCategoryTitle("");
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
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
            {error && <Status tone="error">{error}</Status>}
            <div className="dialog-actions">
              <Button type="button" onClick={() => setNewCategory(false)}>
                取消
              </Button>
              <Button variant="primary" busy={busy} type="submit">
                保存分类
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
function ResourceForm({
  kind,
  resource,
  categories,
  close,
  saved,
}: {
  kind: "background" | "font";
  resource?: ResourceDTO;
  categories: ResourceDTO[];
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(resource?.title ?? ""),
    [category, setCategory] = useState(resource?.categoryId ?? ""),
    [sort, setSort] = useState(resource?.sortOrder ?? 0),
    [published, setPublished] = useState(resource?.published ?? false),
    [family, setFamily] = useState(resource?.family ?? ""),
    [weight, setWeight] = useState(resource?.weight ?? 400),
    [style, setStyle] = useState(resource?.style ?? "normal"),
    [license, setLicense] = useState(resource?.license ?? ""),
    [file, setFile] = useState<File | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      let assetId = resource?.asset?.id;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        if (kind === "font") {
          form.append("family", family);
          form.append("weight", String(weight));
          form.append("style", style);
          form.append("license", license);
        }
        const uploaded = await apiClient.upload<AssetReply>(
          kind === "font"
            ? "/api/v1/admin/fonts/upload"
            : "/api/v1/assets/images",
          form,
        );
        assetId = uploaded.asset.id;
      }
      if (!assetId) throw Error("请选择需要上传的文件");
      await request(routes.AdminSaveResource, {
        id: resource?.id,
        kind,
        title,
        assetId,
        categoryId: category || undefined,
        sortOrder: sort,
        published,
        license,
        family: kind === "font" ? family : undefined,
      });
      await saved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={
        resource ? "编辑素材" : kind === "background" ? "添加背景" : "添加字体"
      }
      onClose={() => {
        if (!busy) close();
      }}
    >
      <form onSubmit={submit} className="resource-form">
        <FormField
          label="素材名称"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
          autoFocus
        />
        <label className="form-field">
          素材分类
          <select
            aria-label="素材分类"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">未分类</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <FormField
          label="排序"
          type="number"
          min={0}
          max={100000}
          value={sort}
          onChange={(e) => setSort(Number(e.target.value))}
        />
        {kind === "font" && (
          <>
            <FormField
              label="字体家族"
              value={family}
              onChange={(e) => setFamily(e.target.value)}
              maxLength={128}
              required
              disabled={!!resource && !file}
            />
            <div className="admin-form-row">
              <label className="form-field">
                字重
                <select
                  aria-label="字体字重"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  disabled={!!resource && !file}
                >
                  {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                样式
                <select
                  aria-label="字体样式"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  disabled={!!resource && !file}
                >
                  <option value="normal">正常</option>
                  <option value="italic">斜体</option>
                </select>
              </label>
            </div>
          </>
        )}
        <label className="form-field">
          {kind === "font" ? "字体文件" : "背景图片"}
          <input
            type="file"
            aria-label={kind === "font" ? "字体文件" : "背景图片文件"}
            accept={
              kind === "font"
                ? ".ttf,.otf,.woff2"
                : "image/jpeg,image/png,image/webp"
            }
            required={!resource}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <small>
            {kind === "font"
              ? "TTF / OTF / WOFF2 · 最大 20 MiB；字重样式须与文件真实提供的版本一致。"
              : "JPG / PNG / WebP · 原文件最大 40 MiB。"}
          </small>
        </label>
        <label className="form-field">
          授权说明
          <textarea
            aria-label="授权说明"
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            maxLength={4000}
            rows={3}
          />
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            aria-label="立即发布"
          />
          立即发布
        </label>
        {error && <Status tone="error">{error}</Status>}
        <div className="dialog-actions">
          <Button type="button" disabled={busy} onClick={close}>
            取消
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            保存素材
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
