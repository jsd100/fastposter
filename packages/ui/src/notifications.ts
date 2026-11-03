export type NoticeTone = "info" | "success" | "error";

export type NoticeAction = { label: string; onClick: () => void };

export type Notice = {
  id?: string;
  tone: NoticeTone;
  title: string;
  description?: string;
  persistent?: boolean;
  action?: NoticeAction;
};

export type NoticeEntry = {
  id: string;
  tone: NoticeTone;
  title: string;
  description?: string;
  timeout: number;
  action?: NoticeAction;
  generation: number;
};

export const NOTICE_TIMEOUT_MS = { normal: 4000, error: 6000 } as const;

export function noticeTimeout(notice: {
  tone: NoticeTone;
  persistent?: boolean;
}): number {
  if (notice.persistent) return 0;
  return notice.tone === "error"
    ? NOTICE_TIMEOUT_MS.error
    : NOTICE_TIMEOUT_MS.normal;
}

export type NoticeSink = {
  upsert: (entry: NoticeEntry) => void;
  dismiss: (id: string) => void;
};

export type NoticeStore = ReturnType<typeof createNoticeStore>;

export function createNoticeStore(sink?: NoticeSink) {
  let currentSink = sink ?? null;
  let generation = 0;
  let scope: string | undefined;
  let sequence = 0;
  const entries = new Map<string, NoticeEntry>();
  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) listener();
  }

  return {
    attach(next: NoticeSink | null) {
      currentSink = next;
    },
    get generation() {
      return generation;
    },
    get scope() {
      return scope;
    },
    get entries() {
      return [...entries.values()];
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setScope(next: string) {
      if (scope === next) return;
      const initial = scope === undefined;
      scope = next;
      if (initial) return;
      generation += 1;
      const ids = [...entries.keys()];
      entries.clear();
      for (const id of ids) currentSink?.dismiss(id);
      notify();
    },
    show(notice: Notice, boundGeneration: number): string {
      if (boundGeneration !== generation) return "";
      const id = notice.id ?? `fp-notice-${++sequence}`;
      const entry: NoticeEntry = {
        id,
        tone: notice.tone,
        title: notice.title,
        description: notice.description,
        timeout: noticeTimeout(notice),
        action: notice.action,
        generation,
      };
      entries.set(id, entry);
      currentSink?.upsert(entry);
      return id;
    },
    close(id: string) {
      if (!entries.delete(id)) return;
      currentSink?.dismiss(id);
    },
    clear() {
      const ids = [...entries.keys()];
      entries.clear();
      for (const id of ids) currentSink?.dismiss(id);
    },
  };
}
