import { useQuery } from "@tanstack/react-query";
import { routes } from "@fastposter/api-client";
import { PosterFrame } from "@fastposter/poster-renderer";
import { parseDocument } from "@fastposter/poster-schema";
import { Status } from "@fastposter/ui";
import { ArrowLeft } from "lucide-react";
import { request, errorMessage } from "../../api";
import { Link } from "../../router";
import { useSession } from "../auth/Session";
export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ["project", user!.id, projectId],
    queryFn: () => request(routes.GetProject, { id: projectId }),
    retry: false,
  });
  if (query.error)
    return (
      <main className="simple-page">
        <Link href="/projects">返回作品</Link>
        <Status tone="error">{errorMessage(query.error)}</Status>
      </main>
    );
  if (!query.data)
    return (
      <main className="simple-page">
        <Status>正在打开作品…</Status>
      </main>
    );
  const project = query.data.project;
  const doc = parseDocument(JSON.parse(project.document));
  const scale = Math.min(1, 900 / doc.canvas.width, 650 / doc.canvas.height);
  return (
    <main className="editor-workspace">
      <header className="editor-header">
        <Link href="/projects" className="return-link">
          <ArrowLeft size={18} />
          返回作品
        </Link>
        <h1>{project.title}</h1>
        <span className="saved-label">已保存</span>
      </header>
      <div className="canvas-placeholder">
        <div
          style={{
            width: doc.canvas.width * scale,
            height: doc.canvas.height * scale,
            position: "relative",
          }}
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <PosterFrame
              document={doc}
              backgroundUrl={`/api/v1/assets/${doc.background.assetId}/versions/${doc.background.version}`}
            />
          </div>
        </div>
      </div>
      <footer className="editor-footer">
        {doc.canvas.width} × {doc.canvas.height} px · 原图尺寸
      </footer>
    </main>
  );
}
