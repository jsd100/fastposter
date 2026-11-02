import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { routes, type ResourceDTO } from "@fastposter/api-client";
import { Button, Status, TextInput } from "@fastposter/ui";
import { Plus } from "lucide-react";
import { errorMessage, request } from "../../api";
import { Pager } from "../Metadata";
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
    [busy, setBusy] = useState("");
  const categories = useQuery({
    queryKey: ["admin", "copy-categories"],
    queryFn: () =>
      request(routes.AdminResources, {
        kind: "copy-category",
        page: 1,
        pageSize: 100,
      }),
    retry: false,
  });
  const copies = useQuery({
    queryKey: ["admin", "copies", selected, keyword, page],
    queryFn: () =>
      request(routes.AdminResources, {
        kind: "copy",
        page,
        pageSize: 24,
        keyword,
        categoryId: selected || undefined,
      }),
    retry: false,
  });
  const categoryRows = categories.data?.resources ?? [];
  useEffect(() => {
    if (
      selected &&
      categories.data &&
      !categoryRows.some((r) => r.id === selected)
    )
      setSelected("");
  }, [categories.data, categoryRows, selected]);
  const refresh = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["admin", "copy-categories"] }),
      cache.invalidateQueries({ queryKey: ["admin", "copies"] }),
    ]);
  };
  async function toggle(copy: ResourceDTO) {
    setBusy(copy.id);
    setError("");
    try {
      await request(routes.AdminSaveResource, {
        id: copy.id,
        kind: "copy",
        title: copy.title,
        body: copy.body,
        categoryId: copy.categoryId,
        sortOrder: copy.sortOrder,
        published: !copy.published,
      });
      await cache.invalidateQueries({ queryKey: ["admin", "copies"] });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
    }
  }
  const selectedTitle = categoryRows.find((r) => r.id === selected)?.title;
  return (
    <>
      <div className="admin-title-row">
        <div>
          <span className="eyebrow">CASCADING COPY CATALOG</span>
          <h1>
            文案库<span>.</span>
          </h1>
          <p className="admin-subtitle">
            维护最多五层的分类树与纯文本文案；发布后用户可按分类逐级筛选并插入编辑器。
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditingCopy("new")}>
          <Plus size={15} />
          新建文案
        </Button>
      </div>
      <div className="copy-layout">
        <CategoryTree
          categories={categoryRows}
          selected={selected}
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
            <TextInput variant="bare"
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
          {categories.error && (
            <Status tone="error">{errorMessage(categories.error)}</Status>
          )}
          {(error || copies.error) && (
            <Status tone="error">{error || errorMessage(copies.error)}</Status>
          )}
          <CopyList
            resources={copies.data?.resources ?? []}
            loading={copies.isPending}
            error=""
            busy={busy}
            onEdit={setEditingCopy}
            onToggle={toggle}
          />
          <Pager page={page} total={copies.data?.total ?? 0} onPage={setPage} />
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
