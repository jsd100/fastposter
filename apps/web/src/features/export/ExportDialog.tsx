import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { routes, type JobDTO, type ProjectDTO } from "@fastposter/api-client";
import { Button, Dialog, Status } from "@fastposter/ui";
import { Download, CheckCircle2 } from "lucide-react";
import { request, errorMessage } from "../../api";
export function ExportControls({
  projectId,
  userId,
  flush,
  overflow,
  blocked,
}: {
  projectId: string;
  userId: string;
  flush: () => Promise<ProjectDTO>;
  overflow: boolean;
  blocked: boolean;
}) {
  const [open, setOpen] = useState(false),
    [job, setJob] = useState<JobDTO | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["export", userId, job?.id],
    enabled: !!job,
    queryFn: () => request(routes.GetExport, { id: job!.id }),
    initialData: job ? { requestId: "", job } : undefined,
    refetchInterval: (q) => {
      const state = q.state.data?.job.status;
      return state === "queued" || state === "running" ? 1000 : false;
    },
    retry: false,
  });
  const current = query.data?.job ?? job;
  const running = current?.status === "queued" || current?.status === "running";
  async function start() {
    if (busy) return;
    setOpen(true);
    setBusy(true);
    setError("");
    try {
      const saved = await flush();
      const result = await request(routes.CreateExport, {
        projectId,
        revision: saved.revision,
        idempotencyKey: crypto.randomUUID(),
      });
      setJob(result.job);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="primary"
        aria-label="导出 PNG"
        disabled={overflow || blocked}
        onClick={() => {
          if (running) setOpen(true);
          else void start();
        }}
      >
        <Download size={15} />
        {running ? "查看导出" : "导出 PNG"}
      </Button>
      {open && (
        <Dialog
          title="导出海报"
          className="export-dialog"
          onClose={() => setOpen(false)}
        >
          {busy ? (
            <Status>
              <span className="spinner" />
              正在保存最新修改并创建导出…
            </Status>
          ) : null}
          {error && <Status tone="error">{error}</Status>}
          {query.error && (
            <Status tone="error">
              {errorMessage(query.error)}
              <Button onClick={() => void query.refetch()}>重试查询</Button>
            </Status>
          )}
          {current && !busy && (
            <>
              <div className="export-version">
                <span>作品版本 {current.revision}</span>
                <span>PNG · 原图像素</span>
              </div>
              {running && (
                <div className="export-wait">
                  <span className="spinner" />
                  <h3>
                    {current.status === "queued"
                      ? "正在排队"
                      : "正在生成原尺寸图片"}
                  </h3>
                  <p>可以关闭此窗口继续编辑，本次结果保持这个版本。</p>
                </div>
              )}
              {current.status === "failed" && (
                <Status tone="error">
                  {current.errorMessage ?? "导出失败，请检查排版后重试"}
                </Status>
              )}
              {current.status === "succeeded" && (
                <>
                  <div className="export-final-preview">
                    <img src={current.previewUrl} alt="最终导出图片" />
                  </div>
                  <p className="export-success">
                    <CheckCircle2 size={15} />
                    最终预览与下载使用同一个 PNG 文件。
                  </p>
                  <a
                    className="button button-primary export-download"
                    href={current.downloadUrl}
                    download
                    aria-label="下载原尺寸 PNG"
                  >
                    <Download size={16} />
                    下载原尺寸 PNG
                  </a>
                  <p className="property-hint">
                    结果保留 7 天；到期后可重新导出。
                  </p>
                </>
              )}
            </>
          )}
          {!busy && !running && (error || current?.status === "failed") && (
            <Button variant="primary" onClick={() => void start()}>
              重新导出
            </Button>
          )}
        </Dialog>
      )}
    </>
  );
}
