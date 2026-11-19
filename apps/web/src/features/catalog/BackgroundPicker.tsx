import {
  cloneElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Image, Pagination } from "antd";
import {
  loadCatalogPages,
  routes,
  type AssetDTO,
  type ResourceDTO,
} from "@fastposter/api-client";
import {
  Button,
  Dialog,
  LoadingState,
  Select,
  Status,
  TextInput,
  restoreLayerFocus,
  useErrorNotice,
} from "@fastposter/ui";
import { request, errorMessage } from "../../api";
import { useSession } from "../auth/Session";

const PAGE_SIZE = 24;

/** FP-05: the stable identity a create-mode selection is re-checked against. */
type Selection = {
  resourceId: string;
  resourceVersion: string;
  assetId: string;
  assetVersion: string;
};
function identity(resource: ResourceDTO): Selection | null {
  const asset = resource.asset;
  if (!asset) return null;
  return {
    resourceId: resource.id,
    resourceVersion: resource.version,
    assetId: asset.id,
    assetVersion: asset.version,
  };
}
function sameSelection(a: Selection | null, b: Selection | null) {
  return (
    !!a &&
    !!b &&
    a.resourceId === b.resourceId &&
    a.resourceVersion === b.resourceVersion &&
    a.assetId === b.assetId &&
    a.assetVersion === b.assetVersion
  );
}

type Preview = {
  target: Selection;
  title: string;
  src: string | undefined;
  opener: HTMLButtonElement;
};

function BackgroundPreview({
  preview,
  searchInput,
  close,
}: {
  preview: Preview;
  searchInput: RefObject<HTMLInputElement | null>;
  close: () => void;
}) {
  const [failed, setFailed] = useState(!preview.src);
  useEffect(
    () => () => restoreLayerFocus(preview.opener, () => searchInput.current),
    [preview.opener, searchInput],
  );

  return (
    <Image
      alt={preview.title}
      styles={{ root: { display: "none" } }}
      preview={{
        open: true,
        src: preview.src,
        onOpenChange: (open) => {
          // Unmount the preview on close so an interrupted transition cannot
          // leave an invisible modal over the library.
          if (!open) close();
        },
        imageRender: (image) =>
          failed ? (
            <Status tone="error">原图加载失败，请关闭预览后重试。</Status>
          ) : (
            cloneElement(image as ReactElement<{ onError: () => void }>, {
              onError: () => setFailed(true),
            })
          ),
        actionsRender: (actions) => (failed ? null : actions),
      }}
    />
  );
}

export function BackgroundPicker({
  mode,
  onChoose,
  onClose,
  onBack,
  restoreFocusTo,
}: {
  mode: "create" | "replace";
  onChoose: (asset: AssetDTO, resource: ResourceDTO) => void | Promise<void>;
  onClose: () => void;
  /** Create mode: return to the source-selection dialog. */
  onBack?: () => void;
  /** Stable bottom-bar entry when a source swap removed the opening trigger. */
  restoreFocusTo?: () => HTMLElement | null;
}) {
  const { user } = useSession();
  const isCreate = mode === "create";
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState(""),
    [category, setCategory] = useState("");
  const [selected, setSelected] = useState<Selection | null>(null);
  const [confirmError, setConfirmError] = useState("");
  const [rechecking, setRechecking] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  /* A live mirror of the account, query and selection a re-check reply must
     still match. Written during render (as useCreationScope does) so a change
     made while the request is in flight invalidates the stale reply. */
  const live = useRef<{
    account: string;
    page: number;
    keyword: string;
    category: string;
    selected: Selection | null;
  }>({ account: "", page, keyword, category, selected });
  live.current = {
    account: user?.id ?? "",
    page,
    keyword,
    category,
    selected,
  };
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
      loadCatalogPages((page, pageSize) =>
        request(routes.ListCatalog, {
          kind: "background-category",
          page,
          pageSize,
        }),
      ),
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
  /* FP-05 "选中": an external visibility change must not leave an invisible
     asset selected and submittable. Filter/page handlers clear immediately to
     close the loading window; this effect covers a refetch with the same key. */
  useEffect(() => {
    if (!isCreate || !q.data || !selected) return;
    const visible = q.data.resources.some((resource) =>
      sameSelection(identity(resource), selected),
    );
    if (!visible) setSelected(null);
  }, [q.data, selected, isCreate]);

  useEffect(() => {
    if (!preview || !q.data) return;
    const visible = q.data.resources.some((resource) =>
      sameSelection(identity(resource), preview.target),
    );
    if (!visible) setPreview(null);
  }, [q.data, preview]);

  function changeFilter(next: {
    keyword?: string;
    category?: string;
    page?: number;
  }) {
    if (next.keyword !== undefined) setKeyword(next.keyword);
    if (next.category !== undefined) setCategory(next.category);
    if (next.page !== undefined) setPage(next.page);
    setSelected(null);
    setConfirmError("");
  }

  function clearInvalid(reason: string) {
    setSelected(null);
    setConfirmError(`${reason}，请重新选择确认`);
  }

  async function confirm() {
    const snap = { ...live.current };
    if (!snap.selected) return;
    setRechecking(true);
    setConfirmError("");
    let chosen: { asset: AssetDTO; resource: ResourceDTO } | null = null;
    try {
      /* Ruling 66: a fresh public-catalog read with the same filter/page. */
      const reply = await request(routes.ListCatalog, {
        kind: "background",
        page: snap.page,
        pageSize: PAGE_SIZE,
        keyword: snap.keyword,
        categoryId: snap.category || undefined,
      });
      const now = live.current;
      // The reply is usable only within the same account, query and identity.
      if (now.account !== snap.account) return;
      if (
        now.page !== snap.page ||
        now.keyword !== snap.keyword ||
        now.category !== snap.category
      )
        return;
      if (!sameSelection(now.selected, snap.selected)) return;
      const resource = reply.resources.find(
        (r) => r.id === snap.selected!.resourceId,
      );
      if (!resource) return clearInvalid("该背景已下架或不可见");
      if (resource.version !== snap.selected!.resourceVersion)
        return clearInvalid("该背景已改版");
      const asset = resource.asset;
      if (!asset) return clearInvalid("该背景的素材不可用");
      if (
        asset.id !== snap.selected!.assetId ||
        asset.version !== snap.selected!.assetVersion
      )
        return clearInvalid("该背景素材已更新");
      // Pass the fresh, re-checked metadata and the resource title to A05.
      chosen = { asset, resource };
    } catch (e) {
      if (live.current.account !== snap.account) return;
      // FP-05: a failed re-check keeps filter and page for a retry, no create.
      setConfirmError(
        `背景复查失败，筛选和分页已保留，请重试（${errorMessage(e)}）`,
      );
      return;
    } finally {
      setRechecking(false);
    }
    if (chosen) await onChoose(chosen.asset, chosen.resource);
  }

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
          ref={searchInput}
          aria-label="搜索预设背景"
          placeholder="搜索背景"
          value={keyword}
          onChange={(e) => changeFilter({ keyword: e.target.value, page: 1 })}
        />
        <Select
          aria-label="预设背景分类"
          value={category}
          onValueChange={(value) => changeFilter({ category: value, page: 1 })}
          options={[
            { value: "", label: "全部分类" },
            ...(categories.isSuccess
              ? categories.data.map((r) => ({ value: r.id, label: r.title }))
              : []),
          ]}
        />
      </div>
      {categories.isError && (
        <div data-testid="category-error" className="picker-failed">
          <Status tone="error">分类加载失败，请重新加载</Status>
          <Button onClick={() => void categories.refetch()}>重新加载</Button>
        </div>
      )}
      <div className="background-picker-grid">
        {q.data?.resources.map((r) => {
          const target = identity(r);
          if (!r.asset || !target) return null;
          const asset = r.asset;
          const sel = isCreate && sameSelection(selected, target);
          return (
            <div className="background-card fp-actionable-card" key={r.id}>
              <Button
                className="background-select"
                variant={sel ? "primary" : "secondary"}
                aria-label={isCreate ? `选择 ${r.title}` : `选用 ${r.title}`}
                aria-pressed={isCreate ? !!sel : undefined}
                data-selected={isCreate && sel ? "" : undefined}
                onClick={() => {
                  if (isCreate) {
                    setSelected(target);
                    setConfirmError("");
                  } else {
                    // Ruling 63: replace keeps the one-click 「选用 X」 flow.
                    void onChoose(asset, r);
                  }
                }}
              >
                <img src={asset.previewUrl} alt="" />
                <span>{r.title}</span>
                <small>
                  {asset.width} × {asset.height}
                  {isCreate && sel ? " · 已选中" : ""}
                </small>
              </Button>
              <Button
                className="background-zoom"
                aria-label={`放大预览 ${r.title}`}
                aria-haspopup="dialog"
                onClick={(event) =>
                  setPreview({
                    target,
                    title: r.title,
                    src: asset.url,
                    opener: event.currentTarget,
                  })
                }
              >
                放大预览
              </Button>
            </div>
          );
        })}
      </div>
      {preview && (
        <BackgroundPreview
          preview={preview}
          searchInput={searchInput}
          close={() => setPreview(null)}
        />
      )}
      {q.isPending && <LoadingState label="正在加载预设背景…" />}
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
            onChange={(p) => changeFilter({ page: p })}
          />
        </nav>
      )}
      {isCreate && confirmError && (
        <div data-testid="picker-confirm-error" style={{ marginTop: 16 }}>
          <Status tone="error">{confirmError}</Status>
        </div>
      )}
      {isCreate && (
        <div
          className="picker-actions"
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
            marginTop: 20,
          }}
        >
          {onBack && <Button onClick={onBack}>返回来源</Button>}
          <Button
            variant="primary"
            disabled={!selected || rechecking}
            busy={rechecking}
            onClick={() => void confirm()}
          >
            用此背景创建
          </Button>
        </div>
      )}
    </Dialog>
  );
}
