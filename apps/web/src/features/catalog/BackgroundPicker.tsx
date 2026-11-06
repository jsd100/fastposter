import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pagination } from "antd";
import { routes, type AssetDTO } from "@fastposter/api-client";
import {
  Button,
  Dialog,
  Select,
  Status,
  TextInput,
  useErrorNotice,
} from "@fastposter/ui";
import { request, errorMessage } from "../../api";
import { useSession } from "../auth/Session";

const PAGE_SIZE = 24;
export function BackgroundPicker({
  onChoose,
  onClose,
  restoreFocusTo,
}: {
  onChoose: (asset: AssetDTO) => void;
  onClose: () => void;
  /** Stable bottom-bar entry when a source swap removed the opening trigger. */
  restoreFocusTo?: () => HTMLElement | null;
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
        pageSize: PAGE_SIZE,
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
  useErrorNotice(
    "catalog:backgrounds",
    q.error ? errorMessage(q.error) : null,
    {
      persistent: true,
      action: { label: "重新加载", onClick: () => void q.refetch() },
    },
  );
  useErrorNotice(
    "catalog:background-categories",
    categories.error ? errorMessage(categories.error) : null,
    {
      persistent: true,
      action: { label: "重新加载", onClick: () => void categories.refetch() },
    },
  );
  return (
    <Dialog
      title="背景库"
      className="background-picker"
      onClose={onClose}
      restoreFocusTo={restoreFocusTo}
    >
      <p>选择预设背景。不同尺寸会调整画布和文字位置，字号保持不变。</p>
      <div className="picker-filters">
        <TextInput
          variant="bare"
          aria-label="搜索预设背景"
          placeholder="搜索背景"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
        />
        <Select
          aria-label="预设背景分类"
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
      </div>
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
      {q.error && (
        <div className="picker-failed">
          <Status tone="error">预设背景加载失败，当前筛选已保留。</Status>
          <Button onClick={() => void q.refetch()}>重新加载</Button>
        </div>
      )}
      {q.data?.resources.length === 0 && (
        <p className="picker-empty">暂无已发布的背景。</p>
      )}
      {(q.data?.total ?? 0) > PAGE_SIZE && (
        <nav className="picker-pager" aria-label="预设背景分页">
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={q.data?.total ?? 0}
            showSizeChanger={false}
            onChange={setPage}
          />
        </nav>
      )}
    </Dialog>
  );
}
