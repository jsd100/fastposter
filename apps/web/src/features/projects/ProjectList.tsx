import type { ProjectDTO } from "@fastposter/api-client";
import { Button } from "@fastposter/ui";
import {
  Copy,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "../../router";
export type ProjectAction =
  "rename" | "clone" | "delete" | "restore" | "permanent-delete";
type Props = {
  projects: ProjectDTO[];
  loading: boolean;
  trash: boolean;
  pendingDeletions?: number;
  onAction: (action: ProjectAction, project: ProjectDTO) => void;
  onUpload: () => void;
};
export function ProjectListView({
  projects,
  loading,
  trash,
  pendingDeletions = 0,
  onAction,
  onUpload,
}: Props) {
  if (loading)
    return (
      <div className="project-grid" role="status" aria-label="正在加载作品">
        {[0, 1, 2].map((n) => (
          <div key={n} className="project-skeleton">
            <div />
            <span />
          </div>
        ))}
      </div>
    );
  if (projects.length === 0)
    return (
      <div className="empty-workspace">
        <div className="empty-symbol">
          {trash ? (
            <Trash2 size={30} strokeWidth={1.3} />
          ) : (
            <ImagePlus size={34} strokeWidth={1.3} />
          )}
        </div>
        <h2>
          {trash
            ? pendingDeletions > 0
              ? "没有可恢复的作品"
              : "回收站是空的"
            : "从一张图片开始"}
        </h2>
        <p>
          {trash
            ? pendingDeletions > 0
              ? "待清理作品会在后台完成删除，独占文件清理后自动消失。"
              : "移入回收站的作品可在 30 天内恢复。"
            : "导入喜欢的背景，写下此刻的灵感。"}
        </p>
        {!trash && (
          <Button onClick={onUpload} variant="primary">
            <ImagePlus size={17} />
            导入背景图
          </Button>
        )}
        <span className="empty-formats">
          {trash
            ? "你的下一张好海报，还在前面。"
            : "JPG / PNG / WebP · 保持原图像素尺寸"}
        </span>
      </div>
    );
  return (
    <div className="project-grid">
      {projects.map((project) => (
        <article
          key={project.id}
          data-testid="project-card"
          className="project-card"
        >
          <div className="project-preview">
            {!trash ? (
              <Link
                href={`/projects/${project.id}/edit`}
                aria-label={`编辑 ${project.title}`}
              >
                <Preview project={project} />
                <span className="preview-edit">
                  继续编辑 <ArrowUpRight size={16} />
                </span>
              </Link>
            ) : (
              <Preview project={project} />
            )}
            <span className="project-dimensions">
              {project.width} × {project.height}
            </span>
          </div>
          <div className="project-card-info">
            <div>
              <h3>{project.title}</h3>
              <p>
                {new Intl.DateTimeFormat("zh-CN", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(project.updatedAt))}{" "}
                更新
              </p>
            </div>
            {trash ? (
              <div className="trash-actions">
                <Button
                  variant="ghost"
                  onClick={() => onAction("restore", project)}
                  aria-label="恢复作品"
                >
                  <RotateCcw size={16} />
                  恢复
                </Button>
                <Button
                  variant="ghost"
                  className="text-danger"
                  onClick={() => onAction("permanent-delete", project)}
                  aria-label={`彻底删除 ${project.title}`}
                >
                  <Trash2 size={16} />
                  彻底删除
                </Button>
              </div>
            ) : (
              <details className="project-menu">
                <summary aria-label={`${project.title} 的操作`}>
                  <MoreHorizontal size={20} />
                </summary>
                <div className="project-menu-items">
                  <Button
                    onClick={(e) => {
                      e.currentTarget.closest("details")!.open = false;
                      onAction("rename", project);
                    }}
                  >
                    <Pencil size={15} />
                    重命名
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.currentTarget.closest("details")!.open = false;
                      onAction("clone", project);
                    }}
                  >
                    <Copy size={15} />
                    复制作品
                  </Button>
                  <Button
                    className="text-danger"
                    onClick={(e) => {
                      e.currentTarget.closest("details")!.open = false;
                      onAction("delete", project);
                    }}
                  >
                    <Trash2 size={15} />
                    移到回收站
                  </Button>
                </div>
              </details>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
function Preview({ project }: { project: ProjectDTO }) {
  return project.previewUrl ? (
    <img src={project.previewUrl} alt="" loading="lazy" />
  ) : (
    <div className="preview-placeholder">
      <ImagePlus size={28} />
    </div>
  );
}
