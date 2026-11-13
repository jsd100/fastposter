import type { ProjectDTO } from "@fastposter/api-client";
import { Button, IconButton } from "@fastposter/ui";
import { Card, Dropdown, Empty, Skeleton, Typography } from "antd";
import type { ReactNode } from "react";
import {
  Copy,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
  LayoutTemplate,
} from "lucide-react";
import { Link } from "../../router";
import { CARD_MENU } from "./project-menu";
export type ProjectAction =
  "rename" | "clone" | "delete" | "restore" | "permanent-delete";
/** The card menu is a popup, so its icons are declared with the actions. */
const ICONS: Record<string, ReactNode> = {
  rename: <Pencil size={15} />,
  clone: <Copy size={15} />,
  delete: <Trash2 size={15} />,
};
type Props = {
  projects: ProjectDTO[];
  loading: boolean;
  trash: boolean;
  filtered?: boolean;
  searchTerm?: string;
  pendingDeletions?: number;
  onAction: (action: ProjectAction, project: ProjectDTO) => void;
  onUpload: () => void;
  onBrowseTemplates: () => void;
  onClearSearch: () => void;
};
export function ProjectListView({
  projects,
  loading,
  trash,
  filtered = false,
  searchTerm = "",
  pendingDeletions = 0,
  onAction,
  onUpload,
  onBrowseTemplates,
  onClearSearch,
}: Props) {
  if (loading)
    return (
      <div
        className="project-grid"
        role="status"
        aria-label="正在加载作品"
        aria-busy="true"
      >
        {[0, 1, 2].map((n) => (
          <Card
            key={n}
            size="small"
            className="project-card"
            cover={
              <div className="project-preview project-preview-loading">
                <Skeleton active title={false} paragraph={{ rows: 3 }} />
              </div>
            }
          >
            <div className="project-card-info">
              <Skeleton active title={{ width: "55%" }} paragraph={false} />
            </div>
          </Card>
        ))}
      </div>
    );
  if (projects.length === 0) {
    if (filtered)
      return (
        <div className="empty-workspace">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={`没有匹配“${searchTerm}”的作品`}
          >
            <Button onClick={onClearSearch}>清除搜索</Button>
          </Empty>
        </div>
      );
    return (
      <Empty
        className="empty-workspace"
        description={
          <>
            <Typography.Title level={4}>
              {trash
                ? pendingDeletions > 0
                  ? "没有可恢复的作品"
                  : "回收站是空的"
                : "从一张图片开始"}
            </Typography.Title>
            <Typography.Text type="secondary">
              {trash
                ? pendingDeletions > 0
                  ? "待清理作品会在后台完成删除，独占文件清理后自动消失。"
                  : "移入回收站的作品可在 30 天内恢复。"
                : "支持 JPG、PNG 和 WebP，保留原图像素尺寸。"}
            </Typography.Text>
          </>
        }
      >
        {!trash && (
          <div className="empty-actions">
            <Button onClick={onUpload} variant="primary">
              <ImagePlus size={17} />
              导入背景图
            </Button>
            <Button onClick={onBrowseTemplates}>
              <LayoutTemplate size={17} />
              从模板开始
            </Button>
          </div>
        )}
      </Empty>
    );
  }
  return (
    <div className="project-grid">
      {projects.map((project) => (
        <Card
          key={project.id}
          data-testid="project-card"
          className="project-card"
          size="small"
          hoverable={!trash}
          cover={
            <div className="project-preview">
              {!trash ? (
                <Link
                  href={`/projects/${project.id}/edit`}
                  aria-label={`编辑 ${project.title}`}
                >
                  <Preview project={project} />
                </Link>
              ) : (
                <Preview project={project} />
              )}
            </div>
          }
        >
          <div className="project-card-info">
            <div>
              <h3 title={project.title}>{project.title}</h3>
              <div className="project-card-meta">
                <span>
                  {project.width} × {project.height} px
                </span>
                <time dateTime={project.updatedAt}>
                  {new Intl.DateTimeFormat("zh-CN", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(project.updatedAt))}{" "}
                  更新
                </time>
              </div>
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
                  variant="danger"
                  onClick={() => onAction("permanent-delete", project)}
                  aria-label={`彻底删除 ${project.title}`}
                >
                  <Trash2 size={16} />
                  彻底删除
                </Button>
              </div>
            ) : (
              /* Destroyed on close, so a menu the visitor already dismissed
                 does not linger in the document as a second copy. */
              <Dropdown
                trigger={["click"]}
                placement="bottomRight"
                destroyOnHidden
                menu={{
                  items: CARD_MENU.map((entry) => ({
                    key: entry.action,
                    label: entry.text,
                    icon: ICONS[entry.action],
                    danger: entry.danger,
                  })),
                  onClick: ({ key }) => onAction(key as ProjectAction, project),
                }}
              >
                <IconButton
                  aria-label={`${project.title} 的操作`}
                  density="compact"
                >
                  <MoreHorizontal size={18} />
                </IconButton>
              </Dropdown>
            )}
          </div>
        </Card>
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
