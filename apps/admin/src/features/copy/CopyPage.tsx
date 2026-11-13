import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  loadCatalogPages,
  routes,
  type ResourceDTO,
} from "@fastposter/api-client";
import { Button, TextInput, useErrorNotice } from "@fastposter/ui";
import { Plus } from "lucide-react";
import {
  errorMessage,
  isGone,
  isRevisionConflict,
  isStaleClient,
  reloadResource,
  request,
} from "../../api";
import { PAGE_SIZE, RecordPager } from "../records";
import {
  pageAfterShrink,
  adminPageIdentity,
  canCorrectAdminPage,
} from "../projects/pagination";
import { CategoryTree } from "./CategoryTree";
import { CategoryForm, CopyForm } from "./CopyForm";
import { CopyList } from "./CopyList";

export function CopyPage() {
  const cache = useQueryClient();
  const [selected, setSelected] = useState(""),
    [keyword, setKeyword] = useState(""),
    [page, setPage] = useState(1),
    [editingCategory, setEditingCategory] = useState<{
      category?: ResourceDTO;
      parent: string;
    } | null>(null),
    [editingCopy, setEditingCopy] = useState<ResourceDTO | "new" | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [conflict, setConflict] = useState<{
      resource: ResourceDTO;
      published: boolean;
    } | null>(null);
  const categories = useQuery({
    queryKey: ["admin", "copy-categories"],
    queryFn: () =>
      loadCatalogPages((page, pageSize) =>
        request(routes.AdminResources, {
          kind: "copy-category",
          page,
          pageSize,
        }),
      ),
    retry: false,
  });
  const viewIdentity = adminPageIdentity(["copy", selected, keyword, page]);
  const copies = useQuery({
    queryKey: ["admin", "copies", selected, keyword, page],
    queryFn: async () => {
      const reply = await request(routes.AdminResources, {
        kind: "copy",
        page,
        pageSize: PAGE_SIZE,
        keyword,
        categoryId: selected || undefined,
      });
      return { ...reply, __identity: viewIdentity };
    },
    retry: false,
  });
  /* FP-09 / Ruling 108/115. Only the copy LIST's page is corrected here; the
     category tree's full paging read is A09's concern and stays untouched. */
  useEffect(() => {
    if (
      !copies.data ||
      !canCorrectAdminPage({
        isSuccess: copies.isSuccess,
        isError: copies.isError,
        fetchStatus: copies.fetchStatus,
        resultIdentity: copies.data.__identity,
        viewIdentity,
      })
    )
      return;
    const next = pageAfterShrink(
      page,
      copies.data.total,
      copies.data.resources.length,
      PAGE_SIZE,
    );
    if (next !== page) setPage(next);
  }, [
    page,
    copies.data,
    copies.isSuccess,
    copies.isError,
    copies.fetchStatus,
    viewIdentity,
  ]);
  const categoryRows = categories.isSuccess ? categories.data : [];
  useErrorNotice(
    "admin:copy-categories",
    categories.error ? errorMessage(categories.error) : null,
    {
      persistent: true,
      action: { label: "重新加载", onClick: () => void categories.refetch() },
    },
  );
  useErrorNotice(
    "admin:copy-list",
    copies.error ? errorMessage(copies.error) : null,
    {
      persistent: true,
      action: { label: "重新加载", onClick: () => void copies.refetch() },
    },
  );
  useErrorNotice("admin:copy-action", error || null);
  useEffect(() => {
    // Only a complete, successful read may clear the selection; a failed
    // refetch keeps the current scope (FP-10 / Ruling 134).
    if (
      selected &&
      categories.isSuccess &&
      !categoryRows.some((r) => r.id === selected)
    )
      setSelected("");
  }, [categories.isSuccess, categoryRows, selected]);
  const refresh = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["admin", "copy-categories"] }),
      cache.invalidateQueries({ queryKey: ["admin", "copies"] }),
    ]);
  };
  async function toggle(copy: ResourceDTO) {
    await commitToggle(copy, !copy.published, copy.version);
  }
  // The pending publication state is kept across a conflict; only an explicit
  // confirmation may send a second POST, and it reuses the newest version.
  async function commitToggle(
    copy: ResourceDTO,
    published: boolean,
    expectedVersion: string,
  ) {
    setBusy(copy.id);
    setError("");
    try {
      // B02: a versioned publication intent carries only the target state and
      // the expected version; the server keeps its own newer copy body.
      await request(routes.AdminPublishResource, {
        id: copy.id,
        published,
        expectedVersion,
      });
      setConflict(null);
      await cache.invalidateQueries({ queryKey: ["admin", "copies"] });
    } catch (e) {
      if (isRevisionConflict(e)) {
        const latest = await reloadResource(copy.id).catch(() => null);
        if (latest) {
          setConflict({ resource: latest, published });
          setError(
            "该文案已被其他操作更新，请确认后以最新版本重新提交这个发布动作。",
          );
        } else {
          setError("无法重载该文案，请刷新页面后重试。");
          setConflict(null);
        }
      } else if (isStaleClient(e)) {
        setError("该文案已被更新或页面版本过旧，请刷新页面后重试。");
      } else if (isGone(e)) {
        setError("文案不存在或无权访问，请刷新页面。");
        setConflict(null);
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setBusy("");
    }
  }
  const selectedTitle = categoryRows.find((r) => r.id === selected)?.title;
  return (
    <>
      <div className="admin-title-row">
        <div>
          <h1>文案库</h1>
          <p className="admin-subtitle">
            维护最多五层的分类树与纯文本文案；发布后用户可按分类逐级筛选并插入编辑器。
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditingCopy("new")}>
          <Plus size={15} />
          新建文案
        </Button>
      </div>
      {conflict && (
        <div className="inline-confirm" data-testid="version-conflict">
          <span>
            最新版本 {conflict.resource.version} · {conflict.resource.title}（
            {conflict.resource.published ? "已发布" : "已下架"}）。
            请确认后以最新版本重新提交
            {conflict.published ? "发布" : "下架"}
            动作，不会自动合并或覆盖。
          </span>
          <Button
            variant="primary"
            busy={busy !== ""}
            onClick={() =>
              void commitToggle(
                conflict.resource,
                conflict.published,
                conflict.resource.version,
              )
            }
          >
            确认重新提交
          </Button>
          <Button
            onClick={() => {
              setConflict(null);
              setError("");
            }}
          >
            取消
          </Button>
        </div>
      )}
      <div className="copy-layout">
        <CategoryTree
          categories={categoryRows}
          selected={selected}
          loading={categories.isPending}
          failed={!!categories.error}
          onRetry={() => void categories.refetch()}
          onSelect={(id) => {
            setSelected(id);
            setPage(1);
          }}
          onAdd={(parent) => setEditingCategory({ parent })}
          onEdit={(category) =>
            setEditingCategory({ category, parent: category.parentId ?? "" })
          }
        />
        <section className="copy-main">
          <div className="admin-filters">
            <TextInput
              className="admin-search"
              aria-label="搜索文案"
              placeholder="搜索文案标题或内容"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
            />
            <span className="copy-scope">
              {selectedTitle ? `分类：${selectedTitle}` : "全部分类"}
            </span>
          </div>
          <CopyList
            resources={copies.data?.resources ?? []}
            loading={copies.isPending}
            failed={!!copies.error}
            busy={busy}
            onEdit={setEditingCopy}
            onToggle={toggle}
          />
          <RecordPager
            page={page}
            total={copies.data?.total ?? 0}
            onPage={setPage}
            label="文案分页"
          />
        </section>
      </div>
      {editingCategory && (
        <CategoryForm
          category={editingCategory.category}
          defaultParent={editingCategory.parent}
          categories={categoryRows}
          close={() => setEditingCategory(null)}
          saved={async () => {
            setEditingCategory(null);
            await refresh();
          }}
        />
      )}
      {editingCopy && (
        <CopyForm
          copy={editingCopy === "new" ? undefined : editingCopy}
          defaultCategory={selected}
          categories={categoryRows}
          close={() => setEditingCopy(null)}
          saved={async () => {
            setEditingCopy(null);
            await refresh();
          }}
        />
      )}
    </>
  );
}
