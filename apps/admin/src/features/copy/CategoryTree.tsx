import { Tooltip } from "@fastposter/ui";
import type { ResourceDTO } from "@fastposter/api-client";
import { Pencil, Plus } from "lucide-react";

export type CategoryNode = ResourceDTO & { children: CategoryNode[] };

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
  onSelect,
  onAdd,
  onEdit,
}: {
  categories: ResourceDTO[];
  selected: string;
  onSelect: (id: string) => void;
  onAdd: (parentId: string) => void;
  onEdit: (category: ResourceDTO) => void;
}) {
  const roots = categoryTree(categories);
  const row = (node: CategoryNode, depth: number) => (
    <div key={node.id}>
      <div className="copy-node-row">
        <button
          className={selected === node.id ? "copy-node active" : "copy-node"}
          style={{ paddingLeft: 10 + depth * 14 }}
          onClick={() => onSelect(node.id)}
        >
          <span>{node.title}</span>
          {!node.published && <i>未发布</i>}
        </button>
        <Tooltip label="添加子分类">
          <button
            className="copy-node-icon"
            aria-label={`添加子分类 ${node.title}`}
            onClick={() => onAdd(node.id)}
          >
            <Plus size={13} />
          </button>
        </Tooltip>
        <Tooltip label="编辑分类">
          <button
            className="copy-node-icon"
            aria-label={`编辑分类 ${node.title}`}
            onClick={() => onEdit(node)}
          >
            <Pencil size={13} />
          </button>
        </Tooltip>
      </div>
      {node.children.map((child) => row(child, depth + 1))}
    </div>
  );
  return (
    <aside className="copy-tree">
      <div className="copy-tree-head">
        <h2>文案分类</h2>
        <button
          className="copy-node-add"
          aria-label="新建根分类"
          onClick={() => onAdd("")}
        >
          <Plus size={14} />
          分类
        </button>
      </div>
      <button
        className={!selected ? "copy-node active root" : "copy-node root"}
        onClick={() => onSelect("")}
      >
        <span>全部文案</span>
      </button>
      {roots.map((node) => row(node, 0))}
      {!roots.length && (
        <p className="copy-tree-empty">
          还没有分类。先创建一级分类，逐层向下最多五级。
        </p>
      )}
    </aside>
  );
}
