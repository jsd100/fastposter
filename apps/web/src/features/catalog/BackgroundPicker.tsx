import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { routes, type AssetDTO } from "@fastposter/api-client";
import { Button, Dialog, Status } from "@fastposter/ui";
import { request, errorMessage } from "../../api";
import { useSession } from "../auth/Session";
export function BackgroundPicker({
  onChoose,
  onClose,
}: {
  onChoose: (asset: AssetDTO) => void;
  onClose: () => void;
}) {
  const { user } = useSession();
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState(""),
    [category, setCategory] = useState("");
  const q = useQuery({
    queryKey: ["backgrounds", user!.id, page, keyword, category],
    queryFn: () =>
      request(routes.ListCatalog, {
        kind: "background",
        page,
        pageSize: 24,
        keyword,
        categoryId: category || undefined,
      }),
    retry: false,
    staleTime: 0,
  });
  const categories = useQuery({
    queryKey: ["background-categories", user!.id],
    queryFn: () =>
      request(routes.ListCatalog, {
        kind: "background-category",
        page: 1,
        pageSize: 100,
      }),
    retry: false,
  });
  return (
    <Dialog title="背景库" className="background-picker" onClose={onClose}>
      <p>选择预设背景。不同尺寸会调整画布和文字位置，字号保持不变。</p>
      <div className="picker-filters">
        <input
          aria-label="搜索预设背景"
          placeholder="搜索背景"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="预设背景分类"
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
      </div>
      {q.error && <Status tone="error">{errorMessage(q.error)}</Status>}
      <div className="background-picker-grid">
        {q.data?.resources.map(
          (r) =>
            r.asset && (
              <button
                key={r.id}
                aria-label={`选用 ${r.title}`}
                onClick={() => onChoose(r.asset!)}
              >
                <img src={r.asset.previewUrl} alt="" />
                <span>{r.title}</span>
                <small>
                  {r.asset.width} × {r.asset.height}
                </small>
              </button>
            ),
        )}
      </div>
      {q.isPending && <Status>正在加载预设背景…</Status>}
      {q.data?.resources.length === 0 && (
        <p className="picker-empty">暂无已发布的背景。</p>
      )}
      {(q.data?.total ?? 0) > 24 && (
        <div className="pagination">
          <Button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            上一页
          </Button>
          <span>{page}</span>
          <Button
            disabled={page * 24 >= (q.data?.total ?? 0)}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </Dialog>
  );
}
