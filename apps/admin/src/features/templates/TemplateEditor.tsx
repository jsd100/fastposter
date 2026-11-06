import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  apiClient,
  routes,
  type AssetDTO,
  type AssetReply,
  type ResourceDTO,
} from "@fastposter/api-client";
import {
  Button,
  CheckboxField,
  NumberField,
  Select,
  Status,
  TextInput,
  Workbench,
  useErrorNotice,
} from "@fastposter/ui";
import { Editor, type BackgroundAsset } from "@fastposter/poster-editor";
import { loadFonts, type FontSource } from "@fastposter/poster-renderer";
import { parseDocument, type PosterDocument } from "@fastposter/poster-schema";
import { errorMessage, request } from "../../api";

export function TemplateEditor({
  resource,
  close,
  saved,
  restoreFocusTo,
}: {
  resource?: ResourceDTO;
  close: () => void;
  saved: () => Promise<void>;
  /** Stable list entry to focus when the opening card was removed. */
  restoreFocusTo?: () => HTMLElement | null;
}) {
  const initial = useMemo<PosterDocument | null>(() => {
    if (!resource?.document) return null;
    try {
      return parseDocument(JSON.parse(resource.document));
    } catch {
      return null;
    }
  }, [resource]);
  const [title, setTitle] = useState(resource?.title ?? ""),
    [categoryId, setCategoryId] = useState(resource?.categoryId ?? ""),
    [sortOrder, setSortOrder] = useState(resource?.sortOrder ?? 0),
    [published, setPublished] = useState(resource?.published ?? false),
    [draft, setDraft] = useState<PosterDocument | null>(initial),
    [error, setError] = useState(
      resource && !initial ? "模板文档已损坏，无法编辑" : "",
    ),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [overflow, setOverflow] = useState(false),
    [availableFonts, setAvailableFonts] = useState<FontSource[]>([]),
    [fontsReady, setFontsReady] = useState(false);
  const backgroundFile = useRef<HTMLInputElement>(null);
  const categories = useQuery({
    queryKey: ["admin", "categories", "template"],
    queryFn: () =>
      request(routes.AdminResources, {
        kind: "template-category",
        page: 1,
        pageSize: 100,
      }),
    retry: false,
  });
  const fontQuery = useQuery({
    queryKey: ["font-catalog"],
    queryFn: () => request(routes.ListFonts, {}),
    retry: false,
    staleTime: 60_000,
  });
  useErrorNotice("admin:template-editor", error || null);
  useErrorNotice(
    "admin:template-editor-fonts",
    fontQuery.error ? errorMessage(fontQuery.error) : null,
    {
      persistent: true,
      action: { label: "重新加载", onClick: () => void fontQuery.refetch() },
    },
  );
  const fontSignature = JSON.stringify(initial?.fonts ?? []);
  useEffect(() => {
    if (!fontQuery.data) return;
    const sources: FontSource[] = fontQuery.data.fonts.map((f) => ({
      ...f,
      style: f.style === "italic" ? "italic" : "normal",
    }));
    const needed: FontSource[] = [];
    for (const ref of initial?.fonts ?? []) {
      let match = sources.find(
        (f) => f.assetId === ref.assetId && f.version === ref.version,
      );
      if (!match) {
        match = {
          ...ref,
          url: `/api/v1/assets/${ref.assetId}/versions/${ref.version}`,
          style: ref.style === "italic" ? "italic" : "normal",
        };
        sources.push(match);
      }
      needed.push(match);
    }
    setAvailableFonts(sources);
    setFontsReady(true);
    if (!needed.length) return;
    let active = true;
    loadFonts(needed).catch((e) => {
      if (active) setError(errorMessage(e));
    });
    return () => {
      active = false;
    };
  }, [fontQuery.data, fontSignature]);
  function background(): Promise<BackgroundAsset | undefined> {
    return new Promise((resolve) => {
      const input = backgroundFile.current;
      if (!input) return resolve(undefined);
      const done = () => {
        input.removeEventListener("change", choose);
        input.removeEventListener("cancel", cancel);
        resolve(undefined);
      };
      const choose = () => {
        const file = input.files?.[0];
        input.removeEventListener("change", choose);
        input.removeEventListener("cancel", cancel);
        input.value = "";
        if (!file) return resolve(undefined);
        const form = new FormData();
        form.append("file", file);
        setUploading(true);
        apiClient
          .upload<AssetReply>("/api/v1/assets/images", form)
          .then(({ asset }) =>
            resolve({
              id: asset.id,
              version: asset.version,
              width: asset.width,
              height: asset.height,
            }),
          )
          .catch((e) => {
            setError(errorMessage(e));
            resolve(undefined);
          })
          .finally(() => setUploading(false));
      };
      const cancel = () => done();
      input.addEventListener("change", choose);
      input.addEventListener("cancel", cancel);
      input.click();
    });
  }
  async function createFromBackground(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const { asset } = await apiClient.upload<AssetReply>(
        "/api/v1/assets/images",
        form,
      );
      if (!title.trim())
        setTitle(file.name.replace(/\.[^.]+$/, "") || "新模板");
      setDraft({
        schemaVersion: 1,
        canvas: { width: asset.width, height: asset.height },
        background: { assetId: asset.id, version: asset.version },
        fonts: [],
        textBlocks: [],
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
      if (backgroundFile.current) backgroundFile.current.value = "";
    }
  }
  async function save() {
    if (!draft || busy) return;
    if (!title.trim()) {
      setError("请填写模板名称");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await request(routes.AdminSaveResource, {
        id: resource?.id,
        kind: "template",
        title,
        categoryId: categoryId || undefined,
        sortOrder,
        published,
        document: JSON.stringify(draft),
      });
      await saved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Workbench
      label="模板编辑器"
      className="template-editor-overlay"
      restoreFocusTo={restoreFocusTo}
    >
      <header className="template-editor-header">
        <div className="template-editor-meta">
          <TextInput
            variant="bare"
            className="template-title-input"
            aria-label="模板名称"
            placeholder="模板名称"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Select
            aria-label="模板分类"
            value={categoryId}
            onValueChange={setCategoryId}
            options={[
              { value: "", label: "未分类" },
              ...(categories.data?.resources.map((r) => ({
                value: r.id,
                label: r.title,
              })) ?? []),
            ]}
          />
          <label className="template-sort">
            排序
            <NumberField
              className="template-sort-field"
              aria-label="模板排序"
              min={0}
              max={100000}
              value={sortOrder}
              onValueChange={setSortOrder}
            />
          </label>
          <CheckboxField
            label="发布模板"
            checked={published}
            onChange={setPublished}
          />
        </div>
        <div className="template-editor-actions">
          {overflow && <span className="template-overflow">文字超出画布</span>}
          <Button
            variant="primary"
            busy={busy}
            disabled={!draft || uploading || !fontsReady}
            onClick={() => void save()}
          >
            保存模板
          </Button>
          <Button disabled={busy} onClick={close}>
            关闭
          </Button>
        </div>
      </header>
      {!draft ? (
        <div className="template-editor-empty">
          <h2>{resource ? "模板文档不可用" : "选择模板背景"}</h2>
          <p>背景将保持原始像素尺寸，文字可在画布上自由排版。</p>
          <Button
            variant="primary"
            busy={uploading}
            onClick={() => backgroundFile.current?.click()}
          >
            上传背景图
          </Button>
        </div>
      ) : !fontsReady ? (
        <div className="template-editor-empty">
          <Status>正在载入字体…</Status>
        </div>
      ) : (
        <div className="template-editor-canvas">
          <Editor
            document={draft}
            onChange={setDraft}
            checkFonts={async (candidate) => {
              await request(routes.CheckFonts, {
                document: JSON.stringify(candidate),
              });
            }}
            fontCheckScope={`admin:template:${resource?.id ?? "new"}`}
            availableFonts={availableFonts}
            onAssetRequest={background}
            onOverflowChange={setOverflow}
          />
        </div>
      )}
      {/*
        The canvas asks for a background through a promise that has to settle
        when the OS dialog is dismissed, so this stays a headless native input
        that the editor clicks; `FileField` owns the flows where the page itself
        submits. Its accessible name is how the request stays reachable.
      */}
      <input
        ref={backgroundFile}
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="模板背景图片文件"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && !draft) void createFromBackground(file);
        }}
      />
    </Workbench>
  );
}
