import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { routes, type ProjectDTO } from "@fastposter/api-client";
import { parseDocument, type PosterDocument } from "@fastposter/poster-schema";
import { Autosave, documentSignature } from "./autosave";
import { drafts, type Draft } from "./drafts";
import { request } from "../../api";
export function useProjectAutosave(userId: string, initial: ProjectDTO) {
  const [title, setTitle] = useState(initial.title);
  const titleRef = useRef(initial.title);
  const cache = useQueryClient(),
    pendingFiles = useRef<Draft["pendingFiles"]>([]),
    interaction = useRef(false),
    uploading = useRef(false);
  const controller = useMemo(
    () =>
      new Autosave({
        initial: parseDocument(JSON.parse(initial.document)),
        revision: initial.revision,
        save: async (document: PosterDocument, revision: string) => {
          const r = await request(routes.SaveProject, {
            id: initial.id,
            title: titleRef.current,
            document: JSON.stringify(document),
            expectedRevision: revision,
          });
          return {
            document: parseDocument(JSON.parse(r.project.document)),
            revision: r.project.revision,
          };
        },
        persist: (draft) =>
          drafts.put({
            ...draft,
            userId,
            projectId: initial.id,
            title: titleRef.current,
            pendingFiles: pendingFiles.current,
          }),
        onSaved: () => {
          void cache.invalidateQueries({ queryKey: ["projects", userId] });
        },
      }),
    [userId, initial.id],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );
  const [ready, setReady] = useState(false),
    [recovery, setRecovery] = useState<Draft | null>(null),
    [draftError, setDraftError] = useState("");
  useEffect(() => {
    let active = true;
    drafts.activate(userId);
    drafts
      .get(userId, initial.id)
      .then((draft) => {
        if (!active) return;
        if (
          draft &&
          (documentSignature(draft.document) !==
            documentSignature(parseDocument(JSON.parse(initial.document))) ||
            draft.pendingFiles.length)
        ) {
          setRecovery(draft);
        } else setReady(true);
      })
      .catch((e) => {
        if (active) {
          setDraftError(e instanceof Error ? e.message : "草稿读取失败");
          setReady(true);
        }
      });
    return () => {
      active = false;
      void controller.dispose();
    };
  }, [controller, userId, initial.id]);
  const setInteraction = (busy: boolean) => {
    interaction.current = busy;
    controller.setBlocked(busy || uploading.current);
  };
  const setUploading = (busy: boolean, files: Draft["pendingFiles"] = []) => {
    uploading.current = busy;
    pendingFiles.current = files;
    controller.setBlocked(busy || interaction.current);
    controller.update(controller.getState().document);
  };
  const restore = async () => {
    if (!recovery) return;
    parseDocument(recovery.document);
    pendingFiles.current = recovery.pendingFiles;
    uploading.current = recovery.pendingFiles.length > 0;
    controller.setBlocked(uploading.current || interaction.current);
    await controller.restore(recovery.document, recovery.baseRevision);
    setRecovery(null);
    setReady(true);
  };
  const discard = async () => {
    await drafts.delete(userId, initial.id);
    setRecovery(null);
    setReady(true);
  };
  const loadCloud = async () => {
    const r = await request(routes.GetProject, { id: initial.id });
    titleRef.current = r.project.title;
    setTitle(r.project.title);
    pendingFiles.current = [];
    uploading.current = false;
    controller.setBlocked(interaction.current);
    await controller.reset(
      parseDocument(JSON.parse(r.project.document)),
      r.project.revision,
    );
    pendingFiles.current = [];
    return r.project;
  };
  return {
    controller,
    title,
    state,
    ready,
    recovery,
    draftError,
    restore,
    discard,
    loadCloud,
    setInteraction,
    setUploading,
    pendingFiles,
    flush: async () => {
      const result = await controller.flush();
      return {
        ...initial,
        document: JSON.stringify(result.document),
        revision: result.revision,
        width: result.document.canvas.width,
        height: result.document.canvas.height,
      };
    },
  };
}
