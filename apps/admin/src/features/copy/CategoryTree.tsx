import { Tree } from "antd";
import type { TreeDataNode } from "antd";
import { IconButton, LoadingState, Status, Tooltip } from "@fastposter/ui";
import type { ResourceDTO } from "@fastposter/api-client";
import { Pencil, Plus, RotateCcw } from "lucide-react";
import { listState } from "../catalog-state";

export type CategoryNode = ResourceDTO & { children: CategoryNode[] };

/**
 * The tree's root is not a category: it is "everything", which the page already
 * spells as an empty selection. It gets its own key because an empty string is
 * what antd reports for "nothing selected".
 */
const ALL_KEY = "__all__";

export function categoryTree(rows: ResourceDTO[]): CategoryNode[] {
  const nodes = new Map(
    rows.map((row) => [row.id, { ...row, children: [] as CategoryNode[] }]),
  );
  const roots: CategoryNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id)!;
    if (!row.parentId) roots.push(node);
    else nodes.get(row.parentId)?.children.push(node);
  }
  const sort = (list: CategoryNode[]) => {
    list.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
    );
    for (const node of list) sort(node.children);
  };
  sort(roots);
  return roots;
}

export function flattenCategories(
  rows: ResourceDTO[],
): { node: ResourceDTO; depth: number }[] {
  const out: { node: ResourceDTO; depth: number }[] = [];
  const walk = (nodes: CategoryNode[], depth: number) => {
    for (const node of nodes) {
      out.push({ node, depth });
      walk(node.children, depth + 1);
    }
  };
  walk(categoryTree(rows), 0);
  return out;
}

export function CategoryTree({
  categories,
  selected,
  loading,
  failed,
  onRetry,
  onSelect,
  onAdd,
  onEdit,
}: {
  categories: ResourceDTO[];
  selected: string;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onSelect: (id: string) => void;
  onAdd: (parentId: string) => void;
  onEdit: (category: ResourceDTO) => void;
}) {
  const state = listState({
    pending: loading,
    failed,
    rows: categories.length,
  });
  const roots = categoryTree(categories);
  const node = (category: CategoryNode): TreeDataNode => ({
    key: category.id,
    title: (
      <span className="copy-node-row">
        <span className="copy-node-title">{category.title}</span>
        {!category.published && <i>未发布</i>}
        <Tooltip label="添加子分类">
          <IconButton
            className="copy-node-icon"
            aria-label={`添加子分类 ${category.title}`}
            onClick={(event) => {
              // The row owns selection; a icon press must not also select it.
              event.stopPropagation();
              onAdd(category.id);
            }}
          >
            <Plus size={13} />
          </IconButton>
        </Tooltip>
        <Tooltip label="编辑分类">
          <IconButton
            className="copy-node-icon"
            aria-label={`编辑分类 ${category.title}`}
            onClick={(event) => {
              event.stopPropagation();
              onEdit(category);
            }}
          >
            <Pencil size={13} />
          </IconButton>
        </Tooltip>
      </span>
    ),
    children: category.children.map(node),
  });
  const treeData: TreeDataNode[] = [
    {
      key: ALL_KEY,
      title: <span className="copy-node-title">全部文案</span>,
      children: roots.map(node),
    },
  ];
  return (
    <aside className="copy-tree" aria-label="文案分类树">
      <div className="copy-tree-head">
        <h2>文案分类</h2>
        <IconButton aria-label="新建根分类" onClick={() => onAdd("")}>
          <Plus size={14} />
        </IconButton>
      </div>
      {state === "loading" && <LoadingState label="正在加载分类…" />}
      {state === "failed" && (
        <div className="copy-tree-failed">
          <Status tone="error">分类加载失败</Status>
          <Tooltip label="重新加载分类">
            <IconButton aria-label="重新加载分类" onClick={onRetry}>
              <RotateCcw size={14} />
            </IconButton>
          </Tooltip>
        </div>
      )}
      {state === "empty" && (
        <p className="copy-tree-empty">
          还没有分类。先创建一级分类，逐层向下最多五级。
        </p>
      )}
      {state === "ready" && (
        <Tree
          blockNode
          defaultExpandAll
          treeData={treeData}
          selectedKeys={[selected || ALL_KEY]}
          onSelect={(keys) => {
            if (!keys.length) return;
            const key = String(keys[0]);
            onSelect(key === ALL_KEY ? "" : key);
          }}
        />
      )}
    </aside>
  );
}
