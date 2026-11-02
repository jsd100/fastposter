import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { routes, type ResourceDTO } from "@fastposter/api-client";
import { Button, Dialog, Select, Status, TextInput } from "@fastposter/ui";
import { request, errorMessage } from "../../api";
import { useSession } from "../auth/Session";

const PAGE_SIZE = 50;

type CategoryNode = ResourceDTO & { children: CategoryNode[] };

function categoryTree(rows: ResourceDTO[]): CategoryNode[] {
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

export function CopyPicker({
  onChoose,
  onClose,
}: {
  onChoose: (text: string) => void;
  onClose: () => void;
}) {
  const { user } = useSession();
  const [keyword, setKeyword] = useState(""),
    [page, setPage] = useState(1),
    [path, setPath] = useState<string[]>([]);
  const categories = useQuery({
    queryKey: ["copy-categories", user!.id],
    queryFn: async () => {
      const resources: ResourceDTO[] = [];
      let total = 0;
      for (let page = 1; page <= 1000; page++) {
        const reply = await request(routes.ListCatalog, {
          kind: "copy-category",
          page,
          pageSize: 100,
        });
        total = reply.total;
        resources.push(...reply.resources);
        if (resources.length >= total || reply.resources.length === 0) break;
      }
      return { resources, total };
    },
    retry: false,
    staleTime: 60_000,
  });
  const roots = useMemo(
    () => categoryTree(categories.data?.resources ?? []),
    [categories.data],
  );
  const levels: CategoryNode[][] = [];
  let current = roots;
  while (current.length) {
    levels.push(current);
    const selected = path[levels.length - 1];
    const node = selected
      ? current.find((item) => item.id === selected)
      : undefined;
    if (!node) break;
    current = node.children;
  }
  const selected = path.length ? path[path.length - 1] : "";
  const copies = useQuery({
    queryKey: ["copies", user!.id, selected, keyword, page],
    queryFn: () =>
      request(routes.ListCatalog, {
        kind: "copy",
        page,
        pageSize: PAGE_SIZE,
        categoryId: selected || undefined,
        keyword: keyword || undefined,
      }),
    retry: false,
  });
  return (
    <Dialog title="文案库" className="copy-picker" onClose={onClose}>
      <p>
        选择分类浏览已发布文案。无选区时新建文字块；选中文字时替换选区并沿用当前样式。
      </p>
      <div className="picker-filters">
        <TextInput variant="bare"
          aria-label="搜索文案"
          placeholder="搜索文案标题或内容"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {categories.error && (
        <Status tone="error">{errorMessage(categories.error)}</Status>
      )}
      {categories.isPending && <Status>正在加载文案分类…</Status>}
      {levels.length > 0 && (
        <div className="copy-category-path">
          {levels.map((nodes, depth) => (
            <Select
              key={depth}
              aria-label={`文案分类第${depth + 1}级`}
              value={path[depth] ?? ""}
              onValueChange={(value) => {
                setPath((previous) =>
                  value
                    ? [...previous.slice(0, depth), value]
                    : previous.slice(0, depth),
                );
                setPage(1);
              }}
              options={[
                {
                  value: "",
                  label: depth === 0 ? "全部分类" : `第 ${depth + 1} 级分类`,
                },
                ...nodes.map((node) => ({
                  value: node.id,
                  label: node.title,
                })),
              ]}
            />
          ))}
        </div>
      )}
      {copies.error && (
        <Status tone="error">{errorMessage(copies.error)}</Status>
      )}
      <div className="copy-picker-list">
        {copies.data?.resources.map((row) => (
          <button
            key={row.id}
            aria-label={`使用文案 ${row.title}`}
            disabled={!row.body}
            onClick={() => onChoose(row.body ?? "")}
          >
            <strong>{row.title}</strong>
            <span>{row.body}</span>
          </button>
        ))}
      </div>
      {copies.isPending && <Status>正在加载文案…</Status>}
      {copies.data?.resources.length === 0 && (
        <p className="picker-empty">
          {selected ? "该分类暂无已发布文案。" : "暂无已发布文案。"}
        </p>
      )}
      {(copies.data?.total ?? 0) > PAGE_SIZE && (
        <div className="pagination">
          <Button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            上一页
          </Button>
          <span>{page}</span>
          <Button
            disabled={page * PAGE_SIZE >= (copies.data?.total ?? 0)}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </Dialog>
  );
}
