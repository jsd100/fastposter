import { FontPreview } from "./FontPreview";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "antd";
import {
  apiClient,
  loadCatalogPages,
  routes,
  type AssetReply,
  type ResourceDTO,
} from "@fastposter/api-client";
import {
  Button,
  CheckboxField,
  Dialog,
  FileField,
  FormField,
  NumberField,
  Select,
  Status,
  TextInput,
  Textarea,
  useErrorNotice,
} from "@fastposter/ui";
import { Plus, ImagePlus, Type } from "lucide-react";
import {
  errorMessage,
  isGone,
  isRevisionConflict,
  isStaleClient,
  reloadResource,
  request,
} from "../api";
import { PAGE_SIZE, RecordPager } from "./records";
import {
  pageAfterShrink,
  adminPageIdentity,
  canCorrectAdminPage,
} from "./projects/pagination";
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
  const viewIdentity = adminPageIdentity([kind, page, keyword, category]);
  const q = useQuery({
    queryKey: ["admin", "resources", kind, page, keyword, category],
    queryFn: async () => {
      const reply = await request(routes.AdminResources, {
        kind,
        page,
        pageSize: PAGE_SIZE,
        keyword,
        categoryId: category || undefined,
      });
      return { ...reply, __identity: viewIdentity };
    },
    retry: false,
  });
  /* FP-09 / Ruling 108. A successful 25 -> 24 shrink falls back to page 1;
     a failed refetch (react-query keeps the prior data) must not. */
  useEffect(() => {
    if (
      !q.data ||
      !canCorrectAdminPage({
        isSuccess: q.isSuccess,
        isError: q.isError,
        fetchStatus: q.fetchStatus,
        resultIdentity: q.data.__identity,
        viewIdentity,
      })
    )
      return;
    const next = pageAfterShrink(
      page,
      q.data.total,
      q.data.resources.length,
      PAGE_SIZE,
    );
    if (next !== page) setPage(next);
  }, [page, q.data, q.isSuccess, q.isError, q.fetchStatus, viewIdentity]);
  const categories = useQuery({
    queryKey: ["admin", "categories", kind],
    queryFn: () =>
      loadCatalogPages((page, pageSize) =>
        request(routes.AdminResources, {
          kind: kind + "-category",
          page,
          pageSize,
        }),
      ),
    retry: false,
  });
  const refresh = () =>
    cache.invalidateQueries({ queryKey: ["admin", "resources", kind] });
  useErrorNotice("admin:resources", q.error ? errorMessage(q.error) : null, {
    persistent: true,
    action: { label: "重新加载", onClick: () => void q.refetch() },
  });
  useErrorNotice("admin:resource-action", error || null);
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
        expectedVersion: resource.version,
      });
      await refresh();
    } catch (e) {
      if (isRevisionConflict(e) || isStaleClient(e)) {
        setError("该素材已被更新或页面版本过旧，请刷新页面后重试。");
      } else if (isGone(e)) {
        setError("素材不存在或无权访问，请刷新页面。");
      } else {
        setError(errorMessage(e));
      }
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
        <TextInput
          variant="bare"
          className="admin-search"
          aria-label="搜索素材"
          placeholder="搜索素材名称"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
        />
        <Select
          aria-label="筛选素材分类"
          value={category}
          onValueChange={(value) => {
            setCategory(value);
            setPage(1);
          }}
          options={[
            { value: "", label: "全部分类" },
            ...(categories.isSuccess
              ? categories.data.map((r) => ({ value: r.id, label: r.title }))
              : []),
          ]}
        />
        <Button onClick={() => setNewCategory(true)}>添加分类</Button>
      </div>
      {categories.isError && (
        <div data-testid="category-error" className="picker-failed">
          <Status tone="error">分类加载失败，请重新加载</Status>
          <Button onClick={() => void categories.refetch()}>重新加载</Button>
        </div>
      )}
      <div
        className="admin-resource-grid"
        role={q.isPending ? "status" : undefined}
        aria-label={q.isPending ? "正在加载素材" : undefined}
        aria-busy={q.isPending || undefined}
      >
        {q.isPending &&
          [0, 1, 2].map((n) => (
            <article className="admin-resource-card" key={n}>
              <div className="admin-resource-preview">
                <Skeleton active title={false} paragraph={{ rows: 3 }} />
              </div>
              <div className="resource-card-details">
                <Skeleton
                  active
                  title={{ width: "55%" }}
                  paragraph={{ rows: 2 }}
                />
              </div>
            </article>
          ))}
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
      <RecordPager
        page={page}
        total={q.data?.total ?? 0}
        onPage={setPage}
        label={kind === "background" ? "背景分页" : "字体分页"}
      />
      {editing && (
        <ResourceForm
          kind={kind}
          resource={editing === "new" ? undefined : editing}
          categories={categories.isSuccess ? categories.data : []}
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
    [busy, setBusy] = useState(false),
    [conflict, setConflict] = useState<ResourceDTO | null>(null);
  const uploadedAsset = useRef<string | undefined>(undefined);
  useErrorNotice("admin:resource-form", error || null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    await commit(resource?.version);
  }
  async function commit(version: string | undefined) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      let assetId = uploadedAsset.current ?? resource?.asset?.id;
      if (file && !uploadedAsset.current) {
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
        uploadedAsset.current = uploaded.asset.id;
        assetId = uploadedAsset.current;
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
        expectedVersion: version,
      });
      setConflict(null);
      await saved();
    } catch (e) {
      if (isRevisionConflict(e) && resource) {
        const latest = await reloadResource(resource.id).catch(() => null);
        if (latest) {
          setConflict(latest);
          setError(
            "素材已被其他操作更新，草稿与已上传素材已保留。请确认后以最新版本重新提交。",
          );
        } else {
          setError("素材已删除或无权访问，请关闭表单刷新页面。");
          setConflict(null);
        }
      } else if (isStaleClient(e)) {
        setError("页面版本过旧，请刷新页面后重试。");
      } else if (isGone(e)) {
        setError("素材不存在或无权访问，请关闭表单刷新页面。");
      } else {
        setError(errorMessage(e));
      }
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
          <Select
            aria-label="素材分类"
            value={category}
            onValueChange={setCategory}
            options={[
              { value: "", label: "未分类" },
              ...categories.map((c) => ({ value: c.id, label: c.title })),
            ]}
          />
        </label>
        <label className="form-field">
          排序
          <NumberField
            aria-label="素材排序"
            min={0}
            max={100000}
            value={sort}
            onValueChange={setSort}
          />
        </label>
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
                <Select
                  aria-label="字体字重"
                  value={weight}
                  onValueChange={setWeight}
                  disabled={!!resource && !file}
                  options={[100, 200, 300, 400, 500, 600, 700, 800, 900].map(
                    (w) => ({ value: w, label: String(w) }),
                  )}
                />
              </label>
              <label className="form-field">
                样式
                <Select
                  aria-label="字体样式"
                  value={style}
                  onValueChange={setStyle}
                  disabled={!!resource && !file}
                  options={[
                    { value: "normal", label: "正常" },
                    { value: "italic", label: "斜体" },
                  ]}
                />
              </label>
            </div>
          </>
        )}
        <FileField
          aria-label={kind === "font" ? "字体文件" : "背景图片文件"}
          label={kind === "font" ? "选择字体文件" : "选择背景图片"}
          icon={kind === "font" ? <Type size={14} /> : <ImagePlus size={14} />}
          accept={
            kind === "font"
              ? ".ttf,.otf,.woff2"
              : "image/jpeg,image/png,image/webp"
          }
          disabled={busy}
          value={file}
          onChange={setFile}
          hint={
            kind === "font"
              ? "TTF / OTF / WOFF2 · 最大 20 MiB；字重样式须与文件真实提供的版本一致。"
              : "JPG / PNG / WebP · 原文件最大 40 MiB。"
          }
        />
        <label className="form-field">
          授权说明
          <Textarea
            variant="bare"
            aria-label="授权说明"
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            maxLength={4000}
            rows={3}
          />
        </label>
        <CheckboxField
          label="立即发布"
          checked={published}
          onChange={setPublished}
          disabled={busy}
        />
        {conflict && (
          <div className="inline-confirm" data-testid="version-conflict">
            <span>
              最新版本 {conflict.version} · {conflict.title}
              。草稿与已上传素材已保留；确认后仅以最新版本重新提交，不会自动合并或覆盖。
            </span>
            <Button
              type="button"
              variant="primary"
              busy={busy}
              onClick={() => void commit(conflict.version)}
            >
              确认重新提交
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConflict(null);
                setError("请刷新页面后重新编辑。");
              }}
            >
              放弃修改
            </Button>
          </div>
        )}
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
