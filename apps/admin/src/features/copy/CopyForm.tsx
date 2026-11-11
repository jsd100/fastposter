import { useState, type FormEvent } from "react";
import type { ResourceDTO } from "@fastposter/api-client";
import { routes } from "@fastposter/api-client";
import {
  Button,
  CheckboxField,
  Dialog,
  FormField,
  NumberField,
  Select,
  Textarea,
  useErrorNotice,
} from "@fastposter/ui";
import {
  errorMessage,
  isGone,
  isRevisionConflict,
  isStaleClient,
  reloadResource,
  request,
} from "../../api";
import { flattenCategories } from "./CategoryTree";

function descendants(rows: ResourceDTO[], id: string) {
  const blocked = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows)
      if (row.parentId && blocked.has(row.parentId) && !blocked.has(row.id)) {
        blocked.add(row.id);
        changed = true;
      }
  }
  return blocked;
}

export function CategoryForm({
  category,
  defaultParent = "",
  categories,
  close,
  saved,
}: {
  category?: ResourceDTO;
  defaultParent?: string;
  categories: ResourceDTO[];
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(category?.title ?? ""),
    [parent, setParent] = useState(category?.parentId ?? defaultParent),
    [sort, setSort] = useState(category?.sortOrder ?? 0),
    [published, setPublished] = useState(category?.published ?? true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirming, setConfirming] = useState(false),
    [conflict, setConflict] = useState<ResourceDTO | null>(null);
  useErrorNotice("admin:copy-category", error || null);
  const blocked = category
    ? descendants(categories, category.id)
    : new Set<string>();
  const options = flattenCategories(categories).filter(
    ({ node }) => !blocked.has(node.id),
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    await commit(category?.version);
  }
  async function commit(version: string | undefined) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // One atomic AdminSaveResource carries parentId and the snapshot
      // version; the old AdminMoveResource + AdminSaveResource chain is gone.
      await request(routes.AdminSaveResource, {
        id: category?.id,
        kind: "copy-category",
        title,
        parentId: parent || undefined,
        sortOrder: sort,
        published,
        expectedVersion: version,
      });
      setConflict(null);
      await saved();
    } catch (e) {
      if (isRevisionConflict(e) && category) {
        const latest = await reloadResource(category.id).catch(() => null);
        if (latest) {
          setConflict(latest);
          setError(
            "分类已被其他操作更新，草稿已保留。请确认后以最新版本重新提交。",
          );
        } else {
          setError("分类已删除或无权访问，请关闭表单刷新页面。");
          setConflict(null);
        }
      } else if (isStaleClient(e)) {
        setError("页面版本过旧，请刷新页面后重试。");
      } else if (isGone(e)) {
        setError("分类不存在或无权访问，请关闭表单刷新页面。");
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!category || busy) return;
    setBusy(true);
    setError("");
    try {
      await request(routes.AdminDeleteResource, { id: category.id });
      await saved();
    } catch (e) {
      setError(errorMessage(e));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={category ? "编辑分类" : "新建分类"}
      onClose={() => {
        if (!busy) close();
      }}
    >
      <form className="resource-form" onSubmit={submit}>
        <FormField
          label="分类名称"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
          autoFocus
        />
        <label className="form-field">
          上级分类
          <Select
            aria-label="上级分类"
            value={parent}
            onValueChange={setParent}
            options={[
              { value: "", label: "无（一级分类）" },
              ...options.map(({ node, depth }) => ({
                value: node.id,
                label: "　".repeat(depth) + node.title,
              })),
            ]}
          />
        </label>
        <label className="form-field">
          分类排序
          <NumberField
            aria-label="分类排序"
            min={0}
            max={100000}
            value={sort}
            onValueChange={setSort}
          />
        </label>
        <CheckboxField
          label="发布分类"
          checked={published}
          onChange={setPublished}
        />
        {confirming && (
          <div className="inline-confirm">
            <span>删除后无法恢复，确认删除这个空分类？</span>
            <Button
              type="button"
              variant="primary"
              busy={busy}
              onClick={() => void remove()}
            >
              确认删除
            </Button>
            <Button type="button" onClick={() => setConfirming(false)}>
              取消
            </Button>
          </div>
        )}
        {conflict && (
          <div className="inline-confirm" data-testid="version-conflict">
            <span>
              最新版本 {conflict.version} · {conflict.title}
              。草稿已保留；确认后仅以最新版本重新提交，不会自动合并或覆盖。
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
          {category && !confirming && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              删除分类
            </Button>
          )}
          <Button type="button" disabled={busy} onClick={close}>
            取消
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            保存分类
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function CopyForm({
  copy,
  defaultCategory = "",
  categories,
  close,
  saved,
}: {
  copy?: ResourceDTO;
  defaultCategory?: string;
  categories: ResourceDTO[];
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(copy?.title ?? ""),
    [body, setBody] = useState(copy?.body ?? ""),
    [category, setCategory] = useState(copy?.categoryId ?? defaultCategory),
    [sort, setSort] = useState(copy?.sortOrder ?? 0),
    [published, setPublished] = useState(copy?.published ?? true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirming, setConfirming] = useState(false),
    [conflict, setConflict] = useState<ResourceDTO | null>(null);
  useErrorNotice("admin:copy-form", error || null);
  const options = flattenCategories(categories);
  async function submit(e: FormEvent) {
    e.preventDefault();
    await commit(copy?.version);
  }
  async function commit(version: string | undefined) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request(routes.AdminSaveResource, {
        id: copy?.id,
        kind: "copy",
        title,
        body,
        categoryId: category || undefined,
        sortOrder: sort,
        published,
        expectedVersion: version,
      });
      setConflict(null);
      await saved();
    } catch (e) {
      if (isRevisionConflict(e) && copy) {
        const latest = await reloadResource(copy.id).catch(() => null);
        if (latest) {
          setConflict(latest);
          setError(
            "文案已被其他操作更新，草稿已保留。请确认后以最新版本重新提交。",
          );
        } else {
          setError("文案已删除或无权访问，请关闭表单刷新页面。");
          setConflict(null);
        }
      } else if (isStaleClient(e)) {
        setError("页面版本过旧，请刷新页面后重试。");
      } else if (isGone(e)) {
        setError("文案不存在或无权访问，请关闭表单刷新页面。");
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!copy || busy) return;
    setBusy(true);
    setError("");
    try {
      await request(routes.AdminDeleteResource, { id: copy.id });
      await saved();
    } catch (e) {
      setError(errorMessage(e));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={copy ? "编辑文案" : "新建文案"}
      onClose={() => {
        if (!busy) close();
      }}
    >
      <form className="resource-form" onSubmit={submit}>
        <FormField
          label="文案标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
          autoFocus
        />
        <label className="form-field">
          文案正文
          <Textarea
            variant="bare"
            aria-label="文案正文"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={10000}
            rows={6}
            required
          />
          <small>纯文本，可包含换行；不会执行任何标记或脚本。</small>
        </label>
        <label className="form-field">
          文案分类
          <Select
            aria-label="文案分类"
            value={category}
            onValueChange={setCategory}
            options={[
              { value: "", label: "未分类" },
              ...options.map(({ node, depth }) => ({
                value: node.id,
                label: "　".repeat(depth) + node.title,
              })),
            ]}
          />
        </label>
        <label className="form-field">
          文案排序
          <NumberField
            aria-label="文案排序"
            min={0}
            max={100000}
            value={sort}
            onValueChange={setSort}
          />
        </label>
        <CheckboxField
          label="发布文案"
          checked={published}
          onChange={setPublished}
        />
        {confirming && (
          <div className="inline-confirm">
            <span>确认删除这条文案？</span>
            <Button
              type="button"
              variant="primary"
              busy={busy}
              onClick={() => void remove()}
            >
              确认删除
            </Button>
            <Button type="button" onClick={() => setConfirming(false)}>
              取消
            </Button>
          </div>
        )}
        {conflict && (
          <div className="inline-confirm" data-testid="version-conflict">
            <span>
              最新版本 {conflict.version} · {conflict.title}
              。草稿已保留；确认后仅以最新版本重新提交，不会自动合并或覆盖。
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
          {copy && !confirming && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              删除文案
            </Button>
          )}
          <Button type="button" disabled={busy} onClick={close}>
            取消
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            保存文案
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
