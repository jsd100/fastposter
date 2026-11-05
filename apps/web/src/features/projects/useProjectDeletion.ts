import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  isDeletionComplete,
  replaceDeletionTask,
  routes,
  type ProjectDeletionDTO,
  type ProjectDeletionListReply,
} from "@fastposter/api-client";
import { useNotify } from "@fastposter/ui";
import { request } from "../../api";
import { drafts } from "../editor/drafts";
import { publishProjectDeletion } from "../editor/projectDeletionSync";

export const DELETION_PAGE_SIZE = 24;
export const DELETION_POLL_INTERVAL = 2000;

type Options = {
  enabled: boolean;
  page: number;
  keyword: string;
};

export function useProjectDeletion(
  userId: string,
  { enabled, page, keyword }: Options,
) {
  const cache = useQueryClient();
  const { show } = useNotify();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const activeUser = useRef(userId);
  activeUser.current = userId;
  const scope = `${userId}|${page}|${keyword}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const watched = useRef(new Set<string>());
  const checking = useRef(new Set<string>());
  const notified = useRef(new Set<string>());
  const listed = useRef(new Set<string>());
  const listKey = ["project-deletions", userId, page, keyword] as const;
  const list = useQuery({
    queryKey: listKey,
    queryFn: () =>
      request(routes.ListProjectDeletions, {
        page,
        pageSize: DELETION_PAGE_SIZE,
        keyword: keyword || undefined,
      }),
    enabled,
    retry: false,
    refetchInterval: (query) =>
      (query.state.data?.total ?? 0) > 0 ? DELETION_POLL_INTERVAL : false,
  });

  useEffect(() => {
    watched.current = new Set();
    checking.current = new Set();
    listed.current = new Set();
  }, [scope]);

  async function confirmCompleted(
    ownerId: string,
    ownerScope: string,
    taskId: string,
  ) {
    if (checking.current.has(taskId) || notified.current.has(taskId)) return;
    checking.current.add(taskId);
    try {
      const { deletion } = await request(routes.GetProjectDeletion, {
        id: taskId,
      });
      if (activeUser.current !== ownerId || scopeRef.current !== ownerScope)
        return;
      if (!isDeletionComplete(deletion)) return;
      watched.current.delete(taskId);
      if (!notified.current.has(taskId)) {
        notified.current.add(taskId);
        show({
          id: `project-deletion:${ownerId}:${taskId}`,
          tone: "success",
          title: "作品及独占资源已彻底删除，共享资源已保留。",
        });
      }
      await cache.invalidateQueries({ queryKey: ["projects", ownerId] });
      await cache.invalidateQueries({
        queryKey: ["project-deletions", ownerId],
      });
    } catch {
      // The next list poll retries the detail check; request() handles expiry.
    } finally {
      checking.current.delete(taskId);
    }
  }

  useEffect(() => {
    if (!enabled || !list.data) return;
    const ownerScope = scope;
    const current = new Set(list.data.deletions.map((task) => task.id));
    listed.current = current;
    for (const taskId of watched.current)
      if (!current.has(taskId))
        void confirmCompleted(userId, ownerScope, taskId);
    watched.current = new Set([...watched.current, ...current]);
  }, [enabled, scope, userId, list.data]);

  // The list only proves a task was unfinished while it was visible. Once the
  // queue empties (or an accepted task never reaches this page), confirm the
  // outcome independently so a dropped detail request cannot lose the result.
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      for (const taskId of watched.current)
        if (!listed.current.has(taskId))
          void confirmCompleted(userId, scope, taskId);
    }, DELETION_POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [enabled, scope, userId]);

  async function run<T>(action: () => Promise<T>): Promise<T> {
    if (busyRef.current) throw new Error("操作正在进行，请稍候");
    busyRef.current = true;
    setBusy(true);
    try {
      return await action();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function accept(projectId: string): Promise<ProjectDeletionDTO> {
    return run(async () => {
      const { deletion } = await request(routes.PermanentlyDeleteProject, {
        id: projectId,
      });
      // Track the accepted task even if the first unfinished list never shows
      // it, so fast cleanup still produces the required completion feedback.
      watched.current.add(deletion.id);
      const cleanup = drafts.blockProject(userId, projectId);
      publishProjectDeletion({ userId, projectId });
      try {
        await cleanup;
      } catch {
        show({
          id: `project-deletion-draft:${userId}:${projectId}`,
          tone: "error",
          title: "作品已删除，但本地草稿清理失败。",
          description: "请在浏览器站点设置中清除本站数据，移除本地副本。",
        });
      }
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["projects", userId] }),
        cache.invalidateQueries({ queryKey: ["project-deletions", userId] }),
      ]);
      if (isDeletionComplete(deletion))
        void confirmCompleted(userId, scope, deletion.id);
      return deletion;
    });
  }

  function retry(taskId: string): Promise<ProjectDeletionDTO> {
    return run(async () => {
      const { deletion } = await request(routes.RetryProjectDeletion, {
        id: taskId,
      });
      watched.current.add(deletion.id);
      cache.setQueryData<ProjectDeletionListReply>(listKey, (previous) =>
        previous
          ? {
              ...previous,
              deletions: replaceDeletionTask(previous.deletions, deletion),
            }
          : previous,
      );
      await cache.invalidateQueries({
        queryKey: ["project-deletions", userId],
      });
      return deletion;
    });
  }

  return {
    accept,
    retry,
    pending: list.data?.deletions ?? [],
    total: list.data?.total ?? 0,
    isBusy: busy,
    isLoading: list.isLoading,
    error: list.error,
    refetch: () => void list.refetch(),
  };
}
