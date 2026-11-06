import { useState } from "react";
import type { HTMLAttributes } from "react";
import { useQuery } from "@tanstack/react-query";
import { Spin, Table, Tag } from "antd";
import type { TableProps } from "antd";
import { routes, type JobDTO } from "@fastposter/api-client";
import { Button, Dialog, useErrorNotice } from "@fastposter/ui";
import { errorMessage, request } from "../api";
import { useNarrowScreen } from "../useNarrowScreen";
import {
  PAGE_SIZE,
  NoRecords,
  RecordPager,
  RecordSection,
  emptyText,
  formatDate,
} from "./records";

/**
 * Queue states the contract names, plus any value the worker grew since. An
 * unrecognised status is shown as it arrived rather than guessed at, because a
 * mislabelled export is worse than an unfamiliar one.
 */
const STATUS: Record<string, { label: string; tone?: string }> = {
  queued: { label: "排队中" },
  running: { label: "运行中", tone: "processing" },
  succeeded: { label: "成功", tone: "success" },
  failed: { label: "失败", tone: "error" },
};

function JobStatus({ status }: { status: string }) {
  const known = STATUS[status];
  return (
    <Tag color={known?.tone}>{known?.label ?? status}</Tag>
  );
}

function JobDetails({
  job,
  onClose,
}: {
  job: JobDTO;
  onClose: () => void;
}) {
  return (
    <Dialog title="导出任务失败详情" closable={false} onClose={onClose}>
      <dl className="admin-job-meta" data-testid="job-meta">
        <div>
          <dt>任务 ID</dt>
          <dd className="admin-code">{job.id}</dd>
        </div>
        <div>
          <dt>作品 ID</dt>
          <dd className="admin-code">{job.projectId}</dd>
        </div>
        <div>
          <dt>版本</dt>
          <dd>{job.revision}</dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>
            <JobStatus status={job.status} />
          </dd>
        </div>
        <div>
          <dt>创建时间</dt>
          <dd>{formatDate(job.createdAt)}</dd>
        </div>
      </dl>
      <h2 className="admin-job-error-title">错误描述</h2>
      <p className="admin-job-error" data-testid="job-error">
        {job.errorMessage ?? "任务没有留下错误描述。"}
      </p>
      <p className="admin-note-line">
        结果图片、预览和海报正文只属于作品所有者，后台不读取。
      </p>
      <div className="dialog-actions">
        <Button onClick={onClose}>关闭</Button>
      </div>
    </Dialog>
  );
}

/**
 * One query, two presentations: a semantic table with column headers on a
 * wide screen and a summary list on a phone. Both key their rows by the task
 * ID, so an operator can compare what they see with what the worker stored.
 */
export function JobsPage() {
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<JobDTO | null>(null);
  const narrow = useNarrowScreen();
  const q = useQuery({
    queryKey: ["admin", "jobs", page],
    queryFn: () => request(routes.AdminJobs, { page, pageSize: PAGE_SIZE }),
    retry: false,
    refetchInterval: 5000,
  });
  useErrorNotice("admin:jobs", q.error ? errorMessage(q.error) : null, {
    persistent: true,
    action: { label: "重新加载", onClick: () => void q.refetch() },
  });
  const jobs = q.data?.jobs ?? [];
  const columns: TableProps<JobDTO>["columns"] = [
    {
      title: "任务 ID",
      dataIndex: "id",
      render: (id: string) => <span className="mono">{id}</span>,
    },
    {
      title: "作品 ID",
      dataIndex: "projectId",
      render: (id: string) => <span className="mono">{id}</span>,
    },
    { title: "版本", dataIndex: "revision" },
    {
      title: "状态",
      dataIndex: "status",
      render: (status: string) => <JobStatus status={status} />,
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      render: (value: string) => formatDate(value),
    },
    {
      title: "操作",
      key: "action",
      render: (_value, job) =>
        job.status === "failed" && (
          <Button variant="ghost" onClick={() => setDetail(job)}>
            查看失败原因
          </Button>
        ),
    },
  ];
  return (
    <>
      <h1>
        导出任务<span>.</span>
      </h1>
      <p className="admin-subtitle">
        查看队列状态与错误类型。结果图片和正文详情仅作品所有者可读取。
      </p>
      <RecordSection name="导出任务记录">
        {narrow ? (
          <Spin spinning={q.isPending}>
            {jobs.length > 0 && (
              <ul className="admin-summary">
                {jobs.map((job) => (
                  <li
                    className="admin-summary-item"
                    data-admin-record={job.id}
                    key={job.id}
                  >
                    <div className="admin-summary-head">
                      <span className="admin-code">{job.id}</span>
                      <JobStatus status={job.status} />
                    </div>
                    <dl className="admin-summary-meta">
                      <div>
                        <dt>作品</dt>
                        <dd className="admin-code">{job.projectId}</dd>
                      </div>
                      <div>
                        <dt>版本</dt>
                        <dd>{job.revision}</dd>
                      </div>
                      <div>
                        <dt>创建</dt>
                        <dd>{formatDate(job.createdAt)}</dd>
                      </div>
                    </dl>
                    {job.status === "failed" && (
                      <Button
                        variant="ghost"
                        onClick={() => setDetail(job)}
                        className="admin-summary-action"
                      >
                        查看失败原因
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {q.isSuccess && jobs.length === 0 && <NoRecords />}
          </Spin>
        ) : (
          <div className="table-wrap">
            <Table<JobDTO>
              rowKey="id"
              size="small"
              columns={columns}
              dataSource={jobs}
              loading={q.isPending}
              pagination={false}
              onRow={(job) =>
                ({ "data-admin-record": job.id }) as HTMLAttributes<HTMLElement>
              }
              locale={{ emptyText: emptyText(q.isSuccess) }}
            />
          </div>
        )}
        <RecordPager
          page={page}
          total={q.data?.total ?? 0}
          onPage={setPage}
          label="导出任务分页"
        />
      </RecordSection>
      {detail && (
        <JobDetails job={detail} onClose={() => setDetail(null)} />
      )}
    </>
  );
}
